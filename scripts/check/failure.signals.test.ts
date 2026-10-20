import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { effectFindings } from "#scripts/check/effect";
import { parseSources } from "#scripts/check/source";

/** Lists the Effect-native findings of one module as `line rule`. */
const findings = Effect.fn("FailureSignalsTest.findings")(function* (
  sourceText: string
) {
  const found = yield* effectFindings(
    yield* parseSources([{ file: "apps/www/src/lib/example.ts", sourceText }])
  );
  return Arr.map(found, ({ line, rule }) => `${line} ${rule}`);
}, Effect.scoped);

describe("router signals", () => {
  it.effect(
    "exempts the router signals that the module imports from TanStack",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`import { notFound, redirect as route } from "@tanstack/react-router";
export function load(value: string | undefined) {
  if (value === undefined) {
    throw notFound();
  }
  throw route({ to: "/en" });
}
export function unimported() {
  throw answerNotFound();
}
export function failure() {
  throw new Error("bad");
}
`),
          ["9 throw", "12 throw"]
        );
      })
  );
});
