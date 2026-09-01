"use client";

import type { QuestionResponse } from "@nakafa/aksara-contracts/question/response";
import { Button } from "@repo/design-system/components/ui/button";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { TryoutResponseFields } from "@/components/tryout/runtime/response/fields.client";
import {
  isPreviewComplete,
  isPreviewCorrect,
} from "@/components/tryout/runtime/response/preview";
import type { TryoutResponseSelection } from "@/components/tryout/runtime/response/state";

/** Previews every authored response kind without creating attempt state. */
export function TryoutResponsePreview({
  id,
  responseSpec,
}: {
  readonly id: string;
  readonly responseSpec: QuestionResponse;
}) {
  const t = useTranslations("Exercises");
  const [selection, setSelection] = useState<TryoutResponseSelection | null>(
    null
  );
  const [revealAnswers, setRevealAnswers] = useState(false);
  const autoReveal = responseSpec.kind === "single-choice";
  const complete = isPreviewComplete(responseSpec, selection);
  const feedback =
    revealAnswers && complete
      ? t(isPreviewCorrect(responseSpec, selection) ? "correct" : "incorrect")
      : null;

  return (
    <div className="space-y-4">
      <TryoutResponseFields
        value={{
          id,
          locked: revealAnswers && !autoReveal,
          onChange: (nextSelection) => {
            setSelection(nextSelection);
            if (autoReveal) {
              setRevealAnswers(true);
            }
          },
          revealAnswers,
          responseSpec,
          selection,
        }}
      />
      {autoReveal ? null : (
        <div className="flex justify-end">
          {revealAnswers ? (
            <Button
              onClick={() => {
                setRevealAnswers(false);
                setSelection(null);
              }}
              type="button"
              variant="outline"
            >
              {t("reset")}
            </Button>
          ) : (
            <Button
              disabled={!complete}
              onClick={() => setRevealAnswers(true)}
              type="button"
            >
              {t("check-answer")}
            </Button>
          )}
        </div>
      )}
      <p aria-live="polite" className="sr-only" role="status">
        {feedback}
      </p>
    </div>
  );
}
