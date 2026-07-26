const BADGE_COLORS: Record<string, string> = {
  // brand status
  ACTIVE: "green",
  PARKED: "amber",
  REJECTED: "red",
  ARCHIVED: "gray",
  // gate status
  NOT_READY: "gray",
  READY: "amber",
  PASSED: "green",
  // criterion status
  PENDING: "gray",
  MET: "green",
  WAIVED: "amber",
  // approval status
  APPROVED: "green",
  CHANGES_REQUESTED: "amber",
  EXPIRED: "gray",
  EXECUTED: "blue",
  // task status
  TODO: "gray",
  IN_PROGRESS: "blue",
  BLOCKED: "red",
  DONE: "green",
  CANCELLED: "gray",
  // agent runs
  QUEUED: "gray",
  RUNNING: "blue",
  COMPLETED: "green",
  FAILED: "red",
  // stage status
  LOCKED: "gray",
  COMPLETE: "green",
  SKIPPED: "gray",
  // routes
  DUAL: "purple",
  RETAIL_FIRST: "purple",
  D2C_FIRST: "purple",
};

export function StatusBadge({ status }: { status: string }) {
  const color = BADGE_COLORS[status] ?? "gray";
  return <span className={`badge ${color}`}>{status.replaceAll("_", " ")}</span>;
}

export function LevelBadge({ level }: { level: number }) {
  const color = level >= 3 ? "red" : level === 2 ? "amber" : "blue";
  return <span className={`badge ${color}`}>Level {level}</span>;
}
