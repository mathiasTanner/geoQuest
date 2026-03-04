import Link from "next/link";
import { getNavigation } from "@/lib/strapi/navigation";
import ThemeToggle from "@/components/site/ThemeToggle";

export default async function Header() {
  const items = await getNavigation();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card text-card-foreground">
        <div className="flex w-full items-center px-4 py-3">
        <Link href="/" className="mr-6 font-semibold tracking-tight">
            GeoQuest
        </Link>

        <nav className="flex flex-1 items-center justify-center gap-4 whitespace-nowrap text-sm">
            {items.map((item) => (
            <Link
                key={item.href ?? item.label}
                href={item.href ?? "#"}
                className="rounded px-2 py-1 hover:bg-muted"
            >
                {item.label}
            </Link>
            ))}
        </nav>

        <div className="ml-6 flex items-center gap-2">
            <ThemeToggle />
        </div>
        </div>
    </header>
    );
}