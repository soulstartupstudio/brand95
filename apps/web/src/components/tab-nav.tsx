"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TabNav({
  base,
  tabs,
}: {
  base: string;
  tabs: { slug: string; label: string }[];
}) {
  const pathname = usePathname();
  return (
    <nav className="tabs">
      {tabs.map((tab) => {
        const href = tab.slug ? `${base}/${tab.slug}` : base;
        const active = tab.slug
          ? pathname.startsWith(href)
          : pathname === base;
        return (
          <Link key={tab.slug} href={href} className={active ? "active" : ""}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
