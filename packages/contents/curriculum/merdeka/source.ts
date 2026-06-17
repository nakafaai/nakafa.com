import { defineCurriculum } from "@repo/contents/_types/curriculum/schema";
import { LEARNING_PROGRAM_KEYS } from "@repo/contents/_types/program/catalog";
import { merdekaClassNodes } from "@repo/contents/curriculum/merdeka/classes";

export const merdekaCurriculum = defineCurriculum({
  programKey: LEARNING_PROGRAM_KEYS.merdeka,
  tree: merdekaClassNodes,
});
