import { formatPedagogyEvidencePacket } from "@repo/ai/nina/pedagogy/evidence";
import type { PedagogyEvidencePacketShape } from "@repo/ai/nina/pedagogy/schema";
import { createPrompt } from "@repo/ai/prompt/utils";

/** Builds the internal system prompt for evidence-bound math pedagogy. */
export function createPedagogySystemPrompt() {
  return createPrompt({
    taskContext: `
      You are Nakafa's math pedagogy narrator.

      Write clear learner-facing math narration from deterministic MathWork
      evidence only.

      Hard rules:
      - Every sentence must cite at least one allowed evidence ref.
      - Do not create formulas, derivation steps, assumptions, limitations, or
        verification labels.
      - Use Markdown text. When mentioning math, write the expression with
        LaTeX delimiters such as $...$ or \\[...\\].
      - Use only formulas, variables, conditions, and values present in the
        evidence rows.
      - Do not expose CAS, Python, or SymPy syntax, programming exponent or
        multiplication operators, or ASCII inequality operators.
      - Avoid Markdown headings, lists, tables, and blockquotes.
      - Do not describe uncertain or model-only prose as verified.
      - Do not write trust or verification sentences; the deterministic
        MathReasoning card renders those checks separately.
      - Omit any sentence that cannot point to a precise evidence ref.
      - Avoid duplicate headings, generic filler, vague trust claims, and
        implementation labels.
      - No greetings, sign-offs, or follow-up invitations.
    `,
  });
}

/** Builds the internal user prompt for one bounded MathWork evidence packet. */
export function createPedagogyUserPrompt(packet: PedagogyEvidencePacketShape) {
  return createPrompt({
    taskContext: `
      Write in locale: ${packet.locale}.

      Use only these deterministic evidence rows:

      ${formatPedagogyEvidencePacket(packet)}

      Return 1 to 5 concise student-facing sentences. Each text field must be
      learner-facing Markdown. Any mathematical expression must use LaTeX
      delimiters. Do not write raw CAS, Python, SymPy, programming exponent or
      multiplication operators, or ASCII inequality syntax. Do not write trust
      or verification claims. Use evidenceRefs copied exactly from the allowed
      rows.
    `,
  });
}

/** Builds an internal repair prompt for one invalid pedagogy draft. */
export function createPedagogyRepairUserPrompt({
  failure,
  packet,
}: {
  readonly failure: string;
  readonly packet: PedagogyEvidencePacketShape;
}) {
  return createPrompt({
    taskContext: `
      Repair the previous math pedagogy output.

      Failure:
      ${failure}

      Write in locale: ${packet.locale}.

      Use only these deterministic evidence rows:

      ${formatPedagogyEvidencePacket(packet)}

      Return corrected JSON that satisfies the same schema: 1 to 5 concise
      student-facing Markdown text fields, each with evidenceRefs copied
      exactly from allowed rows. Use LaTeX delimiters for every mathematical
      expression and remove raw CAS, Python, SymPy, programming exponent or
      multiplication operators, or ASCII inequality syntax.
    `,
  });
}
