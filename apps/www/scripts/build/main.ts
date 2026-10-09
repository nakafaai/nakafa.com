import { runMain } from "@effect/platform-node/NodeRuntime";
import { layer } from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { runWatchedBuild } from "@/scripts/build/watch";

/**
 * Runs the command named on the command line, such as `next build`, under the
 * build watch. The process exits with the command's status, or with 1 after a
 * stall, whose one-line report goes to standard error.
 *
 * The `build` script runs it twice: `next build` in compile mode, then in
 * generate mode. In one process Next.js releases the compiler's memory in the
 * background while the page workers start, and the two together reach the
 * memory limit of the build container. As two processes, the compiler's memory
 * is gone before a page is generated.
 */
runMain(
  runWatchedBuild().pipe(
    Effect.tap((status) =>
      Effect.sync(() => {
        process.exitCode = status;
      })
    ),
    Effect.provide(layer)
  )
);
