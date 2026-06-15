import {
  LEARNING_PROGRAM_CATALOG,
  LEARNING_PROGRAM_KEYS,
} from "@repo/contents/_types/program/catalog";
import {
  type LearningProgram,
  type LearningProgramCoverageAlignment,
  LearningProgramCoverageAlignmentSchema,
} from "@repo/contents/_types/program/schema";
import { Schema } from "effect";

/**
 * Bounded assessment route rules from graph-owned route facts to program keys.
 *
 * School curriculum coverage is owned by curriculum-to-material mappings in the
 * curriculum module. These rules cover assessment routes until assessment
 * mapping source modules are split out with the same material-key contract.
 */
export const LEARNING_PROGRAM_COVERAGE_ALIGNMENTS = Schema.decodeUnknownSync(
  Schema.Array(LearningProgramCoverageAlignmentSchema)
)([
  {
    match: {
      lensSegments: ["tka"],
      routeSegments: ["tka"],
    },
    programKey: LEARNING_PROGRAM_KEYS.tka2026,
  },
  {
    match: {
      lensSegments: ["snbt"],
      routeSegments: ["snbt"],
    },
    programKey: LEARNING_PROGRAM_KEYS.snbt2026,
  },
] as const);

/** Returns registry problems that would make coverage sync point at unknown programs. */
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
