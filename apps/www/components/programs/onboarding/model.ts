import {
  LEARNING_INTEREST_PROGRAM_KIND_MATCHES,
  type LearningInterest,
  LearningInterestSchema,
} from "@repo/contents/_types/program/schema";
import { Option, Schema } from "effect";
import type { LearningProgramCatalog } from "@/components/programs/contract";

export const ONBOARDING_STEPS = ["interests", "program", "confirm"] as const;

/** Step identifiers for the learner-facing program onboarding flow. */
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** One selectable program summary returned by the Convex program catalog. */
export type ProgramOption = LearningProgramCatalog[number];

const interestListSchema = Schema.Array(LearningInterestSchema).pipe(
  Schema.mutable
);

/** Safely parses unknown form interests into the learning interest union. */
export function parseInterests(value: unknown): readonly LearningInterest[] {
  const parsed = Schema.decodeUnknownOption(interestListSchema)(value);

  if (Option.isNone(parsed)) {
    return [];
  }

  return parsed.value;
}

/** Lists programs that match at least one selected learner interest. */
export function getProgramsForInterests(
  programs: readonly ProgramOption[],
  interests: readonly LearningInterest[]
) {
  if (interests.length === 0) {
    return [];
  }

  return programs.filter((program) =>
    interests.some((interest) =>
      LEARNING_INTEREST_PROGRAM_KIND_MATCHES[interest].some(
        (kind) => kind === program.kind
      )
    )
  );
}

/** Lists learner-facing focuses that have at least one usable program route. */
export function getSelectableInterests(
  programs: readonly ProgramOption[],
  interestValues: readonly LearningInterest[]
) {
  return interestValues.filter(
    (interest) => getProgramsForInterests(programs, [interest]).length > 0
  );
}

/** Finds which selected interests are served by the chosen primary program. */
export function getInterestsForProgram(
  program: ProgramOption | null,
  interests: readonly LearningInterest[]
) {
  if (!program) {
    return [];
  }

  return interests.filter((interest) =>
    LEARNING_INTEREST_PROGRAM_KIND_MATCHES[interest].some(
      (kind) => kind === program.kind
    )
  );
}

/** Returns the learner-safe default path used by Skip. */
export function getDefaultProgram(programs: LearningProgramCatalog) {
  return (
    programs.find((program) => program.kind === "nakafa-path") ??
    programs.at(0) ??
    null
  );
}
