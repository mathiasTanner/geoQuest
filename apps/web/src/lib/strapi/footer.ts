import { strapiFetch } from "./strapiFetch";

export type FooterLink = {
  label: string;
  href: string;
};

export type SiteFooter = {
  brandName: string;
  tagline?: string;
  copyrightText?: string;
  links: FooterLink[];
};

type StrapiFooterResponse = {
  data?: any;
};

function normalizeFooter(json: StrapiFooterResponse): SiteFooter {
  const raw =
    json?.data?.attributes ??
    json?.data ??
    {};

  const links = Array.isArray(raw?.links)
    ? raw.links
        .map((link: any) => ({
          label: String(link?.label ?? ""),
          href: String(link?.href ?? ""),
        }))
        .filter((link: FooterLink) => link.label && link.href)
    : [];

  return {
    brandName: String(raw?.brandName ?? "GeoQuest"),
    tagline: raw?.tagline ? String(raw.tagline) : undefined,
    copyrightText: raw?.copyrightText ? String(raw.copyrightText) : undefined,
    links,
  };
}

export async function getSiteFooter(): Promise<SiteFooter> {
  const json = await strapiFetch<StrapiFooterResponse>(
    "/site-footer?populate[links]=*",
    { revalidate: 60 }
  );

  return normalizeFooter(json);
}