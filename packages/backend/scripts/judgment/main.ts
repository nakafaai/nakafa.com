import { runMain } from "@effect/platform-node/NodeRuntime";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { loadCustomerEnvProvider } from "@repo/backend/scripts/customers/convex";
import { measureSet, togetherOf } from "@repo/backend/scripts/judgment/measure";
import { Array as Arr, ConfigProvider, Effect } from "effect";

/**
 * Runs the labelled set of messages through the judgments of a deployment and
 * prints how they did. The deployment is development unless the command is
 * given `--prod`, and the command prints no message, only its number in the set.
 * It exits with 1 when the deployment could not measure some message.
 */
const main = Effect.gen(function* () {
  const args = yield* Effect.sync(() => Arr.drop(process.argv, 2));
  const together = yield* togetherOf(args);
  const provider = yield* loadCustomerEnvProvider();
  const { failed, report } = yield* measureSet(
    Arr.contains(args, "--prod"),
    together
  ).pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider));
  yield* Effect.sync(() => {
    process.stdout.write(`${report}\n`);
    process.exitCode = failed > 0 ? 1 : 0;
  });
});

runMain(main.pipe(Effect.provide(nodeServicesLayer)));
