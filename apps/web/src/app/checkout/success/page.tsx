import { SuccessStatus } from "@/components/checkout/success-status";
import { getDictionary } from "@/lib/i18n";

type CheckoutSuccessPageProps = {
  searchParams: Promise<{
    session_id?: string
  }>
}

export default async function CheckoutSuccessPage({
  searchParams,
}: CheckoutSuccessPageProps) {
  const params = await searchParams
  const sessionId = params.session_id

  const dict = getDictionary("fr")

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="w-full rounded-2xl border p-8 shadow-sm">
        <div className="mb-6 text-5xl">✅</div>

        <h1 className="text-3xl font-bold tracking-tight">
          {dict.checkoutSuccess.title}
        </h1>

        <p className="mt-4 text-base text-muted-foreground">
          {dict.checkoutSuccess.intro}
        </p>

        <p className="mt-2 text-base text-muted-foreground">
          {dict.checkoutSuccess.emailNotice}
        </p>

        {sessionId ? (
            <SuccessStatus sessionId={sessionId} />
        ) : (
          <p className="mt-6 text-sm text-amber-600">
            {dict.checkoutSuccess.missingSession}
          </p>
        )}
      </div>
    </main>
  )
}