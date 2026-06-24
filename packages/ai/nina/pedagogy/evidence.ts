import {
  PedagogyEvidenceItem,
  type PedagogyEvidenceItemShape,
  PedagogyEvidencePacket,
  type PedagogyEvidencePacketShape,
} from "@repo/ai/nina/pedagogy/schema";
import {
  type MathCopyValue,
  mathEvidenceRefValueName,
} from "@repo/math/schema/copy";
import type { MathWorkResultShape } from "@repo/math/schema/work";

const MAX_PEDAGOGY_STEPS = 8;
const MAX_PEDAGOGY_NOTES = 6;

/** Builds bounded, deterministic evidence that learner narration may cite. */
export function buildPedagogyEvidencePacket({
  locale,
  result,
}: {
  readonly locale: string;
  readonly result: MathWorkResultShape;
}): PedagogyEvidencePacketShape {
  const items = [
    resultEvidence(result),
    verificationEvidence(result),
    ...stepEvidence(result),
    ...noteEvidence({
      fallbackPrefix: "assumption",
      kind: "assumption",
      notes: result.work.assumptions,
      workId: result.work.workId,
    }),
    ...noteEvidence({
      fallbackPrefix: "limitation",
      kind: "limitation",
      notes: result.work.limitations,
      workId: result.work.workId,
    }),
  ];

  return PedagogyEvidencePacket.make({
    evidenceHash: hashEvidenceItems(items),
    items,
    locale,
    operation: result.work.plannedRequest.operation,
    resultExpression: result.work.primaryResult.expression,
    resultLatex: result.work.primaryResult.latex,
    workId: result.work.workId,
  });
}

/** Serializes bounded evidence rows for an internal model prompt. */
export function formatPedagogyEvidencePacket(
  packet: PedagogyEvidencePacketShape
) {
  return [
    `workId=${packet.workId}`,
    `locale=${packet.locale}`,
    `operation=${packet.operation}`,
    `result=${packet.resultExpression}`,
    `evidenceHash=${packet.evidenceHash}`,
    "",
    "Allowed evidence rows:",
    ...packet.items.map(formatEvidenceItem),
  ].join("\n");
}

/** Lists the exact evidence references the narrator may use. */
export function allowedPedagogyEvidenceRefs(
  packet: PedagogyEvidencePacketShape
) {
  return new Set(packet.items.map((item) => item.ref));
}

/** Finds whether every sentence in a projection cites deterministic evidence. */
export function hasEvidenceBoundSentences(
  sentences: readonly { readonly evidenceRefs: readonly string[] }[]
) {
  return sentences.every((sentence) => sentence.evidenceRefs.length > 0);
}

/** Creates the primary answer evidence row for the MathWork result. */
function resultEvidence(
  result: MathWorkResultShape
): PedagogyEvidenceItemShape {
  return PedagogyEvidenceItem.make({
    expression: result.work.primaryResult.expression,
    kind: "result",
    lane: result.work.verification.lane,
    latex: result.work.primaryResult.latex,
    ref: `${result.work.workId}:result:primary`,
    summary: `primaryResult=${result.work.primaryResult.expression}`,
  });
}

/** Creates the deterministic verification evidence row. */
function verificationEvidence(
  result: MathWorkResultShape
): PedagogyEvidenceItemShape {
  return PedagogyEvidenceItem.make({
    kind: "verification",
    lane: result.work.verification.lane,
    ref: evidenceRefFromValues(
      result.work.verification.values,
      `${result.work.workId}:verification:primary`
    ),
    summary: [
      `reasonKey=${result.work.verification.reasonKey}`,
      `source=${result.work.verification.source}`,
      `engine=${result.work.verification.engine}`,
      `values=${formatValues(result.work.verification.values)}`,
    ].join("; "),
  });
}

/** Creates bounded semantic derivation evidence rows. */
function stepEvidence(
  result: MathWorkResultShape
): PedagogyEvidenceItemShape[] {
  return result.steps.slice(0, MAX_PEDAGOGY_STEPS).map((step) =>
    PedagogyEvidenceItem.make({
      expression: step.output.expression,
      kind: "step",
      lane: step.verificationLane,
      latex: step.output.latex,
      ref: evidenceRefFromValues(
        step.projection.school.values,
        `${result.work.workId}:step:${step.order}`
      ),
      summary: [
        `order=${step.order}`,
        `ruleId=${step.ruleId}`,
        `input=${step.input.expression}`,
        `output=${step.output.expression}`,
      ].join("; "),
    })
  );
}

/** Creates bounded assumption or limitation evidence rows. */
function noteEvidence({
  fallbackPrefix,
  kind,
  notes,
  workId,
}: {
  readonly fallbackPrefix: string;
  readonly kind: "assumption" | "limitation";
  readonly notes: MathWorkResultShape["work"]["assumptions"];
  readonly workId: string;
}): PedagogyEvidenceItemShape[] {
  return notes.slice(0, MAX_PEDAGOGY_NOTES).map((note, index) =>
    PedagogyEvidenceItem.make({
      kind,
      lane: note.lane,
      ref: evidenceRefFromValues(
        note.values,
        `${workId}:${fallbackPrefix}:${index}`
      ),
      summary: [
        `copyKey=${note.copyKey}`,
        `source=${note.source ?? "math-work"}`,
        `values=${formatValues(note.values)}`,
      ].join("; "),
    })
  );
}

/** Formats one evidence item as a compact internal prompt row. */
function formatEvidenceItem(item: PedagogyEvidenceItemShape) {
  return [
    `- ref=${item.ref}`,
    `kind=${item.kind}`,
    `lane=${item.lane}`,
    item.expression ? `expression=${item.expression}` : "",
    item.latex ? `latex=${item.latex}` : "",
    `summary=${item.summary}`,
  ]
    .filter(Boolean)
    .join("; ");
}

/** Reads an existing evidence reference value or returns a deterministic fallback. */
function evidenceRefFromValues(
  values: readonly MathCopyValue[],
  fallback: string
) {
  return (
    values.find((value) => value.name === mathEvidenceRefValueName)?.value ??
    fallback
  );
}

/** Formats semantic key-value evidence without learner-facing prose. */
function formatValues(values: readonly MathCopyValue[]) {
  if (values.length === 0) {
    return "none";
  }

  return values.map((value) => `${value.name}:${value.value}`).join(", ");
}

/** Hashes bounded evidence rows into a stable audit identifier. */
function hashEvidenceItems(items: readonly PedagogyEvidenceItemShape[]) {
  let hash = 0;
  const text = items
    .map((item) =>
      [
        item.ref,
        item.kind,
        item.lane,
        item.expression ?? "",
        item.summary,
      ].join("\u001f")
    )
    .join("\u001e");

  for (const char of text) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1_000_000_007;
  }

  return `evidence:${hash.toString(36)}`;
}
