import { graphContentIdValidator } from "@repo/backend/confect/contents/graph";
import {
  Capped,
  Duplicate,
  Granted,
} from "@repo/backend/confect/island/schema";
import { localeValidator } from "@repo/backend/confect/lib/validators/contents";
import { Schema } from "effect";

/** The lesson whose end came into view, as its page knows it. */
export const finishLessonArgs = {
  contentId: graphContentIdValidator,
  locale: localeValidator,
  publicPath: Schema.String,
};
export const FinishLessonArgs = Schema.Struct(finishLessonArgs);

/** The server could not prove the lesson was read: it is no lesson, or it was opened too recently. */
export const Unread = Schema.TaggedStruct("unread", {});

/** What finishing a lesson did on the learner's island. */
export const FinishLessonOutcome = Schema.Union([
  Granted,
  Duplicate,
  Capped,
  Unread,
]);
