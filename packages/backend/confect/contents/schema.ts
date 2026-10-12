import {
  learningPopularityScopeValues,
  POPULARITY_WINDOW,
} from "@repo/backend/confect/contents/popularity";
import { Schema } from "effect";
export const learningPopularityWindowValidator =
  Schema.Literal(POPULARITY_WINDOW);
export const learningPopularityScopeValidator = Schema.Literals([
  ...learningPopularityScopeValues,
]);
