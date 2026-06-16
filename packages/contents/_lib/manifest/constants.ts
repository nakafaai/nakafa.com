import { CONTENT_ROOT_VALUES } from "@repo/contents/_types/content";

export const QURAN_ROOT = "quran";
export const EXERCISE_SET_REGEX =
  /^(material\/practice\/.*?\/set-\d+)\/question-\d+$/;
export const EXERCISE_NUMBER_REGEX =
  /^(material\/practice\/.*?\/set-\d+\/question-\d+)$/;
const CONTENT_ROOT_ROUTES = Object.values(CONTENT_ROOT_VALUES).map(
  (root) => `/${root}`
);
export const PUBLIC_CONTENT_BASE_ROUTES = [
  ...CONTENT_ROOT_ROUTES,
  `/${QURAN_ROOT}`,
];
