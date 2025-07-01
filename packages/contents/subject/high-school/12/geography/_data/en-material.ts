import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const enMaterials: MaterialList = [
  {
    title:
      "Regional Development, Spatial Planning, and Their Impact on Happiness",
    description:
      "The art of building spaces that transform regions into happy places to live.",
    href: `${BASE_PATH}/development-happiness`,
    items: [
      {
        title: "Regional Development",
        href: `${BASE_PATH}/development-happiness/region-development`,
      },
      {
        title: "Village Development",
        href: `${BASE_PATH}/development-happiness/village-development`,
      },
      {
        title: "Urban Development",
        href: `${BASE_PATH}/development-happiness/city-development`,
      },
      {
        title: "Regional Development Spatial Planning",
        href: `${BASE_PATH}/development-happiness/region-spatial-development`,
      },
      {
        title: "Regional Development Dynamics",
        href: `${BASE_PATH}/development-happiness/region-development-dynamics`,
      },
      {
        title: "Happiness Index as Regional Development Result",
        href: `${BASE_PATH}/development-happiness/happiness-index`,
      },
      {
        title:
          "Impact of Regional Development and Spatial Planning on Population Happiness",
        href: `${BASE_PATH}/development-happiness/region-spatial-happiness-impact`,
      },
    ],
  },
  {
    title:
      "Regional Development, Industrial Revolution, and Their Impact on Earth's Surface and Welfare",
    description:
      "Digital transformation changing Earth's face and shaping the future of prosperity.",
    href: `${BASE_PATH}/region-industry-wellbeing`,
    items: [
      {
        title: "Definition of Development",
        href: `${BASE_PATH}/region-industry-wellbeing/development-definition`,
      },
      {
        title: "Development Paradigm",
        href: `${BASE_PATH}/region-industry-wellbeing/development-paradigm`,
      },
      {
        title: "Development Approach",
        href: `${BASE_PATH}/region-industry-wellbeing/development-approach`,
      },
      {
        title: "Development Indicators",
        href: `${BASE_PATH}/region-industry-wellbeing/development-indicator`,
      },
      {
        title: "Industrial Revolution 4.0",
        href: `${BASE_PATH}/region-industry-wellbeing/industry-revolution-4`,
      },
      {
        title: "Society 5.0",
        href: `${BASE_PATH}/region-industry-wellbeing/society-5`,
      },
      {
        title: "Population Welfare as Development Result",
        href: `${BASE_PATH}/region-industry-wellbeing/wellbeing-result`,
      },
      {
        title:
          "Impact of Regional Development and Industrial Revolution on Welfare",
        href: `${BASE_PATH}/region-industry-wellbeing/impact`,
      },
    ],
  },
  {
    title:
      "Dynamics of International Cooperation and Its Impact on Indonesia's Regional Security",
    description:
      "Global diplomatic networks strengthening Indonesia's defense fortress.",
    href: `${BASE_PATH}/international-cooperation-security`,
    items: [
      {
        title: "International Cooperation",
        href: `${BASE_PATH}/international-cooperation-security/international-cooperation`,
      },
      {
        title:
          "Indonesia's Geopolitics as Potential for International Cooperation",
        href: `${BASE_PATH}/international-cooperation-security/indonesia-geopolitics`,
      },
      {
        title: "Indonesia's Cooperation in International Arena",
        href: `${BASE_PATH}/international-cooperation-security/indonesia-international-cooperation`,
      },
      {
        title: "Impact of International Cooperation on Regional Security",
        href: `${BASE_PATH}/international-cooperation-security/impact`,
      },
    ],
  },
] as const;

export default enMaterials;
