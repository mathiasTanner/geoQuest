import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import Container from "@/components/layout/Container";
import PurchaseQuestButton from "@/components/quests/PurchaseQuestButton";
import { getDictionary } from "@/lib/i18n";
import {
  getOwnedQuestSummaryForSessionByQuestSlug,
  resolvePlayerSessionFromCookies,
} from "@/lib/quests/questAccessSession";
import { getQuestBySlug } from "@/lib/strapi/quests";

type Quest = {
  title: string;
  slug: string;
  description?: string;
  coverImage?: {
    url: string;
    alternativeText?: string;
  };
  duration?: string;
  difficulty?: string;
  city?: string;
  price?: number;
};

async function getQuest(slug: string): Promise<Quest | null> {
  return getQuestBySlug(slug);
}

export const dynamic = "force-dynamic";

export default async function QuestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const t = getDictionary();
  const { slug } = await params;
  const session = await resolvePlayerSessionFromCookies(await cookies());
  const quest = await getQuest(slug);
  const ownedQuest =
    session && quest
      ? await getOwnedQuestSummaryForSessionByQuestSlug(session.session, slug)
      : null;

  if (!quest) {
    return (
      <Container className="py-8">
        <h1 className="text-2xl font-semibold">{t.quests.notFound}</h1>
      </Container>
    );
  }

  const cmsBaseUrl =
    process.env.CMS_URL ?? process.env.NEXT_PUBLIC_CMS_URL ?? "";

  const imageUrl = quest.coverImage?.url
    ? `${cmsBaseUrl.replace(/\/$/, "")}${quest.coverImage.url}`
    : null;
  const ownedQuestLabel = ownedQuest
    ? ownedQuest.progressStatus === "completed"
      ? t.quests.reviewCompletedCta
      : ownedQuest.completedStepsCount === 0 && ownedQuest.currentStepOrder <= 1
        ? t.play.startCta
        : t.play.resumeCta
    : null;

  return (
    <Container className="py-8">
      <h1 className="text-3xl font-semibold">{quest.title}</h1>

      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={quest.coverImage?.alternativeText ?? quest.title}
          width={1200}
          height={800}
          className="mt-6 w-full rounded-lg border border-border object-cover"
        />
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
        {quest.city && <span>{quest.city}</span>}
        {quest.difficulty && <span>{`\u00b7 ${quest.difficulty}`}</span>}
        {quest.duration && <span>{`\u00b7 ${quest.duration}`}</span>}
        {typeof quest.price === "number" && <span>{`\u00b7 CHF ${quest.price}`}</span>}
      </div>

      {typeof quest.price === "number" ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <PurchaseQuestButton questSlug={quest.slug} price={quest.price} />

          {ownedQuest ? (
            <Link
              href={ownedQuest.playHref}
              className="inline-flex rounded-md border border-border bg-card px-4 py-2 text-card-foreground hover:bg-muted"
            >
              {ownedQuestLabel}
            </Link>
          ) : null}

          {process.env.NEXT_PUBLIC_ENABLE_DEV_PURCHASE_BYPASS === "true" ? (
            <a
              href="/debug/step"
              className="inline-flex rounded-md border border-border bg-card px-4 py-2 text-card-foreground hover:bg-muted"
            >
              {t.quests.devBypassCta}
            </a>
          ) : null}
        </div>
      ) : null}

      {quest.description && (
        <div className="mt-6 max-w-prose">{quest.description}</div>
      )}
    </Container>
  );
}
