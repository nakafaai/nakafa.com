import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { judgments } from "@repo/backend/confect/nina/judgment/catalog";
import { noteText } from "@repo/backend/confect/nina/judgment/note";
import { MEASURE_TEXT_LIMIT } from "@repo/backend/confect/nina/judgment.spec";
import { ConvexCli } from "@repo/backend/scripts/development/cli";
import { measureSet } from "@repo/backend/scripts/judgment/measure";
import {
  type Call,
  loggedCalls,
  prepare,
} from "@repo/backend/test/judgment/cli";
import { messages } from "@repo/backend/test/judgment/message";
import { notes } from "@repo/backend/test/judgment/note";
import { Array as Arr, Effect, Record as Rec } from "effect";

/** The number of texts in each of some calls. */
const sizesOf = (calls: readonly (typeof Call.Type)[]) =>
  Arr.map(calls, ({ texts }) => Arr.length(texts));

/** The texts of some calls, one after another. */
const textsOf = (calls: readonly (typeof Call.Type)[]) =>
  Arr.flatMap(calls, ({ texts }) => texts);

/** Whether some calls are full, except for the last, and none holds more than a call may. */
const fillsCalls = (calls: readonly (typeof Call.Type)[]) =>
  Arr.every(
    Arr.dropRight(sizesOf(calls), 1),
    (size) => size === MEASURE_TEXT_LIMIT
  ) && Arr.every(sizesOf(calls), (size) => size <= MEASURE_TEXT_LIMIT);

describe("measuring the labelled set", () => {
  it.effect(
    "sends each text of the set once, in the order of the set and in the form production asks it, in calls of at most the limit, and reports one table for each judgment of the catalog at the threshold the deployment holds",
    () =>
      Effect.gen(function* () {
        const { cli, log } = yield* prepare({
          flipped: { lasting: [1, 53], ownNote: [3] },
          thresholds: { lasting: 0.3, ownNote: 0.6 },
        });

        const { failed, report } = yield* measureSet().pipe(
          Effect.provideService(ConvexCli, cli)
        );

        expect(failed).toBe(0);
        const calls = yield* loggedCalls(log);
        const messageCalls = Arr.filter(calls, ({ names }) =>
          Arr.contains(names, "lasting")
        );
        const noteCalls = Arr.drop(calls, Arr.length(messageCalls));
        // A message is judged `lasting` as it is, and a note, as its sentence
        // with its quote, `ownNote` and `private`.
        expect(Arr.map(calls, ({ names }) => names)).toEqual([
          ...Arr.map(messageCalls, () => ["lasting"]),
          ...Arr.map(noteCalls, () => ["ownNote", "private"]),
        ]);
        expect(textsOf(messageCalls)).toEqual(
          Arr.map(messages, ({ text }) => text)
        );
        expect(textsOf(noteCalls)).toEqual(Arr.map(notes, noteText));
        expect(fillsCalls(messageCalls)).toBe(true);
        expect(fillsCalls(noteCalls)).toBe(true);
        expect(report).toContain(
          `${Arr.length(messages)} messages and ${Arr.length(notes)} notes, one text to a request, measured on the development deployment.`
        );
        for (const name of Rec.keys(judgments)) {
          expect(report).toContain(`judgment ${name}:`);
        }
        // The counts are at the threshold the deployment reports for each
        // judgment, and the texts it got wrong are named by number and
        // language, never quoted.
        expect(report).toContain("at the threshold of the deployment, 0.30:");
        expect(report).toContain("at the threshold of the deployment, 0.60:");
        expect(report).toContain("at the threshold of the deployment, 0.50:");
        expect(report).toContain(
          "judged wrongly at 0.30 (message, label, probability, language, form):"
        );
        expect(report).toContain(
          "judged wrongly at 0.60 (note, label, probability, language, form):"
        );
        expect(report).toContain("    1  yes  0.10  id");
        expect(report).toContain("    3  yes  0.10  id");
        expect(report).not.toContain(messages[0].text);
        expect(report).not.toContain(notes[0].text);
        expect(report).not.toContain(notes[0].quote);
        expect(report).not.toContain("texts failed");
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer)),
    30_000
  );

  it.effect(
    "counts the texts the deployment could not measure, and reports their routing facts and tables that hold no text",
    () =>
      Effect.gen(function* () {
        const { cli } = yield* prepare({ broken: true });
        const texts = Arr.length(messages) + Arr.length(notes);

        const { failed, report } = yield* measureSet().pipe(
          Effect.provideService(ConvexCli, cli)
        );

        expect(failed).toBe(texts);
        expect(report).toContain(
          `${texts} texts failed: invalid 400 (${texts})`
        );
        expect(report).toContain(
          "judgment lasting: 0 messages labelled yes, 0 labelled no"
        );
        expect(report).toContain(
          "judgment ownNote: 0 notes labelled yes, 0 labelled no"
        );
        expect(report).toContain(
          "judgment private: 0 notes labelled yes, 0 labelled no"
        );
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer)),
    30_000
  );

  it.effect.each(Rec.keys(judgments))(
    "fails with an error that names %s when the deployment reports no threshold for it",
    (omitted) =>
      Effect.gen(function* () {
        const { cli } = yield* prepare({ omitted });

        const error = yield* Effect.flip(
          measureSet().pipe(Effect.provideService(ConvexCli, cli))
        );

        expect(error).toMatchObject({
          _tag: "JudgmentCallError",
          message: `The deployment reports no threshold for the judgment ${omitted}.`,
        });
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer)),
    30_000
  );

  it.effect.each([
    ["lasting", "threshold"],
    ["lasting", "instructions"],
    ["ownNote", "threshold"],
    ["private", "instructions"],
  ] as const)(
    "fails with an error that names %s when a later call answers with other %s than the first call, because the deployment changed while the command ran",
    ([judgment, field]) =>
      Effect.gen(function* () {
        const { cli } = yield* prepare({ changed: { field, judgment } });

        const error = yield* Effect.flip(
          measureSet().pipe(Effect.provideService(ConvexCli, cli))
        );

        expect(error).toMatchObject({
          _tag: "JudgmentCallError",
          message: `The deployment answered with a different ${judgment} in two calls of one run, so it changed while the command ran. Run the command again.`,
        });
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer)),
    30_000
  );

  it.effect(
    "stops at the first call when the deployment cannot reach the gateway, so that no other call is spent, and fails with the reason",
    () =>
      Effect.gen(function* () {
        const { cli, log } = yield* prepare({ unreachable: true });

        const error = yield* Effect.flip(
          measureSet().pipe(Effect.provideService(ConvexCli, cli))
        );

        expect(error).toMatchObject({
          _tag: "JudgmentCallError",
          message:
            "Judgment measure failed: The AI gateway is not available on this deployment.",
        });
        expect(yield* loggedCalls(log)).toHaveLength(1);
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer)),
    30_000
  );
});
