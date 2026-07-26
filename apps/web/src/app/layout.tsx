import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brand95 OS",
  description:
    "Approval-gated multi-brand operating system: blueprint, agents, evidence, decisions.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div className="logo">
              Brand<span>95</span> OS
            </div>
            <Link className="nav-link" href="/">
              Portfolio
            </Link>
            <Link className="nav-link" href="/approvals">
              Approval inbox
            </Link>
            <Link className="nav-link" href="/brands/new">
              Create new brand
            </Link>
            <div className="nav-section">Reference</div>
            <Link className="nav-link" href="/blueprint">
              The Blueprint
            </Link>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
