import { mathPrompt } from "@repo/ai/agents/math/prompt";
import { nakafaAgentPrompt } from "@repo/ai/agents/nakafa/prompt";
import { formatResearchOutput } from "@repo/ai/agents/research/output";
import { researchPrompt } from "@repo/ai/agents/research/prompt";
import { renderArtifactEval } from "@repo/ai/eval/artifact";
import { EvalCase, EvalExpectation, EvalSuite } from "@repo/ai/eval/spec";
import {
  CapabilityTrace,
  EvidenceEnvelope,
} from "@repo/ai/nina/capability/spec";
import {
  type NinaPage,
  readNinaLearningPage,
} from "@repo/ai/nina/contract/turn";
import type { AgentContext } from "@repo/ai/types/agents";
import { Effect } from "effect";

const context = {
  currentDate: "June 22, 2026",
  needsPageFetch: false,
  slug: "subjects/mathematics/vector/addition",
  url: "https://nakafa.com/id/subjects/mathematics/vector/addition",
  verified: true,
} satisfies AgentContext;

/**
 * Builds the deterministic local eval suite required before Nina readiness.
 */
export function createNinaEvalSuite() {
  return EvalSuite.make({
    name: "nina-deterministic",
    cases: [
      EvalCase.make({
        id: "math-deterministic-first",
        target: "math",
        expectations: [
          EvalExpectation.make({
            label: "routes through deterministic tools",
            includes: "route math work through deterministic math tools",
          }),
          EvalExpectation.make({
            label: "requires evidence before final claims",
            includes: "If evidence is missing and can be checked",
          }),
        ],
      }),
      EvalCase.make({
        id: "coordinate-artifact-emission",
        target: "artifact",
        expectations: [
          EvalExpectation.make({
            label: "uses data-artifact transcript part",
            includes: "part: data-artifact",
          }),
          EvalExpectation.make({
            label: "keeps payload outside transcript",
            includes: "payload: learningArtifacts",
          }),
          EvalExpectation.make({
            label: "renders coordinate artifact kind",
            includes: "kind: coordinate-system-3d",
          }),
        ],
      }),
      EvalCase.make({
        id: "nakafa-evidence-boundary",
        target: "nakafa",
        expectations: [
          EvalExpectation.make({
            label: "retrieves Nakafa-owned content",
            includes: "retrieve Nakafa-owned content accurately",
          }),
          EvalExpectation.make({
            label: "does not invent practice",
            includes: "say Nakafa did not return practice data",
          }),
        ],
      }),
      EvalCase.make({
        id: "research-source-boundary",
        target: "research",
        expectations: [
          EvalExpectation.make({
            label: "keeps citation data inline",
            includes: "[AI SDK](https://ai-sdk.dev)",
          }),
          EvalExpectation.make({
            label: "rejects invented sources",
            includes: "Do not invent sources or facts.",
          }),
        ],
      }),
      EvalCase.make({
        id: "trace-summary-boundary",
        target: "trace",
        expectations: [
          EvalExpectation.make({
            label: "persists summary only",
            includes: "summary: deterministic evidence only",
          }),
          EvalExpectation.make({
            label: "keeps capability identity",
            includes: "capability: math",
          }),
        ],
      }),
      EvalCase.make({
        id: "turn-pinned-locale",
        target: "turn",
        expectations: [
          EvalExpectation.make({
            label: "uses pinned learning locale",
            includes: "locale: id",
          }),
          EvalExpectation.make({
            label: "uses pinned learning URL",
            includes:
              "url: https://nakafa.com/id/subjects/mathematics/vector/addition",
          }),
        ],
      }),
    ],
  });
}

const ninaEvalRenderers = {
  artifact: () => renderArtifactEval(),
  math: () => Effect.succeed(mathPrompt({ context, locale: "id" })),
  nakafa: () => Effect.succeed(nakafaAgentPrompt({ context, locale: "id" })),
  research: () =>
    Effect.succeed(
      [
        researchPrompt({ context, locale: "id" }),
        formatResearchOutput({
          findings: [
            {
              citations: [{ title: "AI SDK", url: "https://ai-sdk.dev" }],
              text: "AI SDK supports structured generation.",
            },
          ],
          limitations: [],
          noEvidenceAnswer: "No evidence.",
        }),
      ].join("\n\n")
    ),
  trace: () => Effect.succeed(readTraceEvalOutput()),
  turn: () => Effect.succeed(readTurnEvalOutput()),
};

/**
 * Renders one deterministic eval case through the relevant Module seam.
 */
export const renderNinaEvalCase = Effect.fn("eval.renderNinaCase")(function* (
  testCase: EvalCase
) {
  return yield* ninaEvalRenderers[testCase.target]();
});

/**
 * Renders the trace eval through the capability trace schema.
 */
function readTraceEvalOutput() {
  const trace = CapabilityTrace.make({
    capability: "math",
    durationMs: 12,
    endedAt: 12,
    evidence: EvidenceEnvelope.make({
      capability: "math",
      status: "available",
      summary: "deterministic evidence only",
    }),
    responseMessageIdentifier: "response-1",
    startedAt: 0,
    toolCallId: "tool-1",
  });

  return [
    `capability: ${trace.capability}`,
    `status: ${trace.evidence.status}`,
    `summary: ${trace.evidence.summary}`,
  ].join("\n");
}

/**
 * Renders the pinned-locale turn eval through the Nina page contract.
 */
function readTurnEvalOutput() {
  const page = createPinnedLocalePage();
  const learning = readNinaLearningPage(page);

  return [`locale: ${learning.locale}`, `url: ${learning.url}`].join("\n");
}

/**
 * Creates a turn fixture whose request locale differs from pinned learning.
 */
function createPinnedLocalePage(): NinaPage {
  return {
    locale: "en",
    needsFetch: false,
    slug: "chat",
    url: "https://nakafa.com/en/chat",
    verified: false,
    nina: {
      learning: {
        locale: "id",
        slug: "subjects/mathematics/vector/addition",
        url: "https://nakafa.com/id/subjects/mathematics/vector/addition",
        verified: true,
      },
      snapshot: {
        capturedAt: "2026-06-22T00:00:00.000Z",
        learning: {
          locale: "id",
          slug: "subjects/mathematics/vector/addition",
          url: "https://nakafa.com/id/subjects/mathematics/vector/addition",
          verified: true,
        },
        source: "pinned-chat",
        tools: {
          allowDeepResearch: true,
          allowMath: true,
          allowNakafa: true,
          allowPageFetch: true,
          evidenceScope: "verified-page",
        },
      },
      tools: {
        allowDeepResearch: true,
        allowMath: true,
        allowNakafa: true,
        allowPageFetch: true,
        evidenceScope: "verified-page",
      },
      transition: {
        reason: "same-context",
        toContextKey: "canonical:subjects/mathematics/vector/addition",
      },
    },
  };
}
