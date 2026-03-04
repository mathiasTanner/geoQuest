"use client";

import { get, set, del } from "idb-keyval";

export type StepSubmission = {
  id: string; // client-generated
  stepDocumentId: string;
  answer: string;
  coords: { lat: number; lng: number; accuracy: number };
  submittedAt: number; // Date.now()
};

const KEY = "geoquest:submissionQueue:v2";

async function readQueue(): Promise<StepSubmission[]> {
  return (await get(KEY)) ?? [];
}

async function writeQueue(queue: StepSubmission[]) {
  await set(KEY, queue);
}

export async function enqueueSubmission(item: StepSubmission) {
  const q = await readQueue();
  q.push(item);
  await writeQueue(q);
}

export async function listQueuedSubmissions() {
  return await readQueue();
}

export async function removeSubmissionById(id: string) {
  const q = await readQueue();
  await writeQueue(q.filter((x) => x.id !== id));
}

/**
 * Attempts to POST queued submissions to the server route.
 * On success, removes them from the queue.
 */
export async function flushQueue() {
  const q = await readQueue();
  if (q.length === 0) return { sent: 0, remaining: 0 };

  let sent = 0;

  for (const item of q) {
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(item),
      });

      if (!res.ok) {
        // If server rejects, keep it queued (for now)
        continue;
      }

      sent += 1;
      await removeSubmissionById(item.id);
    } catch {
      // offline / network error: stop early
      break;
    }
  }

  const remaining = (await readQueue()).length;
  return { sent, remaining };
}

export async function clearAllSubmissionQueues() {
  await del("geoquest:submissionQueue:v1");
  await del("geoquest:submissionQueue:v2");
  await del("geoquest:submissionQueue:v3");
}
