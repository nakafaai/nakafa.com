import { defineCurriculum } from "@repo/contents/_types/curriculum/schema";
import { LEARNING_PROGRAM_KEYS } from "@repo/contents/_types/program/catalog";
import { merdekaClassNodes } from "@repo/contents/curriculum/indonesia/merdeka/classes";
import { merdekaClass10TopicNodes } from "@repo/contents/curriculum/indonesia/merdeka/mappings/class-10";
import { merdekaClass11TopicNodes } from "@repo/contents/curriculum/indonesia/merdeka/mappings/class-11";
import { merdekaClass12TopicNodes } from "@repo/contents/curriculum/indonesia/merdeka/mappings/class-12";
import { merdekaSubjectNodes } from "@repo/contents/curriculum/indonesia/merdeka/subjects";

export const indonesiaMerdekaCurriculum = defineCurriculum({
  programKey: LEARNING_PROGRAM_KEYS.indonesiaMerdekaCurriculum,
  nodes: [
    ...merdekaClassNodes,
    ...merdekaSubjectNodes,
    ...merdekaClass10TopicNodes,
    ...merdekaClass11TopicNodes,
    ...merdekaClass12TopicNodes,
  ],
});
