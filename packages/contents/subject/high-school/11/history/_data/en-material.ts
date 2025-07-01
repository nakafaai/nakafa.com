import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const enMaterials: MaterialList = [
  {
    title: "Colonialism and Indonesian Resistance",
    description:
      "Heroic struggle against colonizers that nurtured the nation's spirit of independence.",
    href: `${BASE_PATH}/colonialism-resistance`,
    items: [
      {
        title: "Historical Connection between Regional and Global Situations",
        href: `${BASE_PATH}/colonialism-resistance/regional-global-history`,
      },
      {
        title: "Indonesian Resistance Against Colonialism",
        href: `${BASE_PATH}/colonialism-resistance/indonesian-resistance`,
      },
      {
        title: "Impact of Colonialism in Colonial Countries",
        href: `${BASE_PATH}/colonialism-resistance/impact-colonialism`,
      },
    ],
  },
  {
    title: "Indonesian National Movement",
    description:
      "Awakening of national consciousness uniting the archipelago in one shared dream.",
    href: `${BASE_PATH}/national-movement`,
    items: [
      {
        title: "Eastern Nations Renaissance",
        href: `${BASE_PATH}/national-movement/eastern-renaissance`,
      },
      {
        title: "Emergence of Nationalism and National Identity",
        href: `${BASE_PATH}/national-movement/nationalism-embrio`,
      },
      {
        title: "End of Dutch Colonial State",
        href: `${BASE_PATH}/colonialism-resistance/end-colonialism`,
      },
    ],
  },
  {
    title: "Under Japanese Tyranny",
    description:
      "Dark period that paradoxically accelerated Indonesia's path to independence.",
    href: `${BASE_PATH}/under-japanese-rule`,
    items: [
      {
        title: "Japanese Entry and Fall of Dutch East Indies",
        href: `${BASE_PATH}/under-japanese-rule/japanese-dutch-fall`,
      },
      {
        title: "Japanese Occupation and Government Transformation in Indonesia",
        href: `${BASE_PATH}/under-japanese-rule/japanese-transformation`,
      },
      {
        title: "Impact of Japanese Occupation in Various Fields",
        href: `${BASE_PATH}/under-japanese-rule/japanese-impact`,
      },
      {
        title: "Indonesian Strategy Facing Japanese Tyranny",
        href: `${BASE_PATH}/under-japanese-rule/indonesian-strategy`,
      },
    ],
  },
  {
    title: "Proclamation of Independence",
    description:
      "Historic moment transforming a colonized nation into a free and sovereign state.",
    href: `${BASE_PATH}/proclamation-independence`,
    items: [
      {
        title: "Japanese Defeat",
        href: `${BASE_PATH}/proclamation-independence/japanese-defeat`,
      },
      {
        title: "Towards the Proclamation of Independence",
        href: `${BASE_PATH}/proclamation-independence/towards-proclamation`,
      },
      {
        title: "Moments of Proclamation",
        href: `${BASE_PATH}/proclamation-independence/proclamation-details`,
      },
      {
        title: "Reception of the Proclamation of Independence",
        href: `${BASE_PATH}/proclamation-independence/reception`,
      },
    ],
  },
] as const;

export default enMaterials;
