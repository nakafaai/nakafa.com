/**
 * Writes Amiri Quran's line faces (`src/styles/quran`) from the installed
 * `@fontsource/amiri-quran`, with the balanced metrics every engine reads. Run
 * it with `bun run quran:faces` after an update of that package.
 */
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { LINE_FACES, writeLineFaces } from "@/scripts/quran/line";

Effect.runPromise(
  writeLineFaces(LINE_FACES).pipe(
    Effect.catch((error) =>
      Effect.logError(`Could not write the line faces: ${error.message}`).pipe(
        Effect.andThen(
          Effect.sync(() => {
            process.exitCode = 1;
          })
        )
      )
    ),
    Effect.provide(NodeServices.layer)
  )
);
