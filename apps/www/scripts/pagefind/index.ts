import { Effect } from "effect";
import {
  buildPagefindIndex,
  handlePagefindError,
} from "@/scripts/pagefind/build";

Effect.runPromise(
  Effect.tryPromise({
    try: () => buildPagefindIndex(),
    catch: (error) => error,
  }).pipe(
    Effect.catchAll((error) => Effect.sync(() => handlePagefindError(error)))
  )
);
