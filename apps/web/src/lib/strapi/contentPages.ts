import { strapiFetch } from "./strapiFetch";

export type ContentPageMedia = {
  url: string;
  alternativeText?: string;
  mime?: string;
  width?: number;
  height?: number;
};

export type RichTextBlock = {
  __component: "shared.rich-text";
  body: string;
};

export type MediaBlock = {
  __component: "shared.media";
  file?: ContentPageMedia;
};

export type QuoteBlock = {
  __component: "shared.quote";
  title?: string;
  body?: string;
};

export type SliderBlock = {
  __component: "shared.slider";
  files: ContentPageMedia[];
};

export type ContentPageBlock =
  | RichTextBlock
  | MediaBlock
  | QuoteBlock
  | SliderBlock;

export type ContentPage = {
  title: string;
  subtitle?: string;
  blocks: ContentPageBlock[];
};

type StrapiContentPageResponse = {
  data?: any;
};

function unwrapMedia(raw: any): ContentPageMedia | undefined {
  const media =
    raw?.data?.attributes ??
    raw?.data ??
    raw?.attributes ??
    raw;

  if (!media?.url) {
    return undefined;
  }

  return {
    url: String(media.url),
    alternativeText: media.alternativeText
      ? String(media.alternativeText)
      : undefined,
    mime: media.mime ? String(media.mime) : undefined,
    width: typeof media.width === "number" ? media.width : undefined,
    height: typeof media.height === "number" ? media.height : undefined,
  };
}

function unwrapMediaArray(raw: any): ContentPageMedia[] {
  const entries = Array.isArray(raw?.data)
    ? raw.data
    : Array.isArray(raw)
      ? raw
      : [];

  return entries
    .map(unwrapMedia)
    .filter((entry: ContentPageMedia | undefined): entry is ContentPageMedia =>
      Boolean(entry)
    );
}

function normalizeBlock(raw: any): ContentPageBlock | null {
  const component = String(raw?.__component ?? "");

  switch (component) {
    case "shared.rich-text":
      return {
        __component: "shared.rich-text",
        body: String(raw?.body ?? ""),
      };
    case "shared.media":
      return {
        __component: "shared.media",
        file: unwrapMedia(raw?.file),
      };
    case "shared.quote":
      return {
        __component: "shared.quote",
        title: raw?.title ? String(raw.title) : undefined,
        body: raw?.body ? String(raw.body) : undefined,
      };
    case "shared.slider":
      return {
        __component: "shared.slider",
        files: unwrapMediaArray(raw?.files),
      };
    default:
      return null;
  }
}

function normalizeContentPage(json: StrapiContentPageResponse): ContentPage {
  const raw = json?.data?.attributes ?? json?.data ?? {};
  const blocks = Array.isArray(raw?.blocks) ? raw.blocks : [];

  return {
    title: String(raw?.title ?? ""),
    subtitle: raw?.subtitle ? String(raw.subtitle) : undefined,
    blocks: blocks
      .map(normalizeBlock)
      .filter((block: ContentPageBlock | null): block is ContentPageBlock =>
        Boolean(block)
      ),
  };
}

async function getContentPage(path: string): Promise<ContentPage> {
  const mediaFields = [
    "url",
    "alternativeText",
    "mime",
    "width",
    "height",
  ];
  const sharedMediaPopulate = mediaFields
    .map(
      (field, index) =>
        `populate[blocks][on][shared.media][populate][file][fields][${index}]=${field}`
    )
    .join("&");
  const sharedSliderPopulate = mediaFields
    .map(
      (field, index) =>
        `populate[blocks][on][shared.slider][populate][files][fields][${index}]=${field}`
    )
    .join("&");
  const json = await strapiFetch<StrapiContentPageResponse>(
    `${path}?populate[blocks][on][shared.rich-text][populate]=true&populate[blocks][on][shared.quote][populate]=true&${sharedMediaPopulate}&${sharedSliderPopulate}`
  );

  return normalizeContentPage(json);
}

export async function getAboutPage() {
  return getContentPage("/about");
}

export async function getHowItWorksPage() {
  return getContentPage("/how-it-works");
}
