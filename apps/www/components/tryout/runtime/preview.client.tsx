"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { TryoutPreviewChoice } from "@/components/tryout/runtime/choice-surface.client";

/** Minimal immutable choice model shared by signed and local preview sources. */
export interface TryoutPreviewChoiceItem {
  readonly isCorrect: boolean;
  readonly label: string;
  readonly optionKey: string;
  readonly order: number;
}

/** Preserves the landing-page choice interaction without starting an attempt. */
export function TryoutChoicePreview({
  choices,
}: {
  readonly choices: readonly TryoutPreviewChoiceItem[];
}) {
  const t = useTranslations("Exercises");
  const [selectedOptionKey, setSelectedOptionKey] = useState<string | null>(
    null
  );
  const selectedChoice = choices.find(
    ({ optionKey }) => optionKey === selectedOptionKey
  );

  return (
    <>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {choices.map((choice) => (
          <TryoutPreviewChoice
            appearance={
              selectedOptionKey === null
                ? { kind: "selectable" }
                : { isCorrect: choice.isCorrect, kind: "revealed" }
            }
            checked={selectedOptionKey === choice.optionKey}
            disabled={false}
            id={`features-tryout-choice-${choice.optionKey}`}
            key={choice.optionKey}
            label={choice.label}
            onSelect={() => setSelectedOptionKey(choice.optionKey)}
          />
        ))}
      </div>
      <p aria-live="polite" className="sr-only" role="status">
        {selectedChoice
          ? `${selectedChoice.label}: ${t(
              selectedChoice.isCorrect ? "correct" : "incorrect"
            )}`
          : null}
      </p>
    </>
  );
}
