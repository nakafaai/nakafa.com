import type { learningProgramInputValidator } from "@repo/backend/convex/learningPrograms/schema";
import { LEARNING_PROGRAM_CATALOG } from "@repo/contents/_types/program/catalog";
import type { LearningProgram } from "@repo/contents/_types/program/schema";
import type { Infer } from "convex/values";

export type LearningProgramSyncInput = Infer<
  typeof learningProgramInputValidator
>;

/** Converts readonly contents program contracts into Convex mutation input rows. */
export function getLearningProgramCatalogInputs(
  programs: readonly LearningProgram[] = LEARNING_PROGRAM_CATALOG
): LearningProgramSyncInput[] {
  return programs.map((program) => ({
    defaultCoverageStatus: program.defaultCoverageStatus,
    description: program.description,
    displayOrder: program.displayOrder,
    key: program.key,
    kind: program.kind,
    locale: program.locale,
    provider: { ...program.provider },
    recommendedCountry: program.recommendedCountry,
    sources: program.sources.map((source) => ({ ...source })),
    title: program.title,
    version: { ...program.version },
  }));
}
