import { randomUUID } from "node:crypto";
import { Prisma, prisma } from "@brand95/database";
import {
  agentResultSchema,
  approvalRequestContentSchema,
  requiredApprovalLevel,
} from "@brand95/domain";
import { getEmailProvider } from "../integrations/email";
import { generateStructured, llmMode } from "../llm";
import { mockOutreachBatch } from "../mock";
import { outreachBatchSchema } from "../output-schemas";
import { brandBrief, systemPromptFor } from "../prompts";

/**
 * Retail Prospecting workflow, draft → approve → execute slice (spec §8.7).
 *
 * The Retail agent drafts personalized outreach emails; they are stored as
 * OutreachMessage rows and bundled into a Level 1 batch approval. Nothing is
 * sent until a human approves the batch, and execution goes through the email
 * adapter with an idempotency key per message — retries can never double-send.
 */

export async function draftRetailOutreach(input: {
  brandId: string;
  requestedBy: string; // user id
  count?: number;
}) {
  const count = Math.min(Math.max(input.count ?? 5, 1), 10);
  const brand = await prisma.brand.findUniqueOrThrow({
    where: { id: input.brandId },
  });
  if (brand.status !== "ACTIVE") {
    throw new Error(`Brand is ${brand.status}; reactivate it first.`);
  }

  const run = await prisma.agentRun.create({
    data: {
      brandId: brand.id,
      agentKey: "retail",
      status: "RUNNING",
      objective: `Draft ${count} retail outreach emails`,
      startedAt: new Date(),
    },
  });

  try {
    const batch = await generateStructured({
      system: systemPromptFor("retail"),
      schema: outreachBatchSchema,
      mock: () => mockOutreachBatch(brand, count),
      maxTokens: 16000,
      prompt: `${brandBrief(brand)}

Draft ${count} personalized wholesale outreach emails to plausible high-fit
retail prospects for this brand's target channels. Every draft must state what
its personalization relies on. These are DRAFTS for founder approval — do not
imply anything has been agreed.`,
    });

    const messages = await prisma.$transaction(
      batch.drafts.map((draft) =>
        prisma.outreachMessage.create({
          data: {
            brandId: brand.id,
            prospectName: draft.prospect_name,
            prospectType: draft.prospect_type,
            subject: draft.email_subject,
            body: draft.email_body,
            personalizationBasis: draft.personalization_basis,
            status: "DRAFT",
          },
        }),
      ),
    );

    const content = approvalRequestContentSchema.parse({
      proposedAction: `Send ${messages.length} retail outreach emails for ${brand.name}`,
      actionType: "external_outreach_campaign",
      whyNow: "Retail validation requires qualified prospects to be contacted.",
      evidence: messages.map(
        (m) => `${m.prospectName} (${m.prospectType ?? "?"}): "${m.subject}"`,
      ),
      costExposure: `No direct cost; brand reputation exposure on ${messages.length} prospects.`,
      reversibility: "IRREVERSIBLE",
      alternatives: ["Edit the drafts first", "Smaller batch", "Reject and re-draft"],
      recommendation:
        llmMode() === "mock"
          ? "Reject: drafts were generated in mock mode (no AI model configured)."
          : "Review each draft's personalization basis, then approve or request changes.",
      expiresAt: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
    });

    const request = await prisma.approvalRequest.create({
      data: {
        workspaceId: brand.workspaceId,
        brandId: brand.id,
        level: requiredApprovalLevel("external_outreach_campaign"),
        actionType: "external_outreach_campaign",
        content,
        requestedBy: "retail",
        expiresAt: new Date(content.expiresAt!),
      },
    });
    await prisma.outreachMessage.updateMany({
      where: { id: { in: messages.map((m) => m.id) } },
      data: { approvalRequestId: request.id },
    });

    const result = agentResultSchema.parse({
      task_id: randomUUID(),
      agent: "retail",
      status: "completed",
      summary: batch.summary,
      outputs: messages.map((m) => ({ type: "record", id: m.id })),
      evidence: [],
      assumptions: batch.assumptions,
      risks: [],
      decisions_required: [
        { type: "approval", question: `Approve sending ${messages.length} outreach emails?` },
      ],
      next_recommended_action: batch.next_recommended_action,
      completed_at: new Date().toISOString(),
    });
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "COMPLETED", result, completedAt: new Date() },
    });
    await prisma.event.create({
      data: {
        workspaceId: brand.workspaceId,
        brandId: brand.id,
        actorType: "AGENT",
        actorId: "retail",
        verb: "outreach.drafted",
        entityType: "ApprovalRequest",
        entityId: request.id,
        payload: { drafts: messages.length },
      },
    });

    return { requestId: request.id, drafted: messages.length };
  } catch (err) {
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      },
    });
    throw err;
  }
}

/**
 * Execute an APPROVED outreach batch. Approval is enforced here — not in the
 * UI — and each message is guarded by an idempotency key, so re-running after
 * a crash finishes the batch without duplicating a single send.
 */
export async function executeApprovedOutreach(input: {
  requestId: string;
  actorId: string; // user id
}) {
  const request = await prisma.approvalRequest.findUniqueOrThrow({
    where: { id: input.requestId },
    include: { outreachMessages: true, brand: true },
  });
  if (request.actionType !== "external_outreach_campaign") {
    throw new Error("This request is not an outreach campaign.");
  }
  if (request.status !== "APPROVED") {
    throw new Error(
      `Batch is ${request.status}; only APPROVED batches can be executed.`,
    );
  }

  const provider = getEmailProvider();
  let sent = 0;
  let skipped = 0;

  for (const message of request.outreachMessages) {
    if (message.status === "SENT") {
      skipped++;
      continue;
    }
    const key = `outreach.send:${message.id}`;
    try {
      await prisma.idempotencyKey.create({
        data: { key, scope: "outreach.send" },
      });
    } catch (err) {
      // Unique violation: this message was already claimed by a previous
      // (possibly crashed) execution — never send it again.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        skipped++;
        continue;
      }
      throw err;
    }

    const receipt = await provider.send({
      messageId: message.id,
      to: message.toEmail,
      subject: message.subject,
      body: message.body,
    });
    await prisma.outreachMessage.update({
      where: { id: message.id },
      data: {
        status: "SENT",
        provider: receipt.provider,
        externalId: receipt.externalId,
        sentAt: new Date(),
      },
    });
    await prisma.idempotencyKey.update({
      where: { key },
      data: { result: receipt as unknown as object },
    });
    await prisma.event.create({
      data: {
        workspaceId: request.workspaceId,
        brandId: request.brandId,
        actorType: "USER",
        actorId: input.actorId,
        verb: "outreach.sent",
        entityType: "OutreachMessage",
        entityId: message.id,
        payload: { provider: receipt.provider, prospect: message.prospectName },
      },
    });
    sent++;
  }

  await prisma.approvalRequest.update({
    where: { id: request.id },
    data: { status: "EXECUTED" },
  });
  await prisma.event.create({
    data: {
      workspaceId: request.workspaceId,
      brandId: request.brandId,
      actorType: "USER",
      actorId: input.actorId,
      verb: "approval.executed",
      entityType: "ApprovalRequest",
      entityId: request.id,
      payload: { sent, skipped, provider: provider.name },
    },
  });

  return { sent, skipped, provider: provider.name };
}
