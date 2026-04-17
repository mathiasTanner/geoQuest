import { strapiFetch } from "./strapiFetch";

export type SiteSettings = {
  siteName: string;
  logo?: {
    url: string;
    alternativeText?: string;
  };
  favicon?: {
    url: string;
  };
  defaultSeoTitle?: string;
  defaultSeoDescription?: string;
};

type StrapiSiteSettingsResponse = {
  data?: any;
};

function normalizeSiteSettings(json: StrapiSiteSettingsResponse): SiteSettings {
  const raw =
    json?.data?.attributes ??
    json?.data ??
    {};

  const logo = raw?.logo?.data?.attributes ?? raw?.logo;
  const favicon = raw?.favicon?.data?.attributes ?? raw?.favicon;

  return {
    siteName: String(raw?.siteName ?? "GeoQuest"),
    logo: logo
      ? {
          url: logo.url,
          alternativeText: logo.alternativeText ?? "Logo",
        }
      : undefined,
    favicon: favicon
      ? {
          url: favicon.url,
        }
      : undefined,
    defaultSeoTitle: raw?.defaultSeoTitle
        ? String(raw.defaultSeoTitle)
        : undefined,
    defaultSeoDescription: raw?.defaultSeoDescription
        ? String(raw.defaultSeoDescription)
        : undefined,
  };
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const json = await strapiFetch<StrapiSiteSettingsResponse>(
    "/site-setting?populate=*",
    { revalidate: 60 }
  );

  return normalizeSiteSettings(json);
}