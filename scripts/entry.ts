import { runMain } from "@effect/platform-node/NodeRuntime";
import { layer, type NodeServices } from "@effect/platform-node/NodeServices";
import { Effect, Predicate } from "effect";

/**
 * Runs one repository maintenance program when Node starts its module.
 *
 * A numeric success is the process exit status, and any other success exits
 * normally. Typed failures keep the runtime's default error report and
 * failure exit code.
 */
export function runEntry<E>(
  main: boolean,
  program: Effect.Effect<unknown, E, NodeServices>
) {
  if (!main) {
    return;
  }
  runMain(
    program.pipe(
      Effect.tap((status) =>
        Effect.sync(() => {
          if (Predicate.isNumber(status) && status !== 0) {
            process.exitCode = status;
          }
        })
      ),
      Effect.provide(layer)
    )
  );
}
