import { subjectNode } from "@repo/contents/_types/curriculum/schema";
import { merdekaClass10BiologyTopicNodes } from "@repo/contents/curriculum/merdeka/topics/class-10/biology";
import { merdekaClass10ChemistryTopicNodes } from "@repo/contents/curriculum/merdeka/topics/class-10/chemistry";
import { merdekaClass10MathematicsTopicNodes } from "@repo/contents/curriculum/merdeka/topics/class-10/mathematics";
import { merdekaClass10PhysicsTopicNodes } from "@repo/contents/curriculum/merdeka/topics/class-10/physics";
import { merdekaClass11MathematicsTopicNodes } from "@repo/contents/curriculum/merdeka/topics/class-11/mathematics";
import { merdekaClass11PhysicsTopicNodes } from "@repo/contents/curriculum/merdeka/topics/class-11/physics";
import { merdekaClass12MathematicsTopicNodes } from "@repo/contents/curriculum/merdeka/topics/class-12/mathematics";

export const merdekaClass10SubjectNodes = [
  subjectNode({
    key: "class-10-biology",
    materialDomain: "biology",
    order: 10,
    translations: {
      en: {
        routeSlug: "biology",
        title: "Biology",
      },
      id: {
        routeSlug: "biologi",
        title: "Biologi",
      },
    },
    children: merdekaClass10BiologyTopicNodes,
  }),
  subjectNode({
    key: "class-10-chemistry",
    materialDomain: "chemistry",
    order: 20,
    translations: {
      en: {
        routeSlug: "chemistry",
        title: "Chemistry",
      },
      id: {
        routeSlug: "kimia",
        title: "Kimia",
      },
    },
    children: merdekaClass10ChemistryTopicNodes,
  }),
  subjectNode({
    key: "class-10-mathematics",
    materialDomain: "mathematics",
    order: 30,
    translations: {
      en: {
        routeSlug: "mathematics",
        title: "Mathematics",
      },
      id: {
        routeSlug: "matematika",
        title: "Matematika",
      },
    },
    children: merdekaClass10MathematicsTopicNodes,
  }),
  subjectNode({
    key: "class-10-physics",
    materialDomain: "physics",
    order: 40,
    translations: {
      en: {
        routeSlug: "physics",
        title: "Physics",
      },
      id: {
        routeSlug: "fisika",
        title: "Fisika",
      },
    },
    children: merdekaClass10PhysicsTopicNodes,
  }),
];

export const merdekaClass11SubjectNodes = [
  subjectNode({
    key: "class-11-mathematics",
    materialDomain: "mathematics",
    order: 30,
    translations: {
      en: {
        routeSlug: "mathematics",
        title: "Mathematics",
      },
      id: {
        routeSlug: "matematika",
        title: "Matematika",
      },
    },
    children: merdekaClass11MathematicsTopicNodes,
  }),
  subjectNode({
    key: "class-11-physics",
    materialDomain: "physics",
    order: 40,
    translations: {
      en: {
        routeSlug: "physics",
        title: "Physics",
      },
      id: {
        routeSlug: "fisika",
        title: "Fisika",
      },
    },
    children: merdekaClass11PhysicsTopicNodes,
  }),
];

export const merdekaClass12SubjectNodes = [
  subjectNode({
    key: "class-12-mathematics",
    materialDomain: "mathematics",
    order: 30,
    translations: {
      en: {
        routeSlug: "mathematics",
        title: "Mathematics",
      },
      id: {
        routeSlug: "matematika",
        title: "Matematika",
      },
    },
    children: merdekaClass12MathematicsTopicNodes,
  }),
];
