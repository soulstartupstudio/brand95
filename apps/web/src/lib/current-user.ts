import { prisma } from "@brand95/database";

/**
 * MVP auth: Brand95 runs single-workspace with the seeded founder acting as
 * the signed-in user. A hosted auth provider replaces this in Milestone 5+;
 * everything downstream already checks roles via the domain approval policy,
 * so swapping the source of the current user is contained here.
 */
export async function getCurrentContext() {
  const workspace = await prisma.workspace.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!workspace) return null;
  const user = await prisma.user.findFirst({
    where: { workspaceId: workspace.id, role: "FOUNDER" },
    orderBy: { createdAt: "asc" },
  });
  if (!user) return null;
  return { workspace, user };
}

export async function requireContext() {
  const ctx = await getCurrentContext();
  if (!ctx) {
    throw new Error(
      "No workspace found. Run `pnpm db:seed` to initialize Brand95 OS.",
    );
  }
  return ctx;
}
