import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id")

  console.log("session-status: sessionId =", sessionId)

  if (!sessionId) {
    return NextResponse.json({ status: "missing_session" }, { status: 400 })
  }

  try {
    if (!process.env.CMS_URL) {
        throw new Error("CMS_URL is not defined")
    }
    const url = `${process.env.CMS_URL}/api/quest-purchases?filters[stripeSessionId][$eq]=${sessionId}&populate=quest`

    console.log("session-status: fetching from Strapi:", url)

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`,
      },
      cache: "no-store",
    })

    console.log("session-status: Strapi response status:", res.status)

    const text = await res.text()

    console.log("session-status: raw response:", text)

    const data = JSON.parse(text)

    const purchase = data?.data?.[0]

    if (!purchase) {
      return NextResponse.json({ status: "processing" })
    }

    return NextResponse.json({
      status: "confirmed",
      redemptionCode: purchase.redemptionCode,
      questTitle: purchase.quest?.title,
    })
  } catch (error) {
    console.error("session-status route error:", error)

    return NextResponse.json({
      status: "error",
      message: "debug error",
    })
  }
}