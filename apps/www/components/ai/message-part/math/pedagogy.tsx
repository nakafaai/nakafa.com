"use client";

import type { DataPart } from "@repo/ai/schema/data";
import { Response } from "@repo/design-system/components/ai/response";

interface MathPedagogyProps {
  lane: DataPart["math-reasoning"]["pedagogy"];
}

type MathPedagogyDone = Extract<
  NonNullable<DataPart["math-reasoning"]["pedagogy"]>,
  { status: "done" }
>;

/** Renders live evidence-bound math narration from PedagogyNarrator. */
export function MathPedagogy({ lane }: MathPedagogyProps) {
  if (lane?.status !== "done") {
    return null;
  }

  const sentences = lane.projection.sentences.filter(
    hasVisibleEvidenceBoundText
  );

  if (sentences.length === 0) {
    return null;
  }

  return (
    <Response
      className="not-prose text-foreground text-sm leading-6"
      id={`${lane.projection.workId}-pedagogy`}
    >
      {sentences.map((sentence) => sentence.text).join("\n\n")}
    </Response>
  );
}
MathPedagogy.displayName = "MathPedagogy";

/** Keeps only learner sentences backed by deterministic evidence references. */
function hasVisibleEvidenceBoundText(
  sentence: MathPedagogyDone["projection"]["sentences"][number]
) {
  return sentence.text.trim().length > 0 && sentence.evidenceRefs.length > 0;
}
