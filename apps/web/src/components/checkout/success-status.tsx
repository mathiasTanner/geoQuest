"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getDictionary } from "@/lib/i18n"

type Props = {
  sessionId: string
}

type SessionStatusResponse =
  | {
      status: "processing"
    }
  | {
      status: "confirmed"
      redemptionCode: string
      questTitle?: string
    }
  | {
      status: "missing_session"
    }
  | {
      status: "error"
      message?: string
    }

export function SuccessStatus({ sessionId }: Props) {
  const dict = getDictionary()
  const [data, setData] = useState<SessionStatusResponse | null>(null)
  const [hasTimedOut, setHasTimedOut] = useState(false)

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined
    let attempts = 0
    const maxAttempts = 5

    const fetchStatus = async () => {
      try {
        attempts += 1

        const res = await fetch(
          `/api/stripe/checkout/session-status?session_id=${encodeURIComponent(sessionId)}`
        )

        const text = await res.text()

        try {
          const json = JSON.parse(text) as SessionStatusResponse
          setData(json)

          if (json.status === "confirmed" || json.status === "error") {
            if (interval) clearInterval(interval)
            return
          }

          if (attempts >= maxAttempts) {
            setHasTimedOut(true)
            if (interval) clearInterval(interval)
          }
        } catch {
          console.error("Non-JSON response from session-status API:", text)
          setData({
            status: "error",
            message: dict.checkoutSuccess.invalidApiResponse,
          })
          if (interval) clearInterval(interval)
        }
      } catch (error) {
        console.error("Failed to fetch session status:", error)
        setData({
          status: "error",
          message: dict.checkoutSuccess.fetchError,
        })
        if (interval) clearInterval(interval)
      }
    }

    fetchStatus()
    interval = setInterval(fetchStatus, 2000)

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [sessionId, dict.checkoutSuccess.fetchError, dict.checkoutSuccess.invalidApiResponse])

  if (!data || data.status === "processing") {
    return (
      <div className="mt-6">
        <p className="text-sm text-muted-foreground">
          {hasTimedOut
            ? dict.checkoutSuccess.processingDelay
            : dict.checkoutSuccess.loading}
        </p>
      </div>
    )
  }

  if (data.status === "confirmed") {
    return (
      <div className="mt-6 space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">
            {dict.checkoutSuccess.codeLabel}
          </p>
          <p className="mt-2 font-mono text-lg font-semibold">
            {data.redemptionCode}
          </p>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">
            {dict.checkoutSuccess.referenceLabel}
          </p>
          <p className="mt-2 break-all text-sm font-medium">
            {sessionId}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {dict.checkoutSuccess.supportHint}
          </p>
        </div>

        <div>
          <Link
            href={`/redeem?code=${encodeURIComponent(data.redemptionCode)}`}
            className="inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            {dict.checkoutSuccess.redeemCta}
          </Link>
        </div>
      </div>
    )
  }

  if (data.status === "error") {
    return (
      <p className="mt-6 text-sm text-red-600">
        {data.message ?? dict.checkoutSuccess.genericError}
      </p>
    )
  }

  return null
}