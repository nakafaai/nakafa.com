import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { noteText } from "@repo/backend/confect/nina/judgment/ask";
import { judgments } from "@repo/backend/confect/nina/judgment/catalog";
import { ConvexCli } from "@repo/backend/scripts/development/cli";
import { measureSet, togetherOf } from "@repo/backend/scripts/judgment/measure";
import { messages } from "@repo/backend/test/judgment/message";
import { notes } from "@repo/backend/test/judgment/note";
import { encodeJsonText } from "@repo/utilities/json";
import {
  Array as Arr,
  Duration,
  Effect,
  FileSystem,
  Record as Rec,
  Schema,
} from "effect";

/**
 * The labels of the set by judgment and by text, each with the number of the
 * text among the messages or the notes: `lasting` is asked about messages, and
 * the other judgments about notes in the form `noteText` writes.
 */
const labels = {
  lasting: Rec.fromEntries(
    Arr.map(
      messages,
      ({ lasting, text }, index) =>
        [text, { label: lasting, number: index + 1 }] as const
    )
  ),
  ownNote: Rec.fromEntries(
    Arr.map(
      notes,
      (note, index) =>
        [noteText(note), { label: note.ownNote, number: index + 1 }] as const
    )
  ),
  private: Rec.fromEntries(
    Arr.map(
      notes,
      (note, index) =>
        [noteText(note), { label: note.private, number: index + 1 }] as const
    )
  ),
};

/** What the CLI double logged about one call: the function, and the names, texts and grouping it was given. */
const Call = Schema.fromJsonString(
  Schema.Struct({
    command: Schema.String,
    name: Schema.String,
    names: Schema.Array(Schema.String),
    texts: Schema.Array(Schema.String),
    together: Schema.Int,
  })
);

/**
 * A CLI double that logs each call and answers it as its plan file says, with
 * the answers of the action: a measurement of the texts, or `failed`.
 */
const FAKE_CLI = `
import { appendFileSync, readFileSync } from "node:fs";
const [log, planPath, command, name, json] = process.argv.slice(2);
const plan = JSON.parse(readFileSync(planPath, "utf8"));
const input = JSON.parse(json);
appendFileSync(
  log,
  JSON.stringify({
    command,
    name,
    names: input.names,
    texts: input.texts,
    together: input.together,
  }) + "\\n"
);
if (plan.unreachable) {
  process.stdout.write(
    JSON.stringify({
      failure: {
        _tag: "GatewayConfigurationError",
        message: "The AI gateway is not available on this deployment.",
      },
      kind: "failed",
    })
  );
} else {
  const rows = input.texts.map((text) =>
    plan.broken
      ? { failure: { reason: "invalid", status: 400 } }
      : {
          probabilities: Object.fromEntries(
            input.names.map((judgment) => {
              const { label, number } = plan.labels[judgment][text];
              const wrong = (plan.flipped[judgment] ?? []).includes(number);
              return [judgment, label === !wrong ? 0.9 : 0.1];
            })
          ),
        }
  );
  const thresholds = Object.fromEntries(
    input.names
      .filter((judgment) => judgment !== plan.omitted)
      .map((judgment) => [judgment, 0.5])
  );
  process.stdout.write(JSON.stringify({ kind: "measured", rows, thresholds }));
}
`;

/**
 * A folder with the CLI double and its plan in it, the log it writes, and the
 * way to start it. The double answers every call with a probability near the
 * label of each judgment asked, except for the texts that `flipped` names by
 * number for a judgment. `omitted` is a judgment that the deployment reports no
 * threshold for, `broken` makes the gateway refuse every text, and
 * `unreachable` makes the deployment answer that it cannot reach the gateway.
 */
const prepare = (plan: {
  readonly broken?: boolean;
  readonly flipped?: Readonly<Record<string, readonly number[]>>;
  readonly omitted?: string;
  readonly unreachable?: boolean;
}) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* fs.realPath(
      yield* fs.makeTempDirectoryScoped({ prefix: "judgment-measure-test-" })
    );
    const script = `${directory}/cli.mjs`;
    const log = `${directory}/calls.log`;
    const planPath = `${directory}/plan.json`;
    yield* fs.writeFileString(script, FAKE_CLI);
    yield* fs.writeFileString(
      planPath,
      encodeJsonText({ flipped: {}, labels, ...plan })
    );
    return {
      cli: {
        args: [script, log, planPath],
        command: process.execPath,
        cwd: directory,
        deadline: Duration.seconds(30),
        env: {},
      },
      log,
    };
  });

/** The calls that the CLI double logged, in order. */
const loggedCalls = (log: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    return yield* Effect.forEach(
      Arr.filter(
        (yield* fs.readFileString(log)).split("\n"),
        (line) => line !== ""
      ),
      (line) => Schema.decodeEffect(Call)(line)
    );
  });

describe("measuring the labelled set", () => {
  it.effect(
    "measures each judgment on the form production asks it, messages alone and notes in groups, and reports one table for each judgment of the catalog",
    () =>
      Effect.gen(function* () {
        const { cli, log } = yield* prepare({
          flipped: { lasting: [1, 53], ownNote: [3] },
        });

        const { failed, report } = yield* measureSet(1).pipe(
          Effect.provideService(ConvexCli, cli)
        );

        expect(failed).toBe(0);
        // 124 messages go in five calls of 30, and the notes in three.
        const calls = yield* loggedCalls(log);
        expect(Arr.map(calls, ({ names }) => names)).toEqual([
          ...Arr.makeBy(5, () => ["lasting"]),
          ...Arr.makeBy(3, () => ["ownNote", "private"]),
        ]);
        // A message is judged `lasting` as it is, and a note as its sentence with its quote.
        expect(calls[0]?.texts[0]).toBe(messages[0].text);
        expect(calls[5]?.texts[0]).toBe(noteText(notes[0]));
        expect(report).toContain(
          `${Arr.length(messages)} messages, one to a request, and ${Arr.length(notes)} notes, 1 to a request, measured on the development deployment.`
        );
        for (const name of Rec.keys(judgments)) {
          expect(report).toContain(`judgment ${name}:`);
        }
        // The texts the deployment got wrong, by number, language and no text.
        expect(report).toContain(
          "judged wrongly at 0.50 (message, label, probability, language, form):"
        );
        expect(report).toContain(
          "judged wrongly at 0.50 (note, label, probability, language, form):"
        );
        expect(report).toContain("    1  yes  0.10  id");
        expect(report).toContain("    3  yes  0.10  id");
        expect(report).not.toContain(messages[0].text);
        expect(report).not.toContain(notes[0].text);
        expect(report).not.toContain(notes[0].quote);
        expect(report).not.toContain("texts failed");
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "sends the notes of a turn together only when the caller names it, and keeps a group in one call",
    () =>
      Effect.gen(function* () {
        const { cli, log } = yield* prepare({});

        const { report } = yield* measureSet(3).pipe(
          Effect.provideService(ConvexCli, cli)
        );

        expect(report).toContain(
          `${Arr.length(messages)} messages, one to a request, and ${Arr.length(notes)} notes, 3 to a request, measured on the development deployment.`
        );
        const calls = yield* loggedCalls(log);
        const noteCalls = Arr.drop(calls, 5);
        expect(Arr.map(noteCalls, ({ together }) => together)).toEqual([
          3, 3, 3,
        ]);
        // Calls of 30 notes, ten groups of three, and the rest in the last call.
        expect(Arr.map(noteCalls, ({ texts }) => Arr.length(texts))).toEqual([
          30,
          30,
          Arr.length(notes) - 60,
        ]);
        // Messages are asked alone whatever the caller names.
        expect(Arr.map(Arr.take(calls, 5), ({ together }) => together)).toEqual(
          [1, 1, 1, 1, 1]
        );
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "counts the texts the deployment could not measure, and reports their routing facts and no table row",
    () =>
      Effect.gen(function* () {
        const { cli } = yield* prepare({ broken: true });
        const texts = Arr.length(messages) + Arr.length(notes);

        const { failed, report } = yield* measureSet(1).pipe(
          Effect.provideService(ConvexCli, cli)
        );

        expect(failed).toBe(texts);
        expect(report).toContain(
          `${texts} texts failed: invalid 400 (${texts})`
        );
        expect(report).toContain("at the threshold of the deployment, 0.50:");
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect.each(Rec.keys(judgments))(
    "fails with an error that names %s when the deployment reports no threshold for it, and prints no table",
    (omitted) =>
      Effect.gen(function* () {
        const { cli } = yield* prepare({ omitted });

        const error = yield* Effect.flip(
          measureSet(1).pipe(Effect.provideService(ConvexCli, cli))
        );

        expect(error).toMatchObject({
          _tag: "JudgmentCallError",
          message: `The deployment reports no threshold for the judgment ${omitted}.`,
        });
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "stops at the first call when the deployment cannot reach the gateway, so that no other call is spent, and fails with the reason",
    () =>
      Effect.gen(function* () {
        const { cli, log } = yield* prepare({ unreachable: true });

        const error = yield* Effect.flip(
          measureSet(1).pipe(Effect.provideService(ConvexCli, cli))
        );

        expect(error).toMatchObject({
          _tag: "JudgmentCallError",
          message:
            "Judgment measure failed: The AI gateway is not available on this deployment.",
        });
        expect(yield* loggedCalls(log)).toHaveLength(1);
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );
});

describe("notes that share a request", () => {
  it.effect.each([
    [[], 1],
    [["--together=3"], 3],
    [["--together=2"], 2],
  ] as const)("reads %j as %s notes to a request", ([args, together]) =>
    Effect.gen(function* () {
      expect(yield* togetherOf(args)).toBe(together);
    })
  );

  it.effect.each([
    "--together=0",
    "--together=4",
    "--together=2.5",
    "--together=x",
    "--together=",
  ])("refuses %s", (flag) =>
    Effect.gen(function* () {
      expect(yield* Effect.flip(togetherOf([flag]))).toMatchObject({
        _tag: "JudgmentCallError",
        message: "--together=N takes a whole number from 1 to 3.",
      });
    })
  );
});
