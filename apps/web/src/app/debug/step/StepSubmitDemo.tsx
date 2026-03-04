"use client";

import React, { useEffect, useMemo, useState } from "react";
import { clearAllSubmissionQueues, enqueueSubmission, flushQueue, listQueuedSubmissions, StepSubmission } from "@/lib/offline/submissionQueue";
import { getCurrentPositionOnce } from "@/lib/geo/getCurrentPosition";

function makeId() {
  // good enough for client queue ids
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function StepSubmitDemo(props: { stepDocumentId: string }) {
  const [answer, setAnswer] = useState("test");
  const [status, setStatus] = useState<string>("");
  const [queuedCount, setQueuedCount] = useState<number>(0);
  const [online, setOnline] = useState<boolean | null>(null);

  
  async function refreshQueueCount() {
    const q = await listQueuedSubmissions();
    setQueuedCount(q.length);
  }

  useEffect(() => {
    refreshQueueCount();

    // Set initial online state after mount
    setOnline(navigator.onLine);

    const onOnline = async () => {
        setOnline(true);
        setStatus("Back online — sending queued submissions…");
        const res = await flushQueue();
        await refreshQueueCount();
        setStatus(`Queued send result: sent ${res.sent}, remaining ${res.remaining}`);
    };

    const onOffline = () => {
        setOnline(false);
        setStatus("You are offline.");
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  async function handleSubmit() {
    setStatus("Capturing GPS…");

    let coords;
    try {
      coords = await getCurrentPositionOnce();
    } catch (e: any) {
      setStatus(`GPS error: ${e?.message ?? String(e)}`);
      return;
    }

    const submission: StepSubmission = {
      id: makeId(),
      stepDocumentId: props.stepDocumentId,
      answer,
      coords: { lat: coords.lat, lng: coords.lng, accuracy: coords.accuracy },
      submittedAt: Date.now(),
    };

    // If offline, queue immediately
    if (!navigator.onLine) {
      await enqueueSubmission(submission);
      await refreshQueueCount();
      setStatus("Offline — saved submission locally. It will send when you’re back online.");
      return;
    }

    // If online, try sending; if network fails, queue as fallback
    setStatus("Sending…");
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(submission),
      });

      if (!res.ok) {
        await enqueueSubmission(submission);
        await refreshQueueCount();
        setStatus(`Server rejected (${res.status}) — saved locally to retry later.`);
        return;
      }

      const json = await res.json();
      setStatus(json.unlocked ? `✅ Unlocked! (${JSON.stringify(json.checks)})` : `❌ Not unlocked yet. (${JSON.stringify(json.checks)})`);
    } catch (e: any) {
      await enqueueSubmission(submission);
      await refreshQueueCount();
      setStatus("Network error — saved locally. Will retry when online.");
    }
  }

  async function handleFlush() {
    setStatus("Trying to send queued submissions…");
    const res = await flushQueue();
    await refreshQueueCount();
    setStatus(`Queued send result: sent ${res.sent}, remaining ${res.remaining}`);
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h2 className="text-lg font-semibold">Submit demo (one-shot GPS + offline queue)</h2>

      <div className="text-sm">
        <strong>Online:</strong> {online === null ? "…" : online ? "✅ Yes" : "❌ No"}
        {" · "}
        <strong>Queued:</strong> {queuedCount}
      </div>

      <div className="flex flex-col gap-2 max-w-sm">
        <label className="text-sm font-medium">Answer (demo)</label>
        <input
          className="rounded border px-3 py-2"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type an answer…"
        />
      </div>

      <div className="flex gap-2">
        <button className="rounded bg-black px-3 py-2 text-white" onClick={handleSubmit}>
          Submit (capture GPS now)
        </button>
        <button className="rounded border px-3 py-2" onClick={handleFlush}>
          Send queued
        </button>
      </div>

      {status && <p className="text-sm">{status}</p>}
      <button
        className="rounded border px-3 py-2"
        onClick={async () => {
          await clearAllSubmissionQueues();
          await refreshQueueCount();
          setStatus("Cleared all queued submissions.");
        }}
      >
        Clear queue
      </button>

    </div>
  );
}
