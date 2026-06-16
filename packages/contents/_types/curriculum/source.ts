import type { CurriculumSource } from "@repo/contents/_types/curriculum/schema";
import { CurriculumSourceSchema } from "@repo/contents/_types/curriculum/schema";
import { cambridgeIgcseCurriculum } from "@repo/contents/curriculum/cambridge/igcse/source";
import { indonesiaMerdekaCurriculum } from "@repo/contents/curriculum/indonesia/merdeka/source";
import { unitedStatesCommonCoreNgssCurriculum } from "@repo/contents/curriculum/united-states/common-core-ngss/source";
import { Schema } from "effect";

const curriculumSourceInput = [
  indonesiaMerdekaCurriculum,
  cambridgeIgcseCurriculum,
  unitedStatesCommonCoreNgssCurriculum,
] satisfies readonly CurriculumSource[];

/**
 * Source-controlled curriculum registry.
 *
 * Curriculum rows own learner-facing structure and map that structure to
 * reusable material keys. Material source files own localized content assets;
 * they do not decide which curriculum includes a material.
 */
export const CURRICULUM_SOURCES = Schema.decodeUnknownSync(
  Schema.Array(CurriculumSourceSchema)
)(curriculumSourceInput);
