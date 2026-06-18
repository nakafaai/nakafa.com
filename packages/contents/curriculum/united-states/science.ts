import {
  courseNode,
  materialNode,
  unitNode,
} from "@repo/contents/_types/curriculum/schema";

export const usHighSchoolScienceCourseNode = courseNode({
  children: [
    unitNode({
      children: [
        materialNode({
          key: "us-high-school-science-physical-measurement",
          level: "lesson",
          materialKeys: ["lesson.physics.measurement"],
          order: 10,
        }),
        materialNode({
          key: "us-high-school-science-physical-motion",
          level: "lesson",
          materialKeys: ["lesson.physics.kinematics"],
          order: 20,
        }),
        materialNode({
          key: "us-high-school-science-physical-energy",
          level: "lesson",
          materialKeys: ["lesson.physics.renewable-energy"],
          order: 30,
        }),
        materialNode({
          key: "us-high-school-science-physical-matter",
          level: "lesson",
          materialKeys: ["lesson.chemistry.structure-matter"],
          order: 40,
        }),
        materialNode({
          key: "us-high-school-science-physical-reactions",
          level: "lesson",
          materialKeys: ["lesson.chemistry.basic-chemistry-laws"],
          order: 50,
        }),
      ],
      key: "high-school-science-physical-sciences",
      order: 10,
      translations: {
        en: {
          routeSlug: "physical-sciences",
          title: "Physical Sciences",
        },
        id: {
          routeSlug: "ilmu-fisika-dan-kimia",
          title: "Ilmu fisika dan kimia",
        },
      },
    }),
    unitNode({
      children: [
        materialNode({
          key: "us-high-school-science-life-biodiversity",
          level: "lesson",
          materialKeys: ["lesson.biology.biodiversity"],
          order: 10,
        }),
        materialNode({
          key: "us-high-school-science-life-virus",
          level: "lesson",
          materialKeys: ["lesson.biology.virus-role"],
          order: 20,
        }),
      ],
      key: "high-school-science-life-sciences",
      order: 20,
      translations: {
        en: {
          routeSlug: "life-sciences",
          title: "Life Sciences",
        },
        id: {
          routeSlug: "ilmu-hayati",
          title: "Ilmu hayati",
        },
      },
    }),
    unitNode({
      children: [
        materialNode({
          key: "us-high-school-science-earth-climate",
          level: "lesson",
          materialKeys: ["lesson.biology.climate-change"],
          order: 10,
        }),
      ],
      key: "high-school-science-earth-space-sciences",
      order: 30,
      translations: {
        en: {
          routeSlug: "earth-and-space-sciences",
          title: "Earth and Space Sciences",
        },
        id: {
          routeSlug: "ilmu-bumi-dan-antariksa",
          title: "Ilmu bumi dan antariksa",
        },
      },
    }),
  ],
  iconKey: "science",
  key: "high-school-science",
  order: 20,
  translations: {
    en: {
      routeSlug: "science",
      title: "Science",
    },
    id: {
      routeSlug: "sains",
      title: "Sains",
    },
  },
});
