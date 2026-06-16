import { subjectNode } from "@repo/contents/_types/curriculum/schema";
import {
  merdekaClass10BiologyTopicNodes,
  merdekaClass10ChemistryTopicNodes,
  merdekaClass10MathematicsTopicNodes,
  merdekaClass10PhysicsTopicNodes,
} from "@repo/contents/curriculum/indonesia/merdeka/topics/class-10";
import {
  merdekaClass11MathematicsTopicNodes,
  merdekaClass11PhysicsTopicNodes,
} from "@repo/contents/curriculum/indonesia/merdeka/topics/class-11";
import { merdekaClass12MathematicsTopicNodes } from "@repo/contents/curriculum/indonesia/merdeka/topics/class-12";

export const merdekaClass10SubjectNodes = [
  subjectNode({
    key: "class-10-biology",
    order: 10,
    translations: {
      en: {
        title: "Biology",
      },
      id: {
        title: "Biologi",
      },
    },
    children: merdekaClass10BiologyTopicNodes,
  }),
  subjectNode({
    key: "class-10-chemistry",
    order: 20,
    translations: {
      en: {
        title: "Chemistry",
      },
      id: {
        title: "Kimia",
      },
    },
    children: merdekaClass10ChemistryTopicNodes,
  }),
  subjectNode({
    key: "class-10-mathematics",
    order: 30,
    translations: {
      en: {
        title: "Mathematics",
      },
      id: {
        title: "Matematika",
      },
    },
    children: merdekaClass10MathematicsTopicNodes,
  }),
  subjectNode({
    key: "class-10-physics",
    order: 40,
    translations: {
      en: {
        title: "Physics",
      },
      id: {
        title: "Fisika",
      },
    },
    children: merdekaClass10PhysicsTopicNodes,
  }),
];

export const merdekaClass11SubjectNodes = [
  subjectNode({
    key: "class-11-mathematics",
    order: 30,
    translations: {
      en: {
        title: "Mathematics",
      },
      id: {
        title: "Matematika",
      },
    },
    children: merdekaClass11MathematicsTopicNodes,
  }),
  subjectNode({
    key: "class-11-physics",
    order: 40,
    translations: {
      en: {
        title: "Physics",
      },
      id: {
        title: "Fisika",
      },
    },
    children: merdekaClass11PhysicsTopicNodes,
  }),
];

export const merdekaClass12SubjectNodes = [
  subjectNode({
    key: "class-12-mathematics",
    order: 30,
    translations: {
      en: {
        title: "Mathematics",
      },
      id: {
        title: "Matematika",
      },
    },
    children: merdekaClass12MathematicsTopicNodes,
  }),
];
