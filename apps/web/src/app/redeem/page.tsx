import Container from "@/components/layout/Container";
import RedeemForm from "@/components/redeem/RedeemForm";
import { getDictionary } from "@/lib/i18n";

type RedeemPageProps = {
  searchParams: Promise<{
    code?: string;
  }>;
};

export default async function RedeemPage({
  searchParams,
}: RedeemPageProps) {
  const t = getDictionary();
  const params = await searchParams;
  const initialCode = params.code ?? "";

  return (
    <Container className="py-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t.redeem.title}
      </h1>

      <p className="mt-3 text-muted-foreground">{t.redeem.intro}</p>

      <RedeemForm initialCode={initialCode} />
    </Container>
  );
}
