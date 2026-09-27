import {
  learningPopularityFiniteWindowValues,
  learningPopularityScopeValues,
  learningPopularityWindowValues,
} from "@repo/backend/confect/contents/popularity";
import { Schema } from "effect";
export const learningPopularityWindowValidator = Schema.Literals([
  ...learningPopularityWindowValues,
]);
export const learningPopularityFiniteWindowValidator = Schema.Literals([
  ...learningPopularityFiniteWindowValues,
]);
export const learningPopularityScopeValidator = Schema.Literals([
  ...learningPopularityScopeValues,
]);
