import { classNode } from "@repo/contents/_types/curriculum/schema";
import {
  merdekaClass10SubjectNodes,
  merdekaClass11SubjectNodes,
  merdekaClass12SubjectNodes,
} from "@repo/contents/curriculum/merdeka/subjects";

export const merdekaClassNodes = [
  classNode({
    displayGroup: {
      en: { title: "Primary School" },
      id: { title: "SD" },
    },
    displayGroupIconKey: "primary-school",
    iconKey: "grade-1",
    key: "class-1",
    order: 10,
    translations: {
      en: {
        routeSlug: "class-1",
        title: "Class 1",
      },
      id: {
        routeSlug: "kelas-1",
        title: "Kelas 1",
      },
    },
  }),
  classNode({
    displayGroup: {
      en: { title: "Primary School" },
      id: { title: "SD" },
    },
    displayGroupIconKey: "primary-school",
    iconKey: "grade-2",
    key: "class-2",
    order: 20,
    translations: {
      en: {
        routeSlug: "class-2",
        title: "Class 2",
      },
      id: {
        routeSlug: "kelas-2",
        title: "Kelas 2",
      },
    },
  }),
  classNode({
    displayGroup: {
      en: { title: "Primary School" },
      id: { title: "SD" },
    },
    displayGroupIconKey: "primary-school",
    iconKey: "grade-3",
    key: "class-3",
    order: 30,
    translations: {
      en: {
        routeSlug: "class-3",
        title: "Class 3",
      },
      id: {
        routeSlug: "kelas-3",
        title: "Kelas 3",
      },
    },
  }),
  classNode({
    displayGroup: {
      en: { title: "Primary School" },
      id: { title: "SD" },
    },
    displayGroupIconKey: "primary-school",
    iconKey: "grade-4",
    key: "class-4",
    order: 40,
    translations: {
      en: {
        routeSlug: "class-4",
        title: "Class 4",
      },
      id: {
        routeSlug: "kelas-4",
        title: "Kelas 4",
      },
    },
  }),
  classNode({
    displayGroup: {
      en: { title: "Primary School" },
      id: { title: "SD" },
    },
    displayGroupIconKey: "primary-school",
    iconKey: "grade-5",
    key: "class-5",
    order: 50,
    translations: {
      en: {
        routeSlug: "class-5",
        title: "Class 5",
      },
      id: {
        routeSlug: "kelas-5",
        title: "Kelas 5",
      },
    },
  }),
  classNode({
    displayGroup: {
      en: { title: "Primary School" },
      id: { title: "SD" },
    },
    displayGroupIconKey: "primary-school",
    iconKey: "grade-6",
    key: "class-6",
    order: 60,
    translations: {
      en: {
        routeSlug: "class-6",
        title: "Class 6",
      },
      id: {
        routeSlug: "kelas-6",
        title: "Kelas 6",
      },
    },
  }),
  classNode({
    displayGroup: {
      en: { title: "Lower Secondary" },
      id: { title: "SMP" },
    },
    displayGroupIconKey: "middle-school",
    iconKey: "grade-7",
    key: "class-7",
    order: 70,
    translations: {
      en: {
        routeSlug: "class-7",
        title: "Class 7",
      },
      id: {
        routeSlug: "kelas-7",
        title: "Kelas 7",
      },
    },
  }),
  classNode({
    displayGroup: {
      en: { title: "Lower Secondary" },
      id: { title: "SMP" },
    },
    displayGroupIconKey: "middle-school",
    iconKey: "grade-8",
    key: "class-8",
    order: 80,
    translations: {
      en: {
        routeSlug: "class-8",
        title: "Class 8",
      },
      id: {
        routeSlug: "kelas-8",
        title: "Kelas 8",
      },
    },
  }),
  classNode({
    displayGroup: {
      en: { title: "Lower Secondary" },
      id: { title: "SMP" },
    },
    displayGroupIconKey: "middle-school",
    iconKey: "grade-9",
    key: "class-9",
    order: 90,
    translations: {
      en: {
        routeSlug: "class-9",
        title: "Class 9",
      },
      id: {
        routeSlug: "kelas-9",
        title: "Kelas 9",
      },
    },
  }),
  classNode({
    displayGroup: {
      en: { title: "Upper Secondary" },
      id: { title: "SMA" },
    },
    displayGroupIconKey: "high-school",
    iconKey: "grade-10",
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
    displayGroup: {
      en: { title: "Upper Secondary" },
      id: { title: "SMA" },
    },
    displayGroupIconKey: "high-school",
    iconKey: "grade-11",
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
    displayGroup: {
      en: { title: "Upper Secondary" },
      id: { title: "SMA" },
    },
    displayGroupIconKey: "high-school",
    iconKey: "grade-12",
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
