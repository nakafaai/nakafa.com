import { defineCurriculumSources } from "@repo/contents/_types/curriculum/schema";
import { cambridgeInternationalCurriculum } from "@repo/contents/curriculum/cambridge-international/source";
import { merdekaCurriculum } from "@repo/contents/curriculum/merdeka/source";
import { singaporeMoeCurriculum } from "@repo/contents/curriculum/singapore-moe/source";
import { unitedStatesCurriculum } from "@repo/contents/curriculum/united-states/source";

/**
 * Source-controlled curriculum registry.
 *
 * Curriculum rows own learner-facing structure and map that structure to
 * reusable material keys. Material source files own localized content assets;
 * they do not decide which curriculum includes a material.
 */
export const CURRICULUM_SOURCES = defineCurriculumSources([
  merdekaCurriculum,
  cambridgeInternationalCurriculum,
  singaporeMoeCurriculum,
  unitedStatesCurriculum,
]);
