"use client";

import { Response } from "@repo/design-system/components/ai/response";
import { spokenText } from "@repo/design-system/lib/markdown/spoken";
import { useTranslations } from "use-intl";

/**
 * Renders one rich response label with optional accessible correctness. The label names its control by
 * its own words: the drawn label is hidden from assistive technology, and its words, each formula spoken
 * as KaTeX reads it, stand beside it for screen readers, as the server's labels do.
 */
export function TryoutResponseLabel({
  children,
  correctness,
  id,
}: {
  readonly children: string;
  readonly correctness?: boolean | undefined;
  readonly id: string;
}) {
  const t = useTranslations("Tryouts");

  return (
    <>
      <div aria-hidden="true">
        <Response
          className="h-auto wrap-anywhere whitespace-normal"
          id={`${id}-label-content`}
        >
          {children}
        </Response>
      </div>
      <span className="sr-only">{spokenText(children)}</span>
      {correctness === undefined ? null : (
        <span className="sr-only">
          {t(correctness ? "correct" : "incorrect")}
        </span>
      )}
    </>
  );
}
