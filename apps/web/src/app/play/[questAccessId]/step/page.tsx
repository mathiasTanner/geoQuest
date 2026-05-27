import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Container from "@/components/layout/Container";
import QuestSessionHeartbeat from "@/components/play/QuestSessionHeartbeat";
import QuestStepPlayer from "@/components/play/QuestStepPlayer";
import {
  getCurrentStepForOwnedQuest,
  resolvePlayerSessionFromCookies,
} from "@/lib/quests/questAccessSession";

type QuestStepPageProps = {
  params: Promise<{
    questAccessId: string;
  }>;
};

export default async function QuestStepPage({ params }: QuestStepPageProps) {
  const { questAccessId } = await params;
  const session = await resolvePlayerSessionFromCookies(await cookies());

  if (!session) {
    redirect("/redeem");
  }

  const currentStep = await getCurrentStepForOwnedQuest(
    session.session,
    questAccessId
  );

  if (!currentStep) {
    notFound();
  }

  if (currentStep.summary.progressStatus === "completed") {
    redirect(currentStep.summary.playHref);
  }

  return (
    <Container className="py-8">
      <QuestSessionHeartbeat />
      <QuestStepPlayer
        key={currentStep.step.documentId}
        questAccessId={currentStep.summary.questAccessId}
        questTitle={currentStep.summary.questTitle}
        warningMessage={currentStep.summary.warningMessage}
        restartCurrentStep={currentStep.summary.restartCurrentStep}
        version={currentStep.summary.version}
        step={currentStep.step}
      />
    </Container>
  );
}
