import { ProjectedCurriculumNodeSchema } from "@repo/contents/_types/curriculum/projection";
import { CurriculumSourceSchema } from "@repo/contents/_types/curriculum/schema";
import { MaterialRouteDomainSchema } from "@repo/contents/_types/material/domain";
import { MaterialSourceSchema } from "@repo/contents/_types/material/schema";
import { LearningProgramSchema } from "@repo/contents/_types/program/schema";
import { TryoutExamSourceSchema } from "@repo/contents/_types/tryout/schema";
import { Schema } from "effect";

export const RouteInputsSchema = Schema.Struct({
  curricula: Schema.optional(Schema.Array(CurriculumSourceSchema)),
  curriculumNodes: Schema.optional(Schema.Array(ProjectedCurriculumNodeSchema)),
  domains: Schema.optional(Schema.Array(MaterialRouteDomainSchema)),
  materials: Schema.optional(Schema.Array(MaterialSourceSchema)),
  programs: Schema.optional(Schema.Array(LearningProgramSchema)),
  tryouts: Schema.optional(Schema.Array(TryoutExamSourceSchema)),
});

export type RouteInputs = Schema.Schema.Type<typeof RouteInputsSchema>;

/** Detects source overrides that must bypass default static route caches. */
export function hasCustomRouteInputs(inputs: RouteInputs) {
  return Boolean(
    inputs.curricula ||
      inputs.curriculumNodes ||
      inputs.domains ||
      inputs.materials ||
      inputs.programs ||
      inputs.tryouts
  );
}
