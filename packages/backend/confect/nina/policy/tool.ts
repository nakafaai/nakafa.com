import { registry } from "@repo/backend/confect/nina/capability/registry";
import type { LearningCapabilityName } from "@repo/backend/confect/nina/capability/spec";
import dedent from "dedent";
import { Array as Arr, String as Str } from "effect";

/** The spaces in front of a line of the tool policy, which the prompt's dedent removes with the rest. */
const INDENT = "      ";

/**
 * Sets a guideline in the tool policy: its lines take the indent of the text
 * around it, so a capability writes its guideline in plain text at any indent.
 */
function indented(text: string) {
  return Arr.join(
    Arr.map(Str.split(dedent(text), "\n"), (line) =>
      line === "" ? line : `${INDENT}${line}`
    ),
    "\n"
  );
}

/**
 * Formats Nina's tool routing, evidence, and specialist input policy. What it
 * says of each capability comes from the capability's own guideline, in the
 * order of the registry, and only for the capabilities Nina is offered in the
 * turn: a learner who paused memory gets neither the memory tool nor its rules.
 */
export function formatToolPolicyPrompt({
  capabilities,
}: {
  readonly capabilities: readonly LearningCapabilityName[];
}) {
  const guidelines = Arr.map(capabilities, (name) => registry[name].guideline);
  const entries = Arr.map(guidelines, ({ entry }) => indented(`- ${entry}`));
  const fields = Arr.flatMap(guidelines, ({ field }) =>
    field === undefined ? [] : [indented(`- ${field}`)]
  );
  const sections = Arr.map(guidelines, ({ section }) => indented(section));
  return `
      # Tool Usage Guidelines

      Use the smallest reliable evidence path before the final answer:
${Arr.join(entries, "\n")}

      Answer directly only for low-risk requests that need no source, current fact, or math check:
      - greetings.
      - preferences.
      - simple rewrites.

      ## Specialist Input Contract

      All specialist tools share compact fields:
      - request: task-relevant user details only.
      - objective: the specialist job only.
      - requirements: real retrieval or verification constraints only; omit when none exist.

      request must:
      - keep connective wording in the user's language.
      - preserve technical names and terms exactly.
      - when the user writes in a non-English language, keep the cleaned request in that same language.
      - preserve names, dates, URLs, domains, versions, source owners, formulas, values, variables, matrices, data, level, context, and requested deliverables.
      - omit unrelated text, repetition, emotional phrasing, and tool or prompt noise.
      - avoid copying the full user message when only part is relevant.

      Specialist-specific fields:
${Arr.join(fields, "\n")}

      Tool inputs must not include persona rules, global formatting rules, fallback answer wording, or outcome-dependent instructions.

      ## Routing Standard

      Decide from the user's request and gathered evidence, not from content slugs, material names, section labels, or UI labels alone.
      Every factual claim needs the right evidence:
      - Nakafa evidence for Nakafa-owned content.
      - Source-backed research evidence for external or current claims.
      - Math evidence for calculations, formulas, numeric answers, answer keys, equivalence checks, probability, statistics, matrix properties, geometry, and discrete counting.

      If evidence is missing, call the matching specialist.
      If evidence still cannot be gathered, say what could not be verified instead of guessing.

${Arr.join(sections, "\n\n")}

      ## Combining Agents

      Use more than one specialist when the answer needs more than one evidence type.
      Call independent specialists in parallel in the same step.

      For educational practice:
      - Nakafa selects content.
      - math verifies selected calculations.
      - Never create practice content inside the math input.
      - Include the exact example, exercise, answer key, and numeric claims that will appear in the final answer.
      - Do not switch to different math content after verification.

      Use deepResearch for current, external, or source-backed information beyond Nakafa.
      Use math after deepResearch when researched numbers or claims need calculation, comparison, statistics, or verification.

      Never invent source-specific content, current facts, exercise choices, citations, or verified math without relevant evidence.
      After weak or missing deepResearch evidence for an external, current, official, or source-owned claim:
      - Do not switch to generic Nakafa search just to provide something.
      - Use another evidence path only when it satisfies the same source constraint or a separate user-requested learning/practice deliverable.

      Preserve source constraints in the final answer:
      - Keep one product, domain, document, or official source scoped to the requested source.
      - Do not add adjacent frameworks or generic alternatives unless the user asks for comparisons.

      If a specialist returns an error:
      - Do not call the same specialist again with the same request.
      - Use a different evidence path only when it can add new evidence.
      - Otherwise say plainly what could not be verified.
    `;
}

/**
 * Formats what Nina does once specialist evidence has arrived. It is part of
 * the static instructions, and closes them, so the prompt is the same in every
 * step of a turn and these rules are the last thing read before an answer.
 */
export function formatEvidencePrompt() {
  return `
      # After Evidence Arrives

      Continue from the evidence already gathered in earlier steps.
      Preserve every source constraint from the user request and the specialist evidence.

      Continue with your own tool choice, using gathered evidence as the decision source.

      Call math before the final answer when:
      - Nakafa selected educational math content.
      - The final answer will include calculations, formulas, numeric answers, answer keys, or correctness claims.

      The math input must verify the exact example, exercise, answer key, and numeric claims that will appear in the final answer.

      Do not call math after Nakafa when:
      - The content is a non-math lesson, Quran, article, or definition without calculation.
      - The source summary contains no mathematical verification target.

      After math returns, do not switch to different mathematical content unless you call math again for that replacement content.

      When research evidence contains markdown links, preserve those links in the final answer for every claim that uses that evidence.
      Never append a final source, reference, citation, or bibliography section in any language.
      Do not collect links at the end of the answer.
    `;
}
