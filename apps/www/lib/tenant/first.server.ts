import "@tanstack/react-start/server-only";
import { Effect } from "effect";

/**
 * Keeps a first-screen read from failing its page. A read that the server could
 * not answer logs its cause and yields no value, so the page's live query decides
 * what the viewer sees, and its own boundary shows a failure in place of the part.
 * The school layout's own read still fails the page, because no part of a school
 * can show without the school.
 */
export const orUndefined = <A, E, R>(
  read: Effect.Effect<A, E, R>
): Effect.Effect<A | undefined, never, R> =>
  read.pipe(
    Effect.catch((error) =>
      Effect.logError(
        "A school first screen could not be read on the server; the live query answers the page.",
        error
      ).pipe(Effect.as(undefined))
    )
  );
