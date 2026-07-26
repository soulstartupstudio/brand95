"use server";

import {
  createBrandWithBlueprint,
  decideApproval,
  prisma,
  recordEvidence,
  requestGateApproval,
  setCriterionStatus,
  type EvidenceType,
} from "@brand95/database";
import { DECISION_OUTCOMES, type DecisionOutcome } from "@brand95/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireContext } from "./current-user";

export type ActionState = { ok: true } | { error: string } | null;

function fail(err: unknown): ActionState {
  if (err instanceof z.ZodError) {
    return { error: err.issues.map((i) => i.message).join("; ") };
  }
  return { error: err instanceof Error ? err.message : "Something went wrong." };
}

// ---------- Create Brand wizard ----------

export interface CreateBrandPayload {
  name: string;
  concept: string;
  problem?: string;
  customerHypothesis?: string;
  geography?: string;
  priceRange?: string;
  convictionStatement?: string;
  knownConstraints?: string;
  channelHypothesis?: string;
  startingBudget?: string;
  maxInventoryExposure?: string;
  desiredLaunchDate?: string;
  founderHoursPerWeek?: string;
  complianceConcerns?: string;
  existingAssets?: string;
  preferredChannel?: "RETAIL_FIRST" | "D2C_FIRST" | "DUAL_VALIDATION";
}

export async function createBrand(
  payload: CreateBrandPayload,
): Promise<{ ok: true; brandId: string } | { error: string }> {
  try {
    const { workspace, user } = await requireContext();
    const clean = Object.fromEntries(
      Object.entries(payload).filter(
        ([, v]) => typeof v !== "string" || v.trim() !== "",
      ),
    ) as CreateBrandPayload;
    const { brand, created } = await createBrandWithBlueprint({
      workspaceId: workspace.id,
      createdById: user.id,
      ...clean,
      desiredLaunchDate: clean.desiredLaunchDate
        ? new Date(clean.desiredLaunchDate)
        : undefined,
      founderHoursPerWeek: clean.founderHoursPerWeek
        ? Number(clean.founderHoursPerWeek)
        : undefined,
    });
    if (!created) {
      return { error: `A brand named "${brand.name}" already exists.` };
    }
    revalidatePath("/", "layout");
    return { ok: true, brandId: brand.id };
  } catch (err) {
    const failure = fail(err);
    return failure && "error" in failure
      ? failure
      : { error: "Something went wrong." };
  }
}

// ---------- Gate criteria and evidence ----------

export async function updateCriterion(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { user } = await requireContext();
    const parsed = z
      .object({
        criterionId: z.string().uuid(),
        status: z.enum(["PENDING", "MET", "WAIVED"]),
        waivedReason: z.string().optional(),
        brandId: z.string().uuid(),
      })
      .parse(Object.fromEntries(formData));
    await setCriterionStatus({
      criterionId: parsed.criterionId,
      status: parsed.status,
      waivedReason: parsed.waivedReason,
      actorId: user.id,
    });
    revalidatePath(`/brands/${parsed.brandId}`, "layout");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function addEvidence(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { user } = await requireContext();
    const parsed = z
      .object({
        criterionId: z.string().uuid(),
        type: z.enum([
          "CUSTOMER_SIGNAL",
          "INTERVIEW",
          "RETAILER_SIGNAL",
          "METRIC",
          "DOCUMENT",
          "LINK",
          "NOTE",
        ]),
        source: z.string().trim().min(3, "Evidence needs a source"),
        note: z.string().optional(),
        brandId: z.string().uuid(),
      })
      .parse(Object.fromEntries(formData));
    await recordEvidence({
      criterionId: parsed.criterionId,
      type: parsed.type as EvidenceType,
      source: parsed.source,
      note: parsed.note,
      recordedBy: user.id,
    });
    revalidatePath(`/brands/${parsed.brandId}`, "layout");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ---------- Gate approval flow ----------

export async function requestGateApprovalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { user } = await requireContext();
    const parsed = z
      .object({ gateId: z.string().uuid(), brandId: z.string().uuid() })
      .parse(Object.fromEntries(formData));
    await requestGateApproval({ gateId: parsed.gateId, requestedBy: user.id });
    revalidatePath(`/brands/${parsed.brandId}`, "layout");
    revalidatePath("/approvals");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function decideApprovalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { user } = await requireContext();
    const parsed = z
      .object({
        requestId: z.string().uuid(),
        outcome: z.enum(DECISION_OUTCOMES),
        note: z.string().optional(),
      })
      .parse(Object.fromEntries(formData));
    await decideApproval({
      requestId: parsed.requestId,
      deciderId: user.id,
      outcome: parsed.outcome as DecisionOutcome,
      note: parsed.note,
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ---------- Brand disposition ----------

export async function setBrandStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { workspace, user } = await requireContext();
    const parsed = z
      .object({
        brandId: z.string().uuid(),
        status: z.enum(["ACTIVE", "PARKED", "REJECTED"]),
        rationale: z.string().optional(),
      })
      .parse(Object.fromEntries(formData));
    const outcome =
      parsed.status === "ACTIVE"
        ? "REACTIVATE"
        : parsed.status === "PARKED"
          ? "PARK"
          : "REJECT";
    await prisma.$transaction(async (tx) => {
      await tx.brand.update({
        where: { id: parsed.brandId },
        data: { status: parsed.status },
      });
      await tx.decision.create({
        data: {
          brandId: parsed.brandId,
          title: `${outcome === "REACTIVATE" ? "Reactivate" : outcome === "PARK" ? "Park" : "Reject"} brand`,
          outcome,
          rationale: parsed.rationale,
          decidedById: user.id,
        },
      });
      await tx.event.create({
        data: {
          workspaceId: workspace.id,
          brandId: parsed.brandId,
          actorType: "USER",
          actorId: user.id,
          verb: `brand.${parsed.status.toLowerCase()}`,
          entityType: "Brand",
          entityId: parsed.brandId,
          payload: { rationale: parsed.rationale ?? null },
        },
      });
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function goToBrand(brandId: string) {
  redirect(`/brands/${brandId}`);
}
