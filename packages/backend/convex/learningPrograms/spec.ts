import {
  LearningProgramKindSchema,
  ProgramCoverageSchema,
  ProgramNavigationLevelSchema,
  ProgramNavigationModelSchema,
} from "@nakafa/aksara-contracts/program/spec";
import {
  LEARNING_INTEREST_PROGRAM_KIND_MATCHES,
  LEARNING_INTEREST_VALUES,
  type LearningInterest,
} from "@repo/contents/_types/learner/preferences";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

export const learningInterestValidator = literals(...LEARNING_INTEREST_VALUES);

type LearningProgramKind = typeof LearningProgramKindSchema.Type;
const coverageStatusValidator = literals(...ProgramCoverageSchema.literals);
const learningProgramKindValidator = literals(
  ...LearningProgramKindSchema.literals
);
const programNavigationLevelValidator = literals(
  ...ProgramNavigationLevelSchema.literals
);
const programNavigationModelValidator = literals(
  ...ProgramNavigationModelSchema.literals
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
