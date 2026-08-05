"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { TryoutChoiceSurface } from "@/components/tryout/runtime/choice";

type FeaturedChoice = FunctionReturnType<
  typeof api.tryouts.queries.catalog.getFeaturedQuestion
>["choices"][number];

/** Preserves the landing-page choice interaction without starting an attempt. */
export function TryoutChoicePreview({
  choices,
}: {
  readonly choices: readonly FeaturedChoice[];
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
          <TryoutChoiceSurface
            checked={selectedOptionKey === choice.optionKey}
            disabled={false}
            id={`features-tryout-choice-${choice.optionKey}`}
            isCorrect={choice.isCorrect}
            key={choice.optionKey}
            label={choice.label}
            onSelect={() => setSelectedOptionKey(choice.optionKey)}
            reviewMode={selectedOptionKey !== null}
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
