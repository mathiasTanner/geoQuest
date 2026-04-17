import { strapiFetch } from "./strapiFetch";

export type HomePage = {
  heroTitle: string;
  heroSubtitle?: string;
  heroCtaLabel?: string;
  heroCtaHref?: string;
  heroImage?: {
    url: string;
    alternativeText?: string;
  };
  featuredQuestsTitle?: string;
  featuredQuestsSubtitle?: string;
};

type StrapiHomePageResponse = {
  data?: any;
};

function normalizeHomePage(json: StrapiHomePageResponse): HomePage {
  const raw =
    json?.data?.attributes ??
    json?.data ??
    {};

  const heroImage = raw?.heroImage?.data?.attributes ?? raw?.heroImage;

  return {
    heroTitle: raw?.heroTitle ?? "",
    heroSubtitle: raw?.heroSubtitle ?? "",
    heroCtaLabel: raw?.heroCtaLabel ?? "",
    heroCtaHref: raw?.heroCtaHref ?? "",
    heroImage: heroImage
      ? {
          url: heroImage.url,
          alternativeText: heroImage.alternativeText ?? "",
        }
      : undefined,
    featuredQuestsTitle: raw?.featuredQuestsTitle ?? "",
    featuredQuestsSubtitle: raw?.featuredQuestsSubtitle ?? "",
  };
}

export async function getHomePage(): Promise<HomePage> {
  const json = await strapiFetch<StrapiHomePageResponse>(
    "/home?populate=*"
  );

  return normalizeHomePage(json);
}