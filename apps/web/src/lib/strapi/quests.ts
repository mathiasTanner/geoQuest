import { strapiFetch } from "./strapiFetch";

export type Quest = {
  title: string;
  slug: string;
  description?: string;
  coverImage?: {
    url: string;
    alternativeText?: string;
  };
  duration?: string;
  difficulty?: "easy" | "medium" | "hard";
  city?: string;
  price?: number;
  isFeatured?: boolean;
  stepCount?: number;
};

type StrapiQuestResponse = {
  data?: any[];
};

function normalizeQuest(raw: any): Quest {
  const quest = raw.attributes ?? raw;

  const image = quest?.coverImage?.data?.attributes ?? quest?.coverImage;
  const questSteps = Array.isArray(quest?.quest_steps?.data)
    ? quest.quest_steps.data
    : Array.isArray(quest?.quest_steps)
      ? quest.quest_steps
      : [];

  return {
    title: quest?.title ?? "",
    slug: quest?.slug ?? "",
    description: quest?.description ?? "",
    duration: quest?.duration ?? "",
    difficulty: quest?.difficulty,
    city: quest?.city ?? "",
    price: quest?.price,
    isFeatured: quest?.isFeatured ?? false,
    stepCount: questSteps.length,
    coverImage: image
      ? {
          url: image.url,
          alternativeText: image.alternativeText ?? "",
        }
      : undefined,
  };
}

export async function getFeaturedQuests(): Promise<Quest[]> {
  const res = await strapiFetch<StrapiQuestResponse>(
    "/quests?status=published&filters[isFeatured][$eq]=true&filters[quest_steps][order][$notNull]=true&filters[quest_steps][publishedAt][$notNull]=true&sort[0]=publishedAt:desc&pagination[pageSize]=100&populate=*",
    { revalidate: 0 }
  );

  const quests = res?.data ?? [];

  return quests.map(normalizeQuest).filter((quest) => (quest.stepCount ?? 0) > 0);
}

export async function getAllQuests(): Promise<Quest[]> {
  const res = await strapiFetch<StrapiQuestResponse>(
    "/quests?status=published&filters[quest_steps][order][$notNull]=true&filters[quest_steps][publishedAt][$notNull]=true&sort[0]=publishedAt:desc&pagination[pageSize]=100&populate=*",
    { revalidate: 0 }
  );
  const quests = res?.data ?? [];
  return quests.map(normalizeQuest).filter((quest) => (quest.stepCount ?? 0) > 0);
}
