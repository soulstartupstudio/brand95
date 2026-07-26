import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty-state">
      <h2>Not found</h2>
      <p className="muted">That record doesn’t exist (or was archived).</p>
      <Link className="btn" href="/">
        Back to portfolio
      </Link>
    </div>
  );
}
