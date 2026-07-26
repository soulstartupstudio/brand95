import {
  BLUEPRINT_STAGES,
  WORKSTREAM_TRACKS,
} from "@brand95/domain";
import { Prisma, PreferredChannel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../client";

/**
 * New Brand Intake workflow (spec §8.1).
 *
 * Trigger: brand created via the wizard (or seed).
 * Actions: create the brand, instantiate all blueprint stages/gates/criteria,
 * create both workstream tracks, initial Stage 0 tasks, the initial risk
 * register, and audit events — all in one transaction.
 *
 * Idempotency: brand names are unique per workspace; re-running with the same
 * name returns the existing brand untouched instead of duplicating anything.
 */

export const createBrandInputSchema = z.object({
  workspaceId: z.string().uuid(),
  createdById: z.string().uuid(),

  // Step 1 — idea
  name: z.string().trim().min(2, "Brand name or codename is required"),
  concept: z.string().trim().min(10, "Describe the product idea"),
  problem: z.string().trim().min(1).optional(),
  customerHypothesis: z.string().trim().min(1).optional(),
  geography: z.string().trim().min(1).optional(),
  priceRange: z.string().trim().min(1).optional(),
  convictionStatement: z.string().trim().min(1).optional(),

  // Step 2 — constraints
  startingBudget: z.string().trim().min(1).optional(),
  maxInventoryExposure: z.string().trim().min(1).optional(),
  desiredLaunchDate: z.coerce.date().optional(),
  founderHoursPerWeek: z.coerce.number().int().min(0).max(100).optional(),
  complianceConcerns: z.string().trim().min(1).optional(),
  existingAssets: z.string().trim().min(1).optional(),
  knownConstraints: z.string().trim().min(1).optional(),
  channelHypothesis: z.string().trim().min(1).optional(),
  preferredChannel: z.nativeEnum(PreferredChannel).optional(),
});

export type CreateBrandInput = z.infer<typeof createBrandInputSchema>;

const INITIAL_RISKS = [
  {
    title: "Demand risk: no behavioral evidence yet",
    severity: "HIGH" as const,
    mitigation: "Run Discover and Validate before any inventory commitment.",
  },
  {
    title: "Margin risk: unit economics unproven",
    severity: "MEDIUM" as const,
    mitigation: "Build low/base/high unit economics during Discover.",
  },
  {
    title: "Supply risk: no supplier or lead-time visibility",
    severity: "MEDIUM" as const,
    mitigation: "Supplier shortlist and quotes before Hero Product gate.",
  },
];

const STAGE0_TASKS = [
  {
    title: "Complete intake form",
    assigneeAgent: null as string | null,
    description: "All Stage 0 required outputs captured on the brand record.",
  },
  {
    title: "Draft research plan for Discover",
    assigneeAgent: "ceo_orchestrator",
    description:
      "Propose the Discover workstream plan and which specialist agents to spawn in parallel.",
  },
  {
    title: "Prepare research spend approval request",
    assigneeAgent: "ceo_orchestrator",
    description:
      "Summarize scope, time, and cost of Discover research for founder approval (Stage 0 exit gate).",
  },
];

export async function createBrandWithBlueprint(rawInput: CreateBrandInput) {
  const input = createBrandInputSchema.parse(rawInput);

  const existing = await prisma.brand.findUnique({
    where: {
      workspaceId_name: { workspaceId: input.workspaceId, name: input.name },
    },
  });
  if (existing) {
    return { brand: existing, created: false as const };
  }

  const brand = await prisma.$transaction(async (tx) => {
    const brand = await tx.brand.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        concept: input.concept,
        problem: input.problem,
        customerHypothesis: input.customerHypothesis,
        geography: input.geography,
        priceRange: input.priceRange,
        convictionStatement: input.convictionStatement,
        startingBudget: input.startingBudget,
        maxInventoryExposure: input.maxInventoryExposure,
        desiredLaunchDate: input.desiredLaunchDate,
        founderHoursPerWeek: input.founderHoursPerWeek,
        complianceConcerns: input.complianceConcerns,
        existingAssets: input.existingAssets,
        knownConstraints: input.knownConstraints,
        channelHypothesis: input.channelHypothesis,
        preferredChannel: input.preferredChannel,
        currentStageIndex: 0,
      },
    });

    for (const stageDef of BLUEPRINT_STAGES) {
      const stage = await tx.brandStage.create({
        data: {
          brandId: brand.id,
          index: stageDef.index,
          slug: stageDef.slug,
          name: stageDef.name,
          purpose: stageDef.purpose,
          status: stageDef.index === 0 ? "ACTIVE" : "LOCKED",
        },
      });
      await tx.stageGate.create({
        data: {
          stageId: stage.id,
          criteria: {
            create: stageDef.gateCriteria.map((c) => ({
              key: c.key,
              label: c.label,
              founderJudgment: c.founderJudgment ?? false,
              evidenceTarget: c.evidenceTarget,
            })),
          },
        },
      });
    }

    for (const [track, names] of Object.entries(WORKSTREAM_TRACKS)) {
      for (const name of names) {
        await tx.workstream.create({
          data: {
            brandId: brand.id,
            track: track as "BRAND" | "COMMERCIAL",
            name,
          },
        });
      }
    }

    const stage0 = await tx.brandStage.findUniqueOrThrow({
      where: { brandId_index: { brandId: brand.id, index: 0 } },
    });
    for (const task of STAGE0_TASKS) {
      await tx.task.create({
        data: {
          brandId: brand.id,
          stageId: stage0.id,
          title: task.title,
          description: task.description,
          assigneeAgent: task.assigneeAgent,
        },
      });
    }

    for (const risk of INITIAL_RISKS) {
      await tx.risk.create({ data: { brandId: brand.id, ...risk } });
    }

    await tx.event.create({
      data: {
        workspaceId: input.workspaceId,
        brandId: brand.id,
        actorType: "USER",
        actorId: input.createdById,
        verb: "brand.created",
        entityType: "Brand",
        entityId: brand.id,
        payload: {
          name: brand.name,
          stages: BLUEPRINT_STAGES.length,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return brand;
  });

  return { brand, created: true as const };
}
