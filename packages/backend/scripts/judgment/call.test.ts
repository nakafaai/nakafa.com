import { Ref } from "@confect/core";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { measureInputValidator } from "@repo/backend/confect/nina/judgment.spec";
import { ConvexCli } from "@repo/backend/scripts/development/cli";
import { callMeasure } from "@repo/backend/scripts/judgment/call";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Duration, Effect, FileSystem, Schema } from "effect";

const input = {
  names: ["ownNote", "private"],
  texts: [
    "Note: Kelas 12\nQuote: Aku kelas 12",
    "Note: Terima kasih\nQuote: Makasih",
  ],
  together: 2,
} satisfies Parameters<typeof callMeasure>[0];

/** What the action answers for those two texts: one measured, and one that the gateway refused. */
const measured = {
  kind: "measured",
  rows: [
    { probabilities: { ownNote: 0.95, private: 0.02 } },
    { failure: { reason: "invalid", status: 400 } },
  ],
  thresholds: { ownNote: 0.5, private: 0.5 },
};

/** What the action answers when the deployment cannot reach the gateway. */
const unreachable = {
  failure: {
    _tag: "GatewayConfigurationError",
    message: "The AI gateway is not available on this deployment.",
  },
  kind: "failed",
};

/**
 * A stand-in for what the CLI prints when it cannot run the function. The CLI
 * words the first line itself, and then prints the error of the call as its
 * name and the message the server sent (`run.ts` of the installed `convex`
 * package). No server was asked for this test, so that message is made up: the
 * test needs only that what the CLI printed reaches the report.
 */
const FAILED_CALL = `✖ Failed to run function "nina/judgment:measure":
Error: the server message, made up for this test`;

/** The arguments of a call, as JSON text that the function declares. */
const Arguments = Schema.fromJsonString(measureInputValidator);

/** The arguments the CLI double logged, one call to a line. */
const Calls = Schema.fromJsonString(Schema.Array(Schema.String));

/**
 * A CLI double that logs the arguments of each call to the file its first
 * argument names, and then prints, writes as an error and exits as its settings
 * (MEASURE_TEST_STDOUT, MEASURE_TEST_STDERR, MEASURE_TEST_CODE) tell it.
 */
const FAKE_CLI = `
import { appendFileSync } from "node:fs";
const [log, ...args] = process.argv.slice(2);
appendFileSync(log, JSON.stringify(args) + "\\n");
process.stdout.write(process.env.MEASURE_TEST_STDOUT ?? "");
process.stderr.write(process.env.MEASURE_TEST_STDERR ?? "");
process.exit(Number(process.env.MEASURE_TEST_CODE ?? 0));
`;

/**
 * Puts the two texts to the CLI double, which prints this text, writes this
 * error text and exits with this code, and returns how that ended with the
 * arguments the double was started with.
 */
const ask = (behavior: {
  readonly code?: string;
  readonly stderr?: string;
  readonly stdout?: string;
}) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* fs.realPath(
      yield* fs.makeTempDirectoryScoped({ prefix: "judgment-call-test-" })
    );
    const script = `${directory}/cli.mjs`;
    const log = `${directory}/calls.log`;
    yield* fs.writeFileString(script, FAKE_CLI);
    const answer = yield* callMeasure(input).pipe(
      Effect.provideService(ConvexCli, {
        args: [script, log],
        command: process.execPath,
        cwd: directory,
        deadline: Duration.seconds(30),
        env: {
          MEASURE_TEST_CODE: behavior.code ?? "0",
          MEASURE_TEST_STDERR: behavior.stderr ?? "",
          MEASURE_TEST_STDOUT: behavior.stdout ?? "",
        },
      }),
      Effect.result
    );
    const calls = yield* Effect.forEach(
      Arr.filter(
        (yield* fs.readFileString(log)).split("\n"),
        (line) => line !== ""
      ),
      (line) => Schema.decodeEffect(Calls)(line)
    );
    return { answer, calls };
  }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer));

describe("judgment measuring call", () => {
  it.live(
    "runs the action under the name that the deployment registers it by, with the arguments it declares, and reads its measurement",
    () =>
      Effect.gen(function* () {
        const { answer, calls } = yield* ask({
          stdout: encodeJsonText(measured),
        });

        expect(answer).toMatchObject({ _tag: "Success", success: measured });
        expect(calls).toHaveLength(1);
        const [command, name, text, ...others] = calls[0] ?? [];
        expect(command).toBe("run");
        expect(name).toBe(
          Ref.getConvexFunctionName(refs.internal.nina.judgment.measure)
        );
        expect(others).toEqual([]);
        expect(yield* Schema.decodeEffect(Arguments)(text ?? "")).toEqual(
          input
        );
      })
  );

  it.live(
    "fails with the reason that the action answers when the deployment cannot reach the gateway",
    () =>
      Effect.gen(function* () {
        const { answer } = yield* ask({ stdout: encodeJsonText(unreachable) });

        expect(answer).toMatchObject({
          _tag: "Failure",
          failure: {
            _tag: "JudgmentCallError",
            message:
              "Judgment measure failed: The AI gateway is not available on this deployment.",
          },
        });
      })
  );

  it.live.each([0, 1, 3])(
    "refuses an answer of %s rows for two texts, so that no row is matched with the wrong text",
    (count) =>
      Effect.gen(function* () {
        const { answer } = yield* ask({
          stdout: encodeJsonText({
            ...measured,
            rows: Arr.take(Arr.replicate(measured.rows[0], 3), count),
          }),
        });

        expect(answer).toMatchObject({
          _tag: "Failure",
          failure: {
            _tag: "JudgmentCallError",
            message: `Judgment measure: the deployment measured ${count} of 2 texts`,
          },
        });
      })
  );

  it.live("reports an action that cannot run with what the CLI printed", () =>
    Effect.gen(function* () {
      const { answer } = yield* ask({ code: "1", stderr: FAILED_CALL });

      expect(answer).toMatchObject({
        _tag: "Failure",
        failure: {
          _tag: "DevelopmentCliError",
          message: `Judgment measure failed: ${Arr.join(FAILED_CALL.split("\n"), " ")}`,
        },
      });
    })
  );

  it.live.each([
    ["a value the action does not declare", '{"kind":"measured"}'],
    ["text that is not JSON", "a line the CLI printed"],
  ])("rejects %s", ([, stdout]) =>
    Effect.gen(function* () {
      const { answer } = yield* ask({ stdout });

      expect(answer).toMatchObject({
        _tag: "Failure",
        failure: {
          _tag: "JudgmentCallError",
          message: expect.stringContaining(
            "Judgment measure printed an answer that the action does not declare"
          ),
        },
      });
    })
  );
});
