import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { noteText } from "@repo/backend/confect/nina/judgment/ask";
import { judgments } from "@repo/backend/confect/nina/judgment/catalog";
import { measureSet, togetherOf } from "@repo/backend/scripts/judgment/measure";
import { messages } from "@repo/backend/test/judgment/message";
import { notes } from "@repo/backend/test/judgment/note";
import {
  Array as Arr,
  ConfigProvider,
  Effect,
  FileSystem,
  Layer,
  Option,
  Path,
  Record as Rec,
  Schema,
} from "effect";
import { FetchHttpClient } from "effect/http";

const configured = ConfigProvider.fromEnvRecord({
  CONVEX_DEPLOY_KEY: "test-key",
  CONVEX_PROD_URL: "https://prod.example",
  CONVEX_URL: "https://dev.example",
});

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();

/**
 * The real path service beside a file system that holds no file. The key in the
 * configuration is the credential, so a read of the local Convex login fails
 * the test.
 */
const noFiles = Layer.merge(Path.layer, FileSystem.layerNoop({}));

/** The texts of one call, as the action received them. */
const Posted = Schema.Struct({
  args: Schema.Struct({
    names: Schema.Array(Schema.String),
    texts: Schema.Array(Schema.String),
    together: Schema.Int,
  }),
});

/**
 * The label a judgment should give a text the command posted, and the text's
 * number among the messages or the notes: `lasting` is asked about messages,
 * and the other judgments about notes in the form `noteText` writes.
 */
function labelled(name: string, text: string) {
  return name === "lasting"
    ? Option.map(
        Arr.findFirstIndex(messages, (message) => message.text === text),
        (index) => ({ label: messages[index].lasting, number: index + 1 })
      )
    : Option.map(
        Arr.findFirstIndex(notes, (note) => noteText(note) === text),
        (index) => ({
          label:
            name === "ownNote" ? notes[index].ownNote : notes[index].private,
          number: index + 1,
        })
      );
}

/**
 * What the action answers for a call: for every posted text, a probability near
 * the label of each judgment asked, except for the texts a test names by number
 * for a judgment. `omitted` is a judgment the deployment reports no threshold
 * for.
 */
function actionAnswers({
  flipped = {},
  omitted,
}: {
  readonly flipped?: Partial<Record<string, readonly number[]>>;
  readonly omitted?: string;
} = {}) {
  fetcher.mockImplementation(async (_, init) => {
    const { args } = Schema.decodeUnknownSync(Posted)(
      await new Response(init?.body).json()
    );
    return Response.json({
      status: "success",
      value: {
        rows: Arr.map(args.texts, (text) => ({
          probabilities: Rec.fromEntries(
            Arr.map(args.names, (name) => {
              const { label, number } = Option.getOrThrow(labelled(name, text));
              const wrong = Arr.contains(flipped[name] ?? [], number);
              return [name, label === !wrong ? 0.9 : 0.1] as const;
            })
          ),
        })),
        thresholds: Rec.fromEntries(
          Arr.map(
            Arr.filter(args.names, (name) => name !== omitted),
            (name) => [name, 0.5] as const
          )
        ),
      },
    });
  });
}

/** Runs the set through the controlled deployment and fetch. */
function run(prod: boolean, together: number) {
  return measureSet(prod, together).pipe(
    Effect.provideService(ConfigProvider.ConfigProvider, configured),
    Effect.provideService(FetchHttpClient.Fetch, fetcher),
    Effect.provide(noFiles)
  );
}

/** What the command posted in each call, in the order of the calls. */
function posted() {
  return Effect.forEach(fetcher.mock.calls, ([, init]) =>
    Effect.promise(() => new Response(init?.body).json()).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(Posted)),
      Effect.map(({ args }) => args)
    )
  );
}

beforeEach(() => {
  fetcher.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("measuring the labelled set", () => {
  it.effect(
    "measures each judgment on the form production asks it, messages alone and notes in groups, and reports one table for each judgment of the catalog",
    () =>
      Effect.gen(function* () {
        actionAnswers({ flipped: { lasting: [1, 53], ownNote: [3] } });
        const { failed, report } = yield* run(false, 1);
        expect(failed).toBe(0);
        // 124 messages go in five calls of 30, and the notes in three.
        expect(fetcher).toHaveBeenCalledTimes(8);
        expect(fetcher.mock.calls[0]?.[0]).toEqual(
          new URL("https://dev.example/api/action")
        );
        const calls = yield* posted();
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
      })
  );

  it.effect(
    "sends the notes of a turn together to production only when the caller names it, and keeps a group in one call",
    () =>
      Effect.gen(function* () {
        actionAnswers();
        const { report } = yield* run(true, 3);
        expect(fetcher.mock.calls[0]?.[0]).toEqual(
          new URL("https://prod.example/api/action")
        );
        expect(report).toContain(
          `${Arr.length(messages)} messages, one to a request, and ${Arr.length(notes)} notes, 3 to a request, measured on production.`
        );
        const calls = yield* posted();
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
      })
  );

  it.effect(
    "counts the texts the deployment could not measure, and reports their routing facts and no table row",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation(async (_, init) => {
          const { args } = Schema.decodeUnknownSync(Posted)(
            await new Response(init?.body).json()
          );
          return Response.json({
            status: "success",
            value: {
              rows: Arr.map(args.texts, () => ({
                failure: { reason: "invalid", status: 400 },
              })),
              thresholds: Rec.fromEntries(
                Arr.map(args.names, (name) => [name, 0.5] as const)
              ),
            },
          });
        });
        const texts = Arr.length(messages) + Arr.length(notes);
        const { failed, report } = yield* run(false, 1);
        expect(failed).toBe(texts);
        expect(report).toContain(
          `${texts} texts failed: invalid 400 (${texts})`
        );
        expect(report).toContain("at the threshold of the deployment, 0.50:");
      })
  );

  it.effect.each(Rec.keys(judgments))(
    "fails with an error that names %s when the deployment reports no threshold for it, and prints no table",
    (omitted) =>
      Effect.gen(function* () {
        actionAnswers({ omitted });
        expect(yield* Effect.flip(run(false, 1))).toMatchObject({
          _tag: "JudgmentCallError",
          message: `The deployment reports no threshold for the judgment ${omitted}.`,
        });
      })
  );

  it.effect(
    "fails when the deployment answers fewer rows than the texts it was given, and prints nothing",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValue(
          Response.json({
            status: "success",
            value: {
              rows: [{ probabilities: { lasting: 0.9 } }],
              thresholds: { lasting: 0.5 },
            },
          })
        );
        expect(yield* Effect.flip(run(false, 1))).toMatchObject({
          _tag: "JudgmentCallError",
          message:
            "nina/judgment:measure: the deployment measured 1 of 30 texts",
        });
      })
  );
});

describe("notes that share a request", () => {
  it.effect.each([
    [[], 1],
    [["--prod"], 1],
    [["--prod", "--together=3"], 3],
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
