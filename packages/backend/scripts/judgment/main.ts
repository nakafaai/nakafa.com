import { runMain } from "@effect/platform-node/NodeRuntime";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import {
  ConvexCli,
  requireDevelopment,
} from "@repo/backend/scripts/development/cli";
import { measureSet, togetherOf } from "@repo/backend/scripts/judgment/measure";
import { Array as Arr, Duration, Effect } from "effect";

/**
 * How long the CLI may take for one call of the measuring action. The CLI waits
 * for the answer in one request, and Node's `fetch` gives up on a request that
 * gets no answer after five minutes (measured for the model test of knowledge
 * search, `scripts/knowledge/main.ts`), so no call can be given longer. A call
 * stays well inside that. It holds at most `MEASURE_TEXT_LIMIT` texts, which
 * the action asks the gateway about in groups, four at a time
 * (`GROUPS_IN_FLIGHT` of `confect/nina/judgment/measure.ts`), and every request
 * ends after the decision deadline of 10 seconds (`gateway/purpose.ts`). For 30
 * texts asked one to a group, that is 8 rounds of 10 seconds at most, even when
 * the gateway never answers. The labelled set is more than one call holds, so
 * it goes up in several calls, one after another. A call that passes this
 * deadline is not a slow gateway.
 */
const CALL_DEADLINE = Duration.minutes(5);

/**
 * Runs the labelled set of messages and notes through the judgments of the dev
 * deployment of this checkout and prints how they did. It runs only when the
 * deployment check allows it, and the CLI then goes to the deployment that the
 * check looked at. The command prints no text of the set, only its number. It
 * exits with 1 when the deployment could not measure some text.
 */
const main = Effect.gen(function* () {
  const args = yield* Effect.sync(() => Arr.drop(process.argv, 2));
  const together = yield* togetherOf(args);
  const settings = yield* requireDevelopment();
  const cli = yield* ConvexCli;
  const { failed, report } = yield* measureSet(together).pipe(
    Effect.provideService(ConvexCli, {
      ...cli,
      deadline: CALL_DEADLINE,
      env: { ...cli.env, ...settings },
    })
  );
  yield* Effect.sync(() => {
    process.stdout.write(`${report}\n`);
    process.exitCode = failed > 0 ? 1 : 0;
  });
});

runMain(main.pipe(Effect.provide(nodeServicesLayer)));
