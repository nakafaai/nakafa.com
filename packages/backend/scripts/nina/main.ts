import { runMain } from "@effect/platform-node/NodeRuntime";
import { layer } from "@effect/platform-node/NodeServices";
import { renderReport, runGate } from "@repo/backend/scripts/nina/gate";
import { DeploymentLive } from "@repo/backend/scripts/nina/live";
import { Array as Arr, Effect } from "effect";

/**
 * Runs one real Nina turn through the gateway on the deployment that the
 * caller's configuration names, prints the table of what it used, and exits
 * with 0 when the turn passes and with 1 when it does not.
 */
const main = Effect.gen(function* () {
  const report = yield* runGate().pipe(Effect.provide(DeploymentLive));
  yield* Effect.sync(() => {
    process.stdout.write(`${renderReport(report)}\n`);
    process.exitCode = Arr.isReadonlyArrayEmpty(report.failures) ? 0 : 1;
  });
});

runMain(main.pipe(Effect.provide(layer)));
