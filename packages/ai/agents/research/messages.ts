import type { DataPart } from "@repo/ai/schema/data";
import type { ModelMessage } from "ai";

/**
 * Adds pre-fetched source evidence without disabling normal research tools.
 */
export function createResearchMessages(task: string, sourceOutputs: string[]) {
  if (sourceOutputs.length === 0) {
    return [{ role: "user", content: task }] satisfies ModelMessage[];
  }

  return [
    {
      role: "user",
      content: [
        task,
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
  collectedEvidence = [],
  evidence,
  groundingSources = [],
  task,
}: {
  collectedEvidence?: string[];
  evidence: string;
  groundingSources?: DataPart["web-search"]["sources"];
  task: string;
}) {
  return [
    {
      role: "user",
      content: [
        "# Research Task",
        task,
        "# Research Notes",
        evidence || "No usable evidence was collected.",
        ...formatGroundingSources(groundingSources),
        ...formatSourceEvidence(collectedEvidence),
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
    "# Source References",
    sources.map((source) => `- ${source.title}: ${source.url}`).join("\n"),
  ];
}

/**
 * Keeps exact tool source evidence explicit in synthesis.
 */
function formatSourceEvidence(collectedEvidence: string[]) {
  if (collectedEvidence.length === 0) {
    return [];
  }

  return ["# Source Evidence With URLs", collectedEvidence.join("\n\n")];
}
