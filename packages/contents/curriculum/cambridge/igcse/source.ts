import { defineCurriculum } from "@repo/contents/_types/curriculum/schema";
import { LEARNING_PROGRAM_KEYS } from "@repo/contents/_types/program/catalog";
import { igcseMathematicsNodes } from "@repo/contents/curriculum/cambridge/igcse/mappings/mathematics";
import { igcseSubjectNodes } from "@repo/contents/curriculum/cambridge/igcse/subjects";

export const cambridgeIgcseCurriculum = defineCurriculum({
  programKey: LEARNING_PROGRAM_KEYS.cambridgeIgcse,
  nodes: [...igcseSubjectNodes, ...igcseMathematicsNodes],
});
