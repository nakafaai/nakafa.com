import { Ref } from "@confect/core";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { compareInputValidator } from "@repo/backend/confect/contents/sections/compare.spec";
import { ConvexCli } from "@repo/backend/scripts/development/cli";
import { rankModel } from "@repo/backend/scripts/knowledge/convex";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Duration, Effect, FileSystem, Schema } from "effect";

const input = {
  locale: "id",
  model: "google/gemini-embedding-2",
  questions: [
    {
      contentKey: "material/lesson/mathematics/matrix/matrix-addition",
      ordinal: 5,
      question: "Bisakah dua matriks yang berbeda ukuran dijumlahkan?",
    },
  ],
} satisfies Parameters<typeof rankModel>[0];
const ranked = {
  kind: "ranked",
  pool: 3189,
  refused: 0,
  verdicts: [
    { milliseconds: 41, section: { heading: "Matriks", rank: 2 } },
    { milliseconds: 38, section: null },
  ],
};

/**
 * A stand-in for what the CLI prints when it cannot run the function. The CLI
 * words the first line itself, and then prints the error of the call as its
 * name and the message the server sent (`run.ts` of the installed `convex`
 * package). No server was asked for this test, so that message is made up: the
 * test needs only that what the CLI printed reaches the report.
 */
const FAILED_CALL = `✖ Failed to run function "contents/sections/compare:rank":
Error: the server message, made up for this test`;

/** What the function answers when the gateway refuses a request of the run. */
const refused = {
  failure: {
    _tag: "GatewayFailure",
    reason: "rate-limit",
    retryAfter: 2,
    retryable: true,
    status: 429,
  },
  kind: "failed",
};

/** The arguments of a call, as JSON text that the function declares. */
const Arguments = Schema.fromJsonString(compareInputValidator);

/** The arguments the CLI double logged, one call to a line. */
const Calls = Schema.fromJsonString(Schema.Array(Schema.String));

/**
 * A CLI double that logs the arguments of each call to the file its first
 * argument names, and then prints, writes as an error and exits as its settings
 * (RANK_TEST_STDOUT, RANK_TEST_STDERR, RANK_TEST_CODE) tell it.
 */
const FAKE_CLI = `
import { appendFileSync } from "node:fs";
const [log, ...args] = process.argv.slice(2);
appendFileSync(log, JSON.stringify(args) + "\\n");
process.stdout.write(process.env.RANK_TEST_STDOUT ?? "");
process.stderr.write(process.env.RANK_TEST_STDERR ?? "");
process.exit(Number(process.env.RANK_TEST_CODE ?? 0));
`;

/**
 * Puts the question to the CLI double, which prints this text, writes this
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
      yield* fs.makeTempDirectoryScoped({ prefix: "knowledge-rank-test-" })
    );
    const script = `${directory}/cli.mjs`;
    const log = `${directory}/calls.log`;
    yield* fs.writeFileString(script, FAKE_CLI);
    const answer = yield* rankModel(input).pipe(
      Effect.provideService(ConvexCli, {
        args: [script, log],
        command: process.execPath,
        cwd: directory,
        deadline: Duration.seconds(30),
        env: {
          RANK_TEST_CODE: behavior.code ?? "0",
          RANK_TEST_STDERR: behavior.stderr ?? "",
          RANK_TEST_STDOUT: behavior.stdout ?? "",
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

describe("model test deployment boundary", () => {
  it.live(
    "runs the function under the name that the deployment registers it by, with the arguments it declares",
    () =>
      Effect.gen(function* () {
        const { answer, calls } = yield* ask({
          stdout: encodeJsonText(ranked),
        });

        expect(answer).toMatchObject({ _tag: "Success", success: ranked });
        expect(calls).toHaveLength(1);
        const [command, name, text, ...others] = calls[0] ?? [];
        expect(command).toBe("run");
        expect(name).toBe(
          Ref.getConvexFunctionName(
            refs.internal.contents.sections.compare.rank
          )
        );
        expect(others).toEqual([]);
        expect(yield* Schema.decodeEffect(Arguments)(text ?? "")).toEqual(
          input
        );
      })
  );

  it.live("decodes the answer that the index holds no section", () =>
    Effect.gen(function* () {
      const { answer } = yield* ask({ stdout: '{"kind":"empty"}\n' });

      expect(answer).toMatchObject({
        _tag: "Success",
        success: { kind: "empty" },
      });
    })
  );

  it.live("decodes a request that the gateway refused as an answer", () =>
    Effect.gen(function* () {
      const { answer } = yield* ask({ stdout: encodeJsonText(refused) });

      expect(answer).toMatchObject({
        _tag: "Success",
        success: {
          failure: {
            _tag: "GatewayFailure",
            reason: "rate-limit",
            status: 429,
          },
          kind: "failed",
        },
      });
    })
  );

  it.live("reports a function that cannot run with what the CLI printed", () =>
    Effect.gen(function* () {
      const { answer } = yield* ask({ code: "1", stderr: FAILED_CALL });

      expect(answer).toMatchObject({
        _tag: "Failure",
        failure: {
          _tag: "DevelopmentCliError",
          message: `Model test failed: ${Arr.join(FAILED_CALL.split("\n"), " ")}`,
        },
      });
    })
  );

  it.live.each([
    ["a value the function does not declare", '{"kind":"ranked"}'],
    ["text that is not JSON", "a line the CLI printed"],
  ])("rejects %s", ([, stdout]) =>
    Effect.gen(function* () {
      const { answer } = yield* ask({ stdout });

      expect(answer).toMatchObject({
        _tag: "Failure",
        failure: {
          _tag: "KnowledgeConvexError",
          message: expect.stringContaining(
            "Model test printed an answer that the function does not declare"
          ),
        },
      });
    })
  );
});
