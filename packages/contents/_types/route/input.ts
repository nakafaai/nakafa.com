import { AssessmentSourceSchema } from "@repo/contents/_types/assessment/schema";
import { ProjectedCurriculumNodeSchema } from "@repo/contents/_types/curriculum/projection";
import { CurriculumSourceSchema } from "@repo/contents/_types/curriculum/schema";
import { MaterialRouteDomainSchema } from "@repo/contents/_types/material/domain";
import { MaterialSourceSchema } from "@repo/contents/_types/material/schema";
import { LearningProgramSchema } from "@repo/contents/_types/program/schema";
import { Schema } from "effect";

export const RouteInputsSchema = Schema.Struct({
  assessments: Schema.optional(Schema.Array(AssessmentSourceSchema)),
  curricula: Schema.optional(Schema.Array(CurriculumSourceSchema)),
  curriculumNodes: Schema.optional(Schema.Array(ProjectedCurriculumNodeSchema)),
  domains: Schema.optional(Schema.Array(MaterialRouteDomainSchema)),
  materials: Schema.optional(Schema.Array(MaterialSourceSchema)),
  programs: Schema.optional(Schema.Array(LearningProgramSchema)),
});

export type RouteInputs = Schema.Schema.Type<typeof RouteInputsSchema>;
