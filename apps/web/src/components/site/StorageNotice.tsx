"use client";

import { useEffect, useState } from "react";
import { getDictionary } from "@/lib/i18n";

const STORAGE_NOTICE_KEY = "geoquest:storage-notice-dismissed";

export default function StorageNotice() {
  const t = getDictionary();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem(STORAGE_NOTICE_KEY);
      setVisible(dismissed !== "true");
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_NOTICE_KEY, "true");
    } catch {
      // Ignore storage failures; the notice will simply reappear.
    }

    setVisible(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-card-foreground">
            {t.storageNotice.title}
          </p>
          <p className="max-w-4xl text-sm text-muted-foreground">
            {t.storageNotice.body}
          </p>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="inline-flex shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)]"
        >
          {t.storageNotice.dismiss}
        </button>
      </div>
    </div>
  );
}
