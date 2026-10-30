"use client";

import { Response } from "@repo/design-system/components/ai/response";
import { useTranslations } from "use-intl";

/** Renders one rich response label with optional accessible correctness. */
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
      <Response
        className="h-auto wrap-anywhere whitespace-normal"
        id={`${id}-label-content`}
      >
        {children}
      </Response>
      {correctness === undefined ? null : (
        <span className="sr-only">
          {t(correctness ? "correct" : "incorrect")}
        </span>
      )}
    </>
  );
}
