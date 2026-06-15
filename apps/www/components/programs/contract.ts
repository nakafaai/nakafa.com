import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

export type LearningProgramCatalog = FunctionReturnType<
  typeof api.learningPrograms.queries.listSelectablePrograms
>;
export type ActiveLearningProfile = FunctionReturnType<
  typeof api.learningPrograms.queries.getActiveProfile
>;
