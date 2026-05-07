import type { Metadata } from "next";
import ContentPageView from "@/components/content/ContentPageView";
import { getDictionary } from "@/lib/i18n";
import type { ContentPage } from "@/lib/strapi/contentPages";
import { getHowItWorksPage } from "@/lib/strapi/contentPages";

export const dynamic = "force-dynamic";

async function loadHowItWorksPage(): Promise<ContentPage> {
  const t = getDictionary();

  try {
    const page = await getHowItWorksPage();

    if (page.title) {
      return page;
    }
  } catch {
    // Render a graceful placeholder until the CMS content is ready.
  }

  return {
    title: t.contentPages.howItWorksFallbackTitle,
    subtitle: t.contentPages.unavailableSubtitle,
    blocks: [],
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await loadHowItWorksPage();

  return {
    title: page.title,
    description: page.subtitle,
  };
}

export default async function HowItWorksPage() {
  const page = await loadHowItWorksPage();

  const cmsBaseUrl = process.env.CMS_URL ?? process.env.NEXT_PUBLIC_CMS_URL ?? "";

  return <ContentPageView page={page} cmsBaseUrl={cmsBaseUrl} />;
}
