"use client";

import { Response } from "@repo/design-system/components/ai/response";
import { useTranslations } from "next-intl";

/** Renders one rich response label with optional accessible correctness. */
export function TryoutResponseLabel({
  children,
  correctness,
  id,
}: {
  readonly children: string;
  readonly correctness?: boolean;
  readonly id: string;
}) {
  const t = useTranslations("Exercises");

  return (
    <>
      <Response
        className="wrap-anywhere h-auto whitespace-normal"
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
