import Link from "next/link";
import Image from "next/image";
import Container from "@/components/layout/Container";
import { getHomePage } from "@/lib/strapi/homePage";
import { getFeaturedQuests } from "@/lib/strapi/quests";

export default async function HomePage() {
  const page = await getHomePage();
  const featuredQuests = await getFeaturedQuests();

  const cmsBaseUrl = process.env.CMS_URL ?? process.env.NEXT_PUBLIC_CMS_URL ?? "";
  const heroImageUrl = page.heroImage?.url
    ? `${cmsBaseUrl.replace(/\/$/, "")}${page.heroImage.url}`
    : null;

  return (
    <Container className="py-8">
      <section className="grid gap-8 md:grid-cols-2 md:items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
            {page.heroTitle}
          </h1>

          {page.heroSubtitle ? (
            <p className="mt-4 text-base text-muted-foreground md:text-lg">
              {page.heroSubtitle}
            </p>
          ) : null}

          {page.heroCtaLabel && page.heroCtaHref ? (
            <div className="mt-6">
              <Link
                href={page.heroCtaHref}
                className="inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-[var(--color-primary-hover)]"
              >
                {page.heroCtaLabel}
              </Link>
            </div>
          ) : null}
        </div>

        <div>
          {heroImageUrl ? (
            <Image
              src={heroImageUrl}
              alt={page.heroImage?.alternativeText ?? page.heroTitle}
              width={1200}
              height={800}
              className="w-full rounded-lg border border-border object-cover"
              priority
            />
          ) : null}
        </div>
      </section>
      <section className="mt-12">
        {page.featuredQuestsTitle ? (
          <h2 className="text-2xl font-semibold tracking-tight">
            {page.featuredQuestsTitle}
          </h2>
        ) : null}

        {page.featuredQuestsSubtitle ? (
          <p className="mt-3 text-muted-foreground">
            {page.featuredQuestsSubtitle}
          </p>
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featuredQuests.map((quest) => {
            const coverImageUrl = quest.coverImage?.url
              ? `${cmsBaseUrl.replace(/\/$/, "")}${quest.coverImage.url}`
              : null;

            return (
              <Link
                key={quest.slug}
                href={`/quests/${quest.slug}`}
                className="block rounded-lg border border-border bg-card p-4 transition hover:bg-muted"
              >
                {coverImageUrl ? (
                  <img
                    src={coverImageUrl}
                    alt={quest.coverImage?.alternativeText ?? quest.title}
                    className="mb-4 h-48 w-full rounded-md object-cover"
                  />
                ) : null}

                <h3 className="text-lg font-semibold">{quest.title}</h3>

                {quest.city ? (
                  <p className="mt-1 text-sm text-muted-foreground">{quest.city}</p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
                  {quest.difficulty ? <span>{quest.difficulty}</span> : null}
                  {quest.duration ? <span>• {quest.duration}</span> : null}
                  {typeof quest.price === "number" ? <span>• CHF {quest.price}</span> : null}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </Container>
  );
}