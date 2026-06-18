import { courseNode } from "@repo/contents/_types/curriculum/schema";
import { igcseMathematicsUnitNodes } from "@repo/contents/curriculum/cambridge-international/igcse/units/mathematics";
import {
  igcseBiologyUnitNodes,
  igcseChemistryUnitNodes,
  igcsePhysicsUnitNodes,
} from "@repo/contents/curriculum/cambridge-international/igcse/units/science";

export const igcseCourseNodes = [
  courseNode({
    iconKey: "mathematics",
    key: "mathematics-0580",
    materialDomain: "mathematics",
    order: 10,
    translations: {
      en: {
        routeSlug: "mathematics-0580",
        title: "Mathematics 0580",
      },
      id: {
        routeSlug: "mathematics-0580",
        title: "Mathematics 0580",
      },
    },
    children: igcseMathematicsUnitNodes,
  }),
  courseNode({
    iconKey: "science",
    key: "biology-0610",
    materialDomain: "biology",
    order: 20,
    translations: {
      en: {
        routeSlug: "biology-0610",
        title: "Biology 0610",
      },
      id: {
        routeSlug: "biology-0610",
        title: "Biology 0610",
      },
    },
    children: igcseBiologyUnitNodes,
  }),
  courseNode({
    iconKey: "science",
    key: "chemistry-0620",
    materialDomain: "chemistry",
    order: 30,
    translations: {
      en: {
        routeSlug: "chemistry-0620",
        title: "Chemistry 0620",
      },
      id: {
        routeSlug: "chemistry-0620",
        title: "Chemistry 0620",
      },
    },
    children: igcseChemistryUnitNodes,
  }),
  courseNode({
    iconKey: "science",
    key: "physics-0625",
    materialDomain: "physics",
    order: 40,
    translations: {
      en: {
        routeSlug: "physics-0625",
        title: "Physics 0625",
      },
      id: {
        routeSlug: "physics-0625",
        title: "Physics 0625",
      },
    },
    children: igcsePhysicsUnitNodes,
  }),
];
