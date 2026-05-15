import type { DataPart } from "@repo/ai/schema/data";
import type { ModelMessage } from "ai";

/**
 * Adds pre-fetched source evidence without disabling normal research tools.
 */
export function createResearchMessages(
  intent: string,
  sourceOutputs: string[]
) {
  if (sourceOutputs.length === 0) {
    return [{ role: "user", content: intent }] satisfies ModelMessage[];
  }

  return [
    {
      role: "user",
      content: [
        intent,
        "User-provided source evidence has already been retrieved. Use it for source-specific claims. If the research task also needs current, external, or corroborating evidence, use the search tools before producing findings.",
        "# User-Provided Source Evidence",
        sourceOutputs.join("\n\n"),
      ].join("\n\n"),
    },
  ] satisfies ModelMessage[];
}

/**
 * Gives structured synthesis the collected evidence without exposing tools.
 */
export function createResearchSynthesisMessages({
  evidence,
  groundingSources = [],
  intent,
  sourceOutputs,
}: {
  evidence: string;
  groundingSources?: DataPart["web-search"]["sources"];
  intent: string;
  sourceOutputs: string[];
}) {
  return [
    {
      role: "user",
      content: [
        "# Research Task",
        intent,
        "# Collected Evidence",
        evidence || "No usable evidence was collected.",
        ...formatGroundingSources(groundingSources),
        ...formatSourceEvidence(sourceOutputs),
      ].join("\n\n"),
    },
  ] satisfies ModelMessage[];
}

/** Keeps provider grounding references available for structured synthesis. */
function formatGroundingSources(sources: DataPart["web-search"]["sources"]) {
  if (sources.length === 0) {
    return [];
  }

  return [
    "# Grounding Source References",
    sources.map((source) => `- ${source.title}: ${source.url}`).join("\n"),
  ];
}

/**
 * Keeps exact user-provided source evidence explicit in synthesis.
 */
function formatSourceEvidence(sourceOutputs: string[]) {
  if (sourceOutputs.length === 0) {
    return [];
  }

  return ["# User-Provided Source Evidence", sourceOutputs.join("\n\n")];
}
