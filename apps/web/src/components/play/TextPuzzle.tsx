"use client";

import { getDictionary } from "@/lib/i18n";
import type { TextSubmission } from "@/lib/quests/puzzleTypes";

type TextPuzzleProps = {
  value: TextSubmission;
  onChange: (next: TextSubmission) => void;
};

export default function TextPuzzle({ value, onChange }: TextPuzzleProps) {
  const t = getDictionary();

  return (
    <div className="space-y-2">
      <label htmlFor="quest-answer" className="text-sm font-medium">
        {t.step.answerLabel}
      </label>
      <input
        id="quest-answer"
        type="text"
        value={value.answer}
        onChange={(event) =>
          onChange({
            type: "text",
            answer: event.target.value,
          })
        }
        placeholder={t.step.answerPlaceholder}
        className="w-full rounded-md border border-border bg-background px-4 py-3 text-foreground"
        autoComplete="off"
        autoCapitalize="characters"
      />
    </div>
  );
}
