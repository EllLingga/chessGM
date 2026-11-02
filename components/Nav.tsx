"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/play", label: "Play Chess" }, { href: "/arena", label: "AI Arena" }, { href: "/analysis", label: "Analysis" },
  { href: "/openings", label: "Opening Explorer" }, { href: "/history", label: "Game History" }, { href: "/settings", label: "Settings" },
];

export default function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  if (path === "/login") return null;
  return (
    <header className="border-b border-line bg-bg/90 sticky top-0 z-30 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-extrabold tracking-[0.2em] text-sm">GRAND<span className="text-accent">MASTER</span></Link>
        <nav className="hidden lg:flex gap-5 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={path.startsWith(l.href) ? "text-accent" : "text-neutral-400 hover:text-white"}>{l.label}</Link>
          ))}
        </nav>
        <button className="lg:hidden btn" onClick={() => setOpen((o) => !o)} aria-label="Menu">{open ? "✕" : "☰"}</button>
      </div>
      {open && (
        <nav className="lg:hidden border-t border-line bg-bg px-4 py-2 grid">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className={`py-3 border-b border-line/60 last:border-0 ${path.startsWith(l.href) ? "text-accent" : "text-neutral-300"}`}>{l.label}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}
