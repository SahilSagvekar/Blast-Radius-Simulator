"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavHeader() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Graph" },
    { href: "/simulations", label: "History" },
  ];

  return (
    <header className="h-12 border-b border-zinc-800 bg-zinc-950 flex items-center px-4 gap-6 shrink-0">
      <span className="text-sm font-semibold text-zinc-100 tracking-tight">
        Blast Radius Simulator
      </span>
      <nav className="flex gap-1">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                active
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
