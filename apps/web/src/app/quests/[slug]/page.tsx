import Image from "next/image";
import Container from "@/components/layout/Container";
import { strapiFetch } from "@/lib/strapi/strapiFetch";
import PurchaseQuestButton from "@/components/quests/PurchaseQuestButton";

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
  const res = await strapiFetch<any>(
    `/quests?filters[slug][$eq]=${slug}&populate=*`
  );

  const quest = res?.data?.[0];

  if (!quest) return null;

  const raw = quest.attributes ?? quest;
  const image = raw?.coverImage?.data?.attributes ?? raw?.coverImage;

  return {
    title: raw.title,
    slug: raw.slug,
    description: raw.description,
    duration: raw.duration,
    difficulty: raw.difficulty,
    city: raw.city,
    price: raw.price,
    coverImage: image
      ? {
          url: image.url,
          alternativeText: image.alternativeText ?? "",
        }
      : undefined,
  };
}

export default async function QuestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const quest = await getQuest(slug);

  if (!quest) {
    return (
      <Container className="py-8">
        <h1 className="text-2xl font-semibold">Quête introuvable</h1>
      </Container>
    );
  }

  const cmsBaseUrl =
    process.env.CMS_URL ?? process.env.NEXT_PUBLIC_CMS_URL ?? "";

  const imageUrl = quest.coverImage?.url
    ? `${cmsBaseUrl.replace(/\/$/, "")}${quest.coverImage.url}`
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
        {quest.difficulty && <span>• {quest.difficulty}</span>}
        {quest.duration && <span>• {quest.duration}</span>}
        {typeof quest.price === "number" && <span>• CHF {quest.price}</span>}
      </div>

      {typeof quest.price === "number" ? (
        <div className="mt-6 flex flex-wrap gap-3">
            <PurchaseQuestButton questSlug={quest.slug} price={quest.price} />

            {process.env.NEXT_PUBLIC_ENABLE_DEV_PURCHASE_BYPASS === "true" ? (
            <a
                href="/debug/step"
                className="inline-flex rounded-md border border-border bg-card px-4 py-2 text-card-foreground hover:bg-muted"
            >
                Débloquer en mode dev
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