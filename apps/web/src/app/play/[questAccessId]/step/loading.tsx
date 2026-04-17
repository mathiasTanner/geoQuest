import Container from "@/components/layout/Container";
import { getDictionary } from "@/lib/i18n";

export default function QuestStepLoading() {
  const t = getDictionary();

  return (
    <Container className="py-12">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 text-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-lg font-medium">{t.step.progressing}</p>
      </div>
    </Container>
  );
}
