import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Container from "@/components/layout/Container";
import QuestPlayPanels from "@/components/play/QuestPlayPanels";
import QuestSessionHeartbeat from "@/components/play/QuestSessionHeartbeat";
import { getDictionary } from "@/lib/i18n";
import {
  getOwnedQuestSummaryForSession,
  resolvePlayerSessionFromCookies,
} from "@/lib/quests/questAccessSession";

type QuestPlayPageProps = {
  params: Promise<{
    questAccessId: string;
  }>;
  searchParams: Promise<{
    completed?: string;
  }>;
};

type QuestSummary = NonNullable<
  Awaited<ReturnType<typeof getOwnedQuestSummaryForSession>>
>;

function formatQuestDuration(
  startedAt: string,
  endedAt: string,
  lessThanMinuteLabel: string
) {
  const durationMs =
    new Date(endedAt).getTime() - new Date(startedAt).getTime();

  if (!Number.isFinite(durationMs) || durationMs < 60_000) {
    return lessThanMinuteLabel;
  }

  const totalMinutes = Math.floor(durationMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${totalMinutes} min`;
  }

  if (minutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${minutes} min`;
}

function getPrimaryAction(
  t: ReturnType<typeof getDictionary>,
  summary: QuestSummary,
  isCompleted: boolean
) {
  if (isCompleted) {
    return {
      href: "/quests",
      label: t.play.completedPrimaryCta,
    };
  }

  if (summary.completedStepsCount === 0 && summary.currentStepOrder <= 1) {
    return {
      href: summary.stepHref,
      label: t.play.startCta,
    };
  }

  return {
    href: summary.stepHref,
    label: t.play.resumeCta,
  };
}

function getProgressCopy(
  t: ReturnType<typeof getDictionary>,
  summary: QuestSummary,
  isCompleted: boolean
) {
  if (isCompleted) {
    return null;
  }

  if (summary.completedStepsCount === 0 && summary.currentStepOrder <= 1) {
    return {
      title: t.play.startTitle,
      body: t.play.startBody,
    };
  }

  return {
    title: t.play.resumeTitle,
    body: t.play.resumeBody,
  };
}

export default async function QuestPlayPage({
  params,
  searchParams,
}: QuestPlayPageProps) {
  const t = getDictionary();
  const { questAccessId } = await params;
  const resolvedSearchParams = await searchParams;
  const session = await resolvePlayerSessionFromCookies(await cookies());

  if (!session) {
    redirect("/redeem");
  }

  const summary = await getOwnedQuestSummaryForSession(
    session.session,
    questAccessId
  );

  if (!summary) {
    notFound();
  }

  const isCompleted =
    summary.progressStatus === "completed" ||
    resolvedSearchParams.completed === "1";
  const primaryAction = getPrimaryAction(t, summary, isCompleted);
  const progressCopy = getProgressCopy(t, summary, isCompleted);
  const totalDuration = isCompleted
    ? formatQuestDuration(
        summary.firstRedeemedAt,
        summary.lastCheckpointAt,
        t.play.durationLessThanMinute
      )
    : null;

  return (
    <Container className="space-y-8 py-8">
      <QuestSessionHeartbeat />

      <section className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            {t.play.unlockedEyebrow}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {summary.questTitle}
          </h1>
        </div>

        {summary.questDescription ? (
          <p className="max-w-3xl text-base text-muted-foreground">
            {summary.questDescription}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          {summary.questCity ? <span>{summary.questCity}</span> : null}
          {summary.questDifficulty ? <span>{`\u00b7 ${summary.questDifficulty}`}</span> : null}
          {summary.questDuration ? <span>{`\u00b7 ${summary.questDuration}`}</span> : null}
          {!isCompleted ? (
            <span>{`\u00b7 ${t.play.currentStepLabel} ${summary.currentStepOrder}`}</span>
          ) : null}
        </div>
      </section>

      <QuestPlayPanels
        questAccessId={summary.questAccessId}
        questSlug={summary.questSlug}
        isCompleted={isCompleted}
        completedStepsCount={summary.completedStepsCount}
        progressTitle={progressCopy?.title ?? t.play.resumeTitle}
        progressBody={progressCopy?.body ?? t.play.resumeBody}
        warningMessage={summary.warningMessage}
        totalDuration={totalDuration}
        primaryHref={primaryAction.href}
        primaryLabel={primaryAction.label}
      />
    </Container>
  );
}
