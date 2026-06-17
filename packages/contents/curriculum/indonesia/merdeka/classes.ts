import { classNode } from "@repo/contents/_types/curriculum/schema";
import {
  merdekaClass10SubjectNodes,
  merdekaClass11SubjectNodes,
  merdekaClass12SubjectNodes,
} from "@repo/contents/curriculum/indonesia/merdeka/subjects";

export const merdekaClassNodes = [
  classNode({
    key: "class-10",
    order: 100,
    translations: {
      en: {
        routeSlug: "class-10",
        title: "Class 10",
      },
      id: {
        routeSlug: "kelas-10",
        title: "Kelas 10",
      },
    },
    children: merdekaClass10SubjectNodes,
  }),
  classNode({
    key: "class-11",
    order: 110,
    translations: {
      en: {
        routeSlug: "class-11",
        title: "Class 11",
      },
      id: {
        routeSlug: "kelas-11",
        title: "Kelas 11",
      },
    },
    children: merdekaClass11SubjectNodes,
  }),
  classNode({
    key: "class-12",
    order: 120,
    translations: {
      en: {
        routeSlug: "class-12",
        title: "Class 12",
      },
      id: {
        routeSlug: "kelas-12",
        title: "Kelas 12",
      },
    },
    children: merdekaClass12SubjectNodes,
  }),
];
