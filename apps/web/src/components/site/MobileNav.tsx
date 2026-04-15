"use client";

import { Menu, X } from "lucide-react";

type MobileNavProps = {
  menuOpen: boolean;
  onToggle: () => void;
};

export default function MobileNav({ menuOpen, onToggle }: MobileNavProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-md p-2 hover:bg-muted md:hidden"
      aria-label="Open navigation menu"
      aria-expanded={menuOpen}
      aria-controls="mobile-nav"
    >
      {menuOpen ? (
        <X className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Menu className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}