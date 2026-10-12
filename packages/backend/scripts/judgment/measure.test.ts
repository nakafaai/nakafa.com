import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { measureSet, togetherOf } from "@repo/backend/scripts/judgment/measure";
import { labelledSet } from "@repo/backend/test/judgment/set";
import {
  Array as Arr,
  ConfigProvider,
  Effect,
  FileSystem,
  Layer,
  Option,
  Path,
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
    texts: Schema.Array(Schema.String),
    together: Schema.Int,
  }),
});

/** The number in the set, counted from 1, of the message that has this text. */
function numberOf(text: string) {
  return (
    Option.getOrThrow(
      Arr.findFirstIndex(labelledSet, (message) => message.text === text)
    ) + 1
  );
}

/** What the action answers for a call: a probability near each label, except for the messages a test names by number. */
function actionAnswers(wrong: readonly number[] = []) {
  fetcher.mockImplementation(async (_, init) => {
    const { args } = Schema.decodeUnknownSync(Posted)(
      await new Response(init?.body).json()
    );
    return Response.json({
      status: "success",
      value: {
        rows: Arr.map(args.texts, (text) => {
          const number = numberOf(text);
          const message = labelledSet[number - 1];
          const flipped = Arr.contains(wrong, number);
          const near = (label: boolean) => (label === !flipped ? 0.9 : 0.1);
          return {
            probabilities: {
              lasting: near(message.lasting),
              private: near(message.private),
            },
          };
        }),
        thresholds: { lasting: 0.5, private: 0.5 },
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

beforeEach(() => {
  fetcher.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("measuring the labelled set", () => {
  it.effect(
    "sends the whole set to the development deployment in calls of 30 messages, and reports one table for each judgment",
    () =>
      Effect.gen(function* () {
        actionAnswers([1, 53]);
        const { failed, report } = yield* run(false, 1);
        expect(failed).toBe(0);
        expect(fetcher).toHaveBeenCalledTimes(5);
        expect(fetcher.mock.calls[0]?.[0]).toEqual(
          new URL("https://dev.example/api/action")
        );
        expect(report).toContain(
          `${Arr.length(labelledSet)} messages measured on the development deployment, 1 to a request.`
        );
        expect(report).toContain("judgment lasting:");
        expect(report).toContain("judgment private:");
        // The two messages the deployment got wrong, by number, language and no text.
        expect(report).toContain("judged wrongly at 0.50");
        expect(report).toContain("    1  yes  0.10  id");
        expect(report).not.toContain(labelledSet[0].text);
        expect(report).not.toContain("messages failed");
      })
  );

  it.effect(
    "sends groups to production only when the caller names it, and keeps a group in one call",
    () =>
      Effect.gen(function* () {
        actionAnswers();
        const { report } = yield* run(true, 4);
        expect(fetcher.mock.calls[0]?.[0]).toEqual(
          new URL("https://prod.example/api/action")
        );
        expect(report).toContain("on production, 4 to a request.");
        const sizes = yield* Effect.forEach(fetcher.mock.calls, ([, init]) =>
          Effect.promise(() => new Response(init?.body).json()).pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(Posted)),
            Effect.map(({ args }) => Arr.length(args.texts))
          )
        );
        // 28 messages a call is the most whole groups of 4 under 30.
        expect(Arr.take(sizes, Arr.length(sizes) - 1)).toEqual(
          Arr.makeBy(Arr.length(sizes) - 1, () => 28)
        );
      })
  );

  it.effect(
    "counts the messages the deployment could not measure, and reports their routing facts and no table row",
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
              thresholds: {},
            },
          });
        });
        const { failed, report } = yield* run(false, 1);
        expect(failed).toBe(Arr.length(labelledSet));
        expect(report).toContain(
          `${Arr.length(labelledSet)} messages failed: invalid 400 (${Arr.length(labelledSet)})`
        );
        // The deployment named no threshold, so the table uses the one of this checkout.
        expect(report).toContain("at the threshold of the deployment, 0.50:");
      })
  );
});

describe("messages that share a request", () => {
  it.effect.each([
    [[], 1],
    [["--prod"], 1],
    [["--prod", "--together=3"], 3],
    [["--together=8"], 8],
  ] as const)("is %j messages here: %s", ([args, together]) =>
    Effect.gen(function* () {
      expect(yield* togetherOf(args)).toBe(together);
    })
  );

  it.effect.each([
    "--together=0",
    "--together=9",
    "--together=2.5",
    "--together=x",
    "--together=",
  ])("refuses %s", (flag) =>
    Effect.gen(function* () {
      expect(yield* Effect.flip(togetherOf([flag]))).toMatchObject({
        _tag: "JudgmentCallError",
        message: "--together=N takes a whole number from 1 to 8.",
      });
    })
  );
});
