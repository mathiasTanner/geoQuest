import Link from "next/link";
import { getNavigation } from "@/lib/strapi/navigation";
import ThemeToggle from "@/components/site/ThemeToggle";
import MobileHeader from "@/components/site/MobileHeader";
import Image from "next/image";
import { getSiteSettings } from "@/lib/strapi/siteSettings";
import Container from "@/components/layout/Container";

export default async function Header() {
  const items = await getNavigation();
  const siteSettings = await getSiteSettings();
  const cmsBaseUrl = process.env.CMS_URL ?? process.env.NEXT_PUBLIC_CMS_URL ?? "";
  const logoUrl = siteSettings.logo?.url
    ? `${cmsBaseUrl.replace(/\/$/, "")}${siteSettings.logo.url}`
    : null;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card text-card-foreground">
      <Container className="py-2">
        <MobileHeader
            items={items}
            siteName={siteSettings.siteName}
            logoUrl={logoUrl}
            logoAlt={siteSettings.logo?.alternativeText}
        />

        <div className="hidden items-center justify-between gap-4 md:flex">
            <Link href="/" className="font-semibold tracking-tight">
                {logoUrl ? (
                    <Image
                        src={logoUrl}
                        alt={siteSettings.logo?.alternativeText ?? siteSettings.siteName}
                        width={240}
                        height={96}
                        className="h-14 w-auto"
                        priority
                    />
                ) : (
                    siteSettings.siteName
                )}
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

            <div className="flex items-center gap-2">
                <ThemeToggle />
            </div>
        </div>
      </Container>
    </header>
  );
}