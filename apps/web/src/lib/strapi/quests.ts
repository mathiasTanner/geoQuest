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
};

type StrapiQuestResponse = {
  data?: any[];
};

function normalizeQuest(raw: any): Quest {
  const quest = raw.attributes ?? raw;

  const image = quest?.coverImage?.data?.attributes ?? quest?.coverImage;

  return {
    title: quest?.title ?? "",
    slug: quest?.slug ?? "",
    description: quest?.description ?? "",
    duration: quest?.duration ?? "",
    difficulty: quest?.difficulty,
    city: quest?.city ?? "",
    price: quest?.price,
    isFeatured: quest?.isFeatured ?? false,
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
    "/quests?filters[isFeatured]=true&populate=*"
  );

  const quests = res?.data ?? [];

  return quests.map(normalizeQuest);
}

export async function getAllQuests(): Promise<Quest[]> {
  const res = await strapiFetch<StrapiQuestResponse>("/quests?populate=*");
  const quests = res?.data ?? [];
  return quests.map(normalizeQuest);
}