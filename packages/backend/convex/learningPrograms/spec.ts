import {
  COVERAGE_STATUS_VALUES,
  LEARNING_INTEREST_PROGRAM_KIND_MATCHES,
  LEARNING_INTEREST_VALUES,
  LEARNING_PROGRAM_KIND_VALUES,
  type LearningInterest,
  type LearningProgramKind,
  PROGRAM_NAVIGATION_LEVEL_VALUES,
  PROGRAM_NAVIGATION_MODEL_VALUES,
} from "@repo/contents/_types/program/schema";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

export const learningInterestValidator = literals(...LEARNING_INTEREST_VALUES);

const coverageStatusValidator = literals(...COVERAGE_STATUS_VALUES);
const learningProgramKindValidator = literals(...LEARNING_PROGRAM_KIND_VALUES);
const programNavigationLevelValidator = literals(
  ...PROGRAM_NAVIGATION_LEVEL_VALUES
);
const programNavigationModelValidator = literals(
  ...PROGRAM_NAVIGATION_MODEL_VALUES
);

export const learningProgramSummaryValidator = v.object({
  coverageStatus: coverageStatusValidator,
  displayOrder: v.number(),
  key: v.string(),
  kind: learningProgramKindValidator,
  navigation: v.object({
    levels: v.array(programNavigationLevelValidator),
    model: programNavigationModelValidator,
  }),
  publicSlug: v.string(),
  title: v.string(),
  versionLabel: v.string(),
});

export const activeLearningSelectionValidator = v.union(
  v.null(),
  v.object({
    interest: learningInterestValidator,
    program: learningProgramSummaryValidator,
  })
);

/** Checks that one learner interest accepts the selected program kind. */
export function programMatchesInterest(
  programKind: LearningProgramKind,
  interest: LearningInterest
) {
  return LEARNING_INTEREST_PROGRAM_KIND_MATCHES[interest].some(
    (kind) => kind === programKind
  );
}
