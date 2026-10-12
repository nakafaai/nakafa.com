import { noteText } from "@repo/backend/confect/nina/judgment/note";
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

/**
 * What the CLI double logged about one call: the function, the settings that
 * pick the deployment (null when a setting is not set, and an empty text when
 * it is blank), and the names and texts the call was given.
 */
export const Call = Schema.fromJsonString(
  Schema.Struct({
    command: Schema.String,
    env: Schema.Struct({
      CONVEX_DEPLOYMENT: Schema.NullOr(Schema.String),
      CONVEX_DEPLOYMENT_TOKEN: Schema.NullOr(Schema.String),
      CONVEX_DEPLOY_KEY: Schema.NullOr(Schema.String),
    }),
    name: Schema.String,
    names: Schema.Array(Schema.String),
    texts: Schema.Array(Schema.String),
  })
);

/**
 * A double of the Convex CLI that runs the measuring action. It logs each call
 * and answers it as its plan file says, with the answers of the action: a
 * measurement of the texts, or `failed`. A judgment it measures has the entry
 * "instructions of <name>" and the threshold its plan names, 0.5 unless it
 * names one. `changed` gives one judgment another threshold or other
 * instructions from the second call that asks about it on, as a deployment does
 * that is deployed while the command runs.
 */
const FAKE_CLI = `
import { appendFileSync, readFileSync } from "node:fs";
const [log, planPath, command, name, json] = process.argv.slice(2);
const plan = JSON.parse(readFileSync(planPath, "utf8"));
const input = JSON.parse(json);
const setting = (key) =>
  Object.hasOwn(process.env, key) ? process.env[key] : null;
appendFileSync(
  log,
  JSON.stringify({
    command,
    env: {
      CONVEX_DEPLOYMENT: setting("CONVEX_DEPLOYMENT"),
      CONVEX_DEPLOYMENT_TOKEN: setting("CONVEX_DEPLOYMENT_TOKEN"),
      CONVEX_DEPLOY_KEY: setting("CONVEX_DEPLOY_KEY"),
    },
    name,
    names: input.names,
    texts: input.texts,
  }) + "\\n"
);
const asked = (judgment) =>
  readFileSync(log, "utf8")
    .split("\\n")
    .filter((line) => line !== "")
    .filter((line) => JSON.parse(line).names.includes(judgment)).length;
if (plan.hang) {
  setInterval(() => {}, 1000);
} else if (plan.unreachable) {
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
  const judgments = Object.fromEntries(
    input.names
      .filter((judgment) => judgment !== plan.omitted)
      .map((judgment) => {
        const changed =
          plan.changed?.judgment === judgment && asked(judgment) >= 2;
        return [
          judgment,
          {
            instructions:
              changed && plan.changed.field === "instructions"
                ? "other instructions of " + judgment
                : "instructions of " + judgment,
            threshold:
              changed && plan.changed.field === "threshold"
                ? 0.7
                : plan.thresholds[judgment] ?? 0.5,
          },
        ];
      })
  );
  process.stdout.write(JSON.stringify({ judgments, kind: "measured", rows }));
}
`;

/**
 * What the CLI double does. It answers every call with a probability near the
 * label of each judgment asked, except for the texts that `flipped` names by
 * number for a judgment. `thresholds` are the thresholds it reports, `omitted`
 * is a judgment that it reports no entry for, `changed` is described at the
 * double, `broken` makes the gateway refuse every text, `unreachable` makes the
 * deployment answer that it cannot reach the gateway, and `hang` makes it never
 * answer.
 */
const Plan = Schema.Struct({
  broken: Schema.optionalKey(Schema.Boolean),
  changed: Schema.optionalKey(
    Schema.Struct({
      field: Schema.Literals(["instructions", "threshold"]),
      judgment: Schema.String,
    })
  ),
  flipped: Schema.optionalKey(
    Schema.Record(Schema.String, Schema.Array(Schema.Int))
  ),
  hang: Schema.optionalKey(Schema.Boolean),
  omitted: Schema.optionalKey(Schema.String),
  thresholds: Schema.optionalKey(Schema.Record(Schema.String, Schema.Finite)),
  unreachable: Schema.optionalKey(Schema.Boolean),
});

/** A folder with the CLI double and its plan in it, the log it writes, and the way to start it. */
export const prepare = (plan: typeof Plan.Type = {}) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* fs.realPath(
      yield* fs.makeTempDirectoryScoped({ prefix: "judgment-cli-test-" })
    );
    const script = `${directory}/cli.mjs`;
    const log = `${directory}/calls.log`;
    const planPath = `${directory}/plan.json`;
    yield* fs.writeFileString(script, FAKE_CLI);
    yield* fs.writeFileString(
      planPath,
      encodeJsonText({ flipped: {}, labels, thresholds: {}, ...plan })
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

/** The calls that the CLI double logged, in order, none when it was never started. */
export const loggedCalls = (log: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    if (!(yield* fs.exists(log))) {
      return [];
    }
    return yield* Effect.forEach(
      Arr.filter(
        (yield* fs.readFileString(log)).split("\n"),
        (line) => line !== ""
      ),
      (line) => Schema.decodeEffect(Call)(line)
    );
  });
