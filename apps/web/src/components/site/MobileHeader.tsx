"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "@/components/site/ThemeToggle";
import MobileNav from "@/components/site/MobileNav";

type NavItem = {
  label: string;
  href?: string;
};

type MobileHeaderProps = {
  items: NavItem[];
  siteName: string;
  logoUrl?: string | null;
  logoAlt?: string;
};

export default function MobileHeader({
  items,
  siteName,
  logoUrl,
  logoAlt,
}: MobileHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="font-semibold tracking-tight">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={logoAlt ?? siteName}
              width={240}
              height={96}
              className="h-12 w-auto"
              priority
            />
          ) : (
            siteName
          )}
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <MobileNav
            menuOpen={menuOpen}
            onToggle={() => setMenuOpen((open) => !open)}
          />
        </div>
      </div>

      {menuOpen ? (
        <nav
          id="mobile-nav"
          className="mt-3 flex flex-col gap-2 border-t border-border pt-3"
        >
          {items.map((item) => (
            <Link
              key={item.href ?? item.label}
              href={item.href ?? "#"}
              className="rounded px-2 py-2 text-sm hover:bg-muted"
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}