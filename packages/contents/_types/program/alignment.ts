import {
  getDefaultLearningProgramKey,
  LEARNING_PROGRAM_CATALOG,
} from "@repo/contents/_types/program/catalog";
import {
  type LearningProgram,
  type LearningProgramCoverageAlignment,
  LearningProgramCoverageAlignmentSchema,
} from "@repo/contents/_types/program/schema";
import { Schema } from "effect";

/** Central source-registry ownership rules for projecting graph routes to programs. */
export const LEARNING_PROGRAM_COVERAGE_ALIGNMENTS = Schema.decodeUnknownSync(
  Schema.Array(LearningProgramCoverageAlignmentSchema)
)([
  {
    match: {
      routeKinds: ["subject-section", "subject-topic"],
    },
    programKey: "id-kurikulum-merdeka",
  },
  {
    match: {
      routeKinds: ["subject-section", "subject-topic"],
    },
    programKey: getDefaultLearningProgramKey(),
  },
  {
    match: {
      lensSegments: ["tka"],
      routeSegments: ["tka"],
    },
    programKey: "tka-2026",
  },
  {
    match: {
      lensSegments: ["snbt"],
      routeSegments: ["snbt"],
    },
    programKey: "snbt-2026",
  },
  {
    match: {
      fallback: true,
    },
    programKey: getDefaultLearningProgramKey(),
  },
] as const);

/** Returns catalog problems that would make coverage sync point at unknown programs. */
export function getLearningProgramCoverageAlignmentIssues({
  alignments = LEARNING_PROGRAM_COVERAGE_ALIGNMENTS,
  programs = LEARNING_PROGRAM_CATALOG,
}: {
  alignments?: readonly LearningProgramCoverageAlignment[];
  programs?: readonly LearningProgram[];
} = {}) {
  const catalogKeys = new Set(programs.map((program) => program.key));

  return alignments
    .filter((alignment) => !catalogKeys.has(alignment.programKey))
    .map(
      (alignment) => `Unknown learning program key: ${alignment.programKey}`
    );
}
