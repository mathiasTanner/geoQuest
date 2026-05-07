import Image from "next/image";
import Container from "@/components/layout/Container";
import type {
  ContentPage,
  ContentPageMedia,
} from "@/lib/strapi/contentPages";

type ContentPageViewProps = {
  page: ContentPage;
  cmsBaseUrl: string;
};

function buildMediaUrl(cmsBaseUrl: string, media?: ContentPageMedia) {
  if (!media?.url) {
    return null;
  }

  if (media.url.startsWith("http://") || media.url.startsWith("https://")) {
    return media.url;
  }

  return `${cmsBaseUrl.replace(/\/$/, "")}${media.url}`;
}

function sanitizeRichHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<(svg|math)[\s\S]*?>[\s\S]*?<\/\1>/gi, "")
    .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\sstyle=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\shref=(["'])\s*javascript:[\s\S]*?\1/gi, ' href="#"')
    .replace(/\ssrc=(["'])\s*javascript:[\s\S]*?\1/gi, "")
    .replace(/<(?!\/?(p|br|strong|em|ul|ol|li|a|blockquote|h2|h3)\b)[^>]*>/gi, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineMarkdownToHtml(value: string) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function renderRichText(body: string) {
  const trimmed = body.trim();

  if (!trimmed) {
    return "";
  }

  if (/[<][a-z!/]/i.test(trimmed)) {
    return sanitizeRichHtml(trimmed);
  }

  const blocks = trimmed.split(/\n\s*\n/);

  return blocks
    .map((block) => {
      const normalized = block.trim();

      if (!normalized) {
        return "";
      }

      if (normalized.startsWith("### ")) {
        return `<h3>${inlineMarkdownToHtml(normalized.slice(4))}</h3>`;
      }

      if (normalized.startsWith("## ")) {
        return `<h2>${inlineMarkdownToHtml(normalized.slice(3))}</h2>`;
      }

      if (normalized.startsWith("- ")) {
        const items = normalized
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.startsWith("- "))
          .map((line) => `<li>${inlineMarkdownToHtml(line.slice(2))}</li>`)
          .join("");

        return `<ul>${items}</ul>`;
      }

      return `<p>${normalized
        .split("\n")
        .map((line) => inlineMarkdownToHtml(line.trim()))
        .join("<br />")}</p>`;
    })
    .join("");
}

function ContentImage({
  alt,
  media,
  pageTitle,
  className,
  cmsBaseUrl,
}: {
  alt?: string;
  media?: ContentPageMedia;
  pageTitle: string;
  className: string;
  cmsBaseUrl: string;
}) {
  const mediaUrl = buildMediaUrl(cmsBaseUrl, media);
  const normalizedCmsBase = cmsBaseUrl.replace(/\/$/, "");
  const canOptimizeWithNextImage =
    Boolean(media?.width && media?.height) &&
    (!normalizedCmsBase || mediaUrl?.startsWith(normalizedCmsBase));

  if (!mediaUrl) {
    return null;
  }

  if (canOptimizeWithNextImage && media?.width && media?.height) {
    return (
      <Image
        src={mediaUrl}
        alt={alt ?? pageTitle}
        width={media.width}
        height={media.height}
        className={className}
      />
    );
  }

  return <img src={mediaUrl} alt={alt ?? pageTitle} className={className} />;
}

export default function ContentPageView({
  page,
  cmsBaseUrl,
}: ContentPageViewProps) {
  return (
    <Container className="py-8 md:py-12">
      <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm md:p-10">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
            {page.title}
          </h1>
          {page.subtitle ? (
            <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
              {page.subtitle}
            </p>
          ) : null}
        </div>
        <div className="mt-8 md:mt-10">
          <div className="space-y-8 md:space-y-10">
            {page.blocks.map((block, index) => {
              if (block.__component === "shared.rich-text") {
                return (
                  <article key={`${block.__component}-${index}`}>
                    <div
                      className="text-base leading-relaxed text-foreground/90 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-4 [&_strong]:font-semibold"
                      dangerouslySetInnerHTML={{ __html: renderRichText(block.body) }}
                    />
                  </article>
                );
              }

              if (block.__component === "shared.quote") {
                return (
                  <blockquote
                    key={`${block.__component}-${index}`}
                    className="rounded-[1.5rem] border border-accent/30 bg-accent/10 p-6 md:p-8"
                  >
                    {block.title ? (
                      <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent-foreground/80">
                        {block.title}
                      </p>
                    ) : null}
                    {block.body ? (
                      <p className="mt-3 text-xl leading-relaxed text-foreground md:text-2xl">
                        "{block.body}"
                      </p>
                    ) : null}
                  </blockquote>
                );
              }

              if (block.__component === "shared.media") {
                if (!buildMediaUrl(cmsBaseUrl, block.file)) {
                  return null;
                }

                return (
                  <div
                    key={`${block.__component}-${index}`}
                    className="overflow-hidden rounded-[1.5rem] bg-muted"
                  >
                    <ContentImage
                      media={block.file}
                      alt={block.file?.alternativeText}
                      pageTitle={page.title}
                      cmsBaseUrl={cmsBaseUrl}
                      className="h-auto w-full object-cover"
                    />
                  </div>
                );
              }

              if (block.__component === "shared.slider") {
                if (block.files.length === 0) {
                  return null;
                }

                return (
                  <div
                    key={`${block.__component}-${index}`}
                    className="grid gap-4 md:grid-cols-2"
                  >
                    {block.files.map((file, fileIndex) => {
                      const mediaUrl = buildMediaUrl(cmsBaseUrl, file);

                      if (!mediaUrl) {
                        return null;
                      }

                      return (
                        <div
                          key={`${mediaUrl}-${fileIndex}`}
                          className="overflow-hidden rounded-[1.25rem] bg-muted"
                        >
                          <ContentImage
                            media={file}
                            alt={file.alternativeText}
                            pageTitle={page.title}
                            cmsBaseUrl={cmsBaseUrl}
                            className="h-72 w-full object-cover"
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>
      </section>
    </Container>
  );
}
