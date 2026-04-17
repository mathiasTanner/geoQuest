"use client";

import { useState } from "react";
import Link from "next/link";
import { getDictionary } from "@/lib/i18n";
import type { OwnedQuestSummary } from "@/lib/quests/questAccessSession";

type UnlockedQuestsPanelProps = {
  quests: OwnedQuestSummary[];
};

function getQuestActionLabel(
  t: ReturnType<typeof getDictionary>,
  quest: OwnedQuestSummary
) {
  if (quest.progressStatus === "completed") {
    return t.quests.reviewCompletedCta;
  }

  if (quest.completedStepsCount === 0 && quest.currentStepOrder <= 1) {
    return t.play.startCta;
  }

  return t.play.resumeCta;
}

export default function UnlockedQuestsPanel({
  quests,
}: UnlockedQuestsPanelProps) {
  const t = getDictionary();
  const [expanded, setExpanded] = useState(false);

  if (quests.length === 0) {
    return null;
  }

  return (
    <section id="unlocked-quests" className="space-y-4">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="inline-flex rounded-md border border-border bg-card px-4 py-2 text-card-foreground transition hover:bg-muted"
      >
        {t.quests.unlockedListCta}
      </button>

      {expanded ? (
        <div className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              {t.quests.unlockedSectionTitle}
            </h2>
            <p className="max-w-3xl text-sm text-muted-foreground">
              {t.quests.unlockedSectionBody}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {quests.map((quest) => (
              <article
                key={quest.questAccessId}
                className="space-y-4 rounded-lg border border-border bg-background p-5"
              >
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">{quest.questTitle}</h3>
                  {quest.questDescription ? (
                    <p className="text-sm text-muted-foreground">
                      {quest.questDescription}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span>{`${t.quests.currentStepLabel} ${quest.currentStepOrder}`}</span>
                  <span>{`\u00b7 ${quest.completedStepsCount} ${t.quests.completedStepsLabel}`}</span>
                  {quest.questCity ? <span>{`\u00b7 ${quest.questCity}`}</span> : null}
                </div>

                {quest.warningMessage ? (
                  <div className="rounded-md border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                    {quest.warningMessage}
                  </div>
                ) : null}

                <Link
                  href={quest.playHref}
                  className="inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground transition hover:bg-[var(--color-primary-hover)]"
                >
                  {getQuestActionLabel(t, quest)}
                </Link>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
