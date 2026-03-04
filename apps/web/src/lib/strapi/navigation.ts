import { strapiFetch } from "./strapiFetch";

export type NavLink = { label: string; href: string };
export type NavItem = { label: string; href?: string; children?: NavLink[] };

type StrapiNavigationResponse = {
  data?: any; // we normalize because Strapi v5/v4 shapes differ by config
};

function normalizeNavigation(json: StrapiNavigationResponse): NavItem[] {
  // Try common shapes:
  // v4 single type: { data: { attributes: { items: [...] } } }
  // v5 often:       { data: { items: [...] } } or similar, depending on plugin/config
  const items =
    json?.data?.attributes?.items ??
    json?.data?.items ??
    json?.items ??
    [];

  if (!Array.isArray(items)) return [];

  return items
    .map((it: any) => ({
      label: String(it?.label ?? ""),
      href: it?.href ? String(it.href) : undefined,
      children: Array.isArray(it?.children)
        ? it.children
            .map((c: any) => ({
              label: String(c?.label ?? ""),
              href: String(c?.href ?? ""),
            }))
            .filter((c: any) => c.label && c.href)
        : [],
    }))
    .filter((it: any) => it.label);
}

export async function getNavigation(): Promise<NavItem[]> {
  // populate children components
  const json = await strapiFetch(
    "/navigation?populate[items][populate][children]=*",
    { revalidate: 60 }
  );
  return normalizeNavigation(json);
}