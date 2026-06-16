import { defineCurriculum } from "@repo/contents/_types/curriculum/schema";
import { LEARNING_PROGRAM_KEYS } from "@repo/contents/_types/program/catalog";
import { merdekaClassNodes } from "@repo/contents/curriculum/indonesia/merdeka/classes";

export const indonesiaMerdekaCurriculum = defineCurriculum({
  programKey: LEARNING_PROGRAM_KEYS.indonesiaMerdekaCurriculum,
  tree: merdekaClassNodes,
});
