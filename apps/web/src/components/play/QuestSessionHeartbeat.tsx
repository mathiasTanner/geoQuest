"use client";

import { useEffect } from "react";

export default function QuestSessionHeartbeat() {
  useEffect(() => {
    void fetch("/api/me/quests", {
      method: "GET",
      cache: "no-store",
    }).catch(() => {
      // Best-effort touch to roll the session cookie during normal resumes.
    });
  }, []);

  return null;
}
