import Link from "next/link";
import Image from "next/image";
import Container from "@/components/layout/Container";
import { getAllQuests } from "@/lib/strapi/quests";

export default async function QuestsPage() {
  const quests = await getAllQuests();

  const cmsBaseUrl = process.env.CMS_URL ?? process.env.NEXT_PUBLIC_CMS_URL ?? "";

  return (
    <Container className="py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Quêtes</h1>
      <p className="mt-3 text-muted-foreground">
        Découvrez nos aventures et choisissez votre prochaine quête.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quests.map((quest) => {
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
                <Image
                  src={coverImageUrl}
                  alt={quest.coverImage?.alternativeText ?? quest.title}
                  width={1200}
                  height={800}
                  className="mb-4 h-48 w-full rounded-md object-cover"
                />
              ) : null}

              <h2 className="text-lg font-semibold">{quest.title}</h2>

              {quest.city ? (
                <p className="mt-1 text-sm text-muted-foreground">{quest.city}</p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
                {quest.difficulty && <span>{quest.difficulty}</span>}
                {quest.duration && <span>• {quest.duration}</span>}
                {typeof quest.price === "number" && <span>• CHF {quest.price}</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </Container>
  );
}