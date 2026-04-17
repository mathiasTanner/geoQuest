import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import Container from "@/components/layout/Container";
import QuestSessionHeartbeat from "@/components/play/QuestSessionHeartbeat";
import UnlockedQuestsPanel from "@/components/quests/UnlockedQuestsPanel";
import { getDictionary } from "@/lib/i18n";
import {
  listOwnedQuestSummariesForSession,
  resolvePlayerSessionFromCookies,
} from "@/lib/quests/questAccessSession";
import { getAllQuests } from "@/lib/strapi/quests";

export default async function QuestsPage() {
  const t = getDictionary();
  const session = await resolvePlayerSessionFromCookies(await cookies());
  const ownedQuests = session
    ? await listOwnedQuestSummariesForSession(session.session)
    : [];
  const quests = await getAllQuests();
  const cmsBaseUrl = process.env.CMS_URL ?? process.env.NEXT_PUBLIC_CMS_URL ?? "";

  return (
    <Container className="space-y-8 py-8">
      {ownedQuests.length > 0 ? <QuestSessionHeartbeat /> : null}

      <section className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">{t.quests.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{t.quests.intro}</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/redeem"
            className="inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground transition hover:bg-[var(--color-primary-hover)]"
          >
            {t.quests.redeemCta}
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t.quests.storeSectionTitle}
          </h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {t.quests.storeSectionBody}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

                <h3 className="text-lg font-semibold">{quest.title}</h3>

                {quest.city ? (
                  <p className="mt-1 text-sm text-muted-foreground">{quest.city}</p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
                  {quest.difficulty ? <span>{quest.difficulty}</span> : null}
                  {quest.duration ? <span>{`\u00b7 ${quest.duration}`}</span> : null}
                  {typeof quest.price === "number" ? (
                    <span>{`\u00b7 CHF ${quest.price}`}</span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <UnlockedQuestsPanel quests={ownedQuests} />
    </Container>
  );
}
