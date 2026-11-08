import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect } from "effect";

/**
 * Finishes one section: `complete` saves the finish, and once the server holds it `leave` goes to the page that
 * follows, which shows the finished section, so no toast repeats it over the page. A finish that fails stays on
 * the section with one toast, and the learner presses again.
 */
export const completeSection = Effect.fn("tryout.finish.complete")(function* <
  E,
>(complete: Effect.Effect<unknown, E>, leave: Effect.Effect<void>) {
  yield* complete.pipe(
    Effect.andThen(leave),
    Effect.catch(() =>
      Effect.sync(() => {
        toast.error(
          {
            description: "tryout-complete-part-error.description",
            title: "tryout-complete-part-error.title",
          },
          { position: "bottom-center" }
        );
      })
    )
  );
});
