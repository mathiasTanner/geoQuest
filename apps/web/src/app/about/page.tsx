import type { Metadata } from "next";
import ContentPageView from "@/components/content/ContentPageView";
import { getDictionary } from "@/lib/i18n";
import type { ContentPage } from "@/lib/strapi/contentPages";
import { getAboutPage } from "@/lib/strapi/contentPages";

export const dynamic = "force-dynamic";

async function loadAboutPage(): Promise<ContentPage> {
  const t = getDictionary();

  try {
    const page = await getAboutPage();

    if (page.title) {
      return page;
    }
  } catch {
    // Render a graceful placeholder until the CMS content is ready.
  }

  return {
    title: t.contentPages.aboutFallbackTitle,
    subtitle: t.contentPages.unavailableSubtitle,
    blocks: [],
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await loadAboutPage();

  return {
    title: page.title,
    description: page.subtitle,
  };
}

export default async function AboutPage() {
  const page = await loadAboutPage();

  const cmsBaseUrl = process.env.CMS_URL ?? process.env.NEXT_PUBLIC_CMS_URL ?? "";

  return <ContentPageView page={page} cmsBaseUrl={cmsBaseUrl} />;
}
