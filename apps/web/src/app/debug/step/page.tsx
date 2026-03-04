// apps/web/app/debug/step/page.tsx
import React from "react";
import { StepGeoGate } from "./StepGeoGate";
import { StepSubmitDemo } from "./StepSubmitDemo";

type QuestStep = {
  id: number;
  documentId: string;
  title: string | null;
  order: number;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  puzzleType: string;
  puzzleDataPublic: { prompt?: string; hint?: string; [k: string]: unknown };
};

async function fetchFirstQuestStep() {
  const res = await fetch("http://localhost:3000/api/steps/first", { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch /api/steps/first: ${res.status} ${text}`);
  }
  const json = await res.json();
  return json?.data ?? null;
}

export default async function DebugStepPage() {
  const step = await fetchFirstQuestStep();

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Debug: First Quest Step</h1>

      {!step ? (
        <p>No quest steps found in Strapi.</p>
      ) : (
        <div className="rounded-lg border p-4 space-y-2">
          <div><strong>ID:</strong> {step.id}</div>
          <div><strong>Title:</strong> {step.title ?? "(no title)"}</div>
          <div><strong>Order:</strong> {step.order}</div>
          <div><strong>Latitude:</strong> {step.latitude}</div>
          <div><strong>Longitude:</strong> {step.longitude}</div>
          <div><strong>Radius (m):</strong> {step.radiusMeters}</div>
          <div><strong>Puzzle type:</strong> {step.puzzleType}</div>
          <div><strong>Prompt:</strong> {String(step.puzzleDataPublic?.prompt ?? "")}</div>
          <div><strong>Hint:</strong> {String(step.puzzleDataPublic?.hint ?? "")}</div>

          <details className="pt-2">
            <summary className="cursor-pointer">Raw JSON</summary>
            <pre className="mt-2 overflow-auto rounded bg-black/5 p-3 text-sm">
              {JSON.stringify(step, null, 2)}
            </pre>
          </details>
          <StepGeoGate
            targetLat={step.latitude}
            targetLng={step.longitude}
            radiusMeters={step.radiusMeters}
          />
          <StepSubmitDemo stepDocumentId={step.documentId} />
        </div>
      )}
    </main>
  );
}
