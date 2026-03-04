"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;

  const prefersDark =
    window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;

  return prefersDark ? "dark" : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const t = getInitialTheme();
    setTheme(t);
    applyTheme(t);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    applyTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-md border border-border bg-card px-2 py-1 text-sm hover:bg-muted"
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      {theme === "dark" ? (
        <Moon className="h-4 w-4" aria-hidden="true" />
        ) : (
        <Sun className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}