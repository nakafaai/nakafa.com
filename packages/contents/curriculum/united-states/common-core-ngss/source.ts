import { defineCurriculum } from "@repo/contents/_types/curriculum/schema";
import { LEARNING_PROGRAM_KEYS } from "@repo/contents/_types/program/catalog";
import { commonCoreNgssStandardNodes } from "@repo/contents/curriculum/united-states/common-core-ngss/standards";

export const unitedStatesCommonCoreNgssCurriculum = defineCurriculum({
  programKey: LEARNING_PROGRAM_KEYS.usCommonCoreNgss,
  nodes: commonCoreNgssStandardNodes,
});
