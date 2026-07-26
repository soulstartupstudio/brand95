"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="empty-state">
      <h2>Something went wrong</h2>
      <p className="muted">{error.message}</p>
      <button className="btn primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
