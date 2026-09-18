"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, Map, Target, User } from "lucide-react";

const NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/map", label: "Map", icon: Map },
  { href: "/missions", label: "Missions", icon: Target },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Hoofdnavigatie">
      {NAV.map(({ href, label, icon: Icon }) => {
        const current = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={current ? "page" : undefined}
          >
            <Icon size={22} strokeWidth={current ? 2.1 : 1.7} />
          </Link>
        );
      })}
    </nav>
  );
}
