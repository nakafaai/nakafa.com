import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import {
  type FinishLessonArgs,
  Unread,
} from "@repo/backend/confect/contents/views/lesson";
import { validateIncomingContentTarget } from "@repo/backend/confect/contents/views/target";
import { grantAward } from "@repo/backend/confect/island/award";
import { Array as Arr, Clock, Duration, Effect } from "effect";

/** The shortest time between opening a lesson and reaching its end that counts as reading it. */
const READ_TIME = Duration.seconds(45);

/** The most reading contexts one learner keeps for one lesson. */
const LESSON_VIEWS = 20;

/**
 * Grants a lesson's Stars once the signed-in learner reaches its end (ADR
 * 0042, D9). The route must be a published lesson, and the learner's latest
 * view of it must be at least 45 seconds old, so scrolling straight to the end
 * of a page just opened proves nothing. The learner's view is the one their
 * browser recorded a few seconds after the page opened.
 */
export const finishLesson = Effect.fn("contents.views.finishLesson")(function* (
  args: typeof FinishLessonArgs.Type
) {
  const { appUser } = yield* requireAuth();
  const target = yield* validateIncomingContentTarget({
    ...args,
    section: "material",
  });
  if (target?.kind !== "curriculum-lesson") {
    return Unread.make({});
  }
  const database = yield* DatabaseReader;
  const views = yield* database
    .table("learningViews")
    .index("by_userId_and_content_id_and_contextKey", (query) =>
      query.eq("userId", appUser._id).eq("content_id", target.content_id)
    )
    .take(LESSON_VIEWS)
    .pipe(Effect.orDie);
  const now = yield* Clock.currentTimeMillis;
  const opened = Arr.reduce(views, 0, (latest, view) =>
    Math.max(latest, view.lastViewedAt)
  );
  if (views.length === 0 || now - opened < Duration.toMillis(READ_TIME)) {
    return Unread.make({});
  }
  return yield* grantAward(appUser._id, {
    _tag: "lesson",
    content: target.content_id,
    subject: target.materialDomain,
  });
});
