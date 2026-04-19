"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/search", label: "Search" },
  { href: "/browse", label: "Browse" },
  { href: "/tags", label: "Tags" },
  { href: "/timeline", label: "Timeline" },
  { href: "/calendar", label: "Calendar" },
  { href: "/graph", label: "Graph" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-4 w-52 min-h-screen bg-zinc-900 border-r border-zinc-800">
      <h1 className="text-lg font-bold text-zinc-100 mb-4 px-2">Notes</h1>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`px-3 py-2 rounded text-sm transition-colors ${
            pathname === link.href
              ? "bg-zinc-700 text-white"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}