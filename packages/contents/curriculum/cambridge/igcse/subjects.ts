import { courseNode } from "@repo/contents/_types/curriculum/schema";
import { igcseMathematicsUnitNodes } from "@repo/contents/curriculum/cambridge/igcse/units/mathematics";

export const igcseCourseNodes = [
  courseNode({
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
];
