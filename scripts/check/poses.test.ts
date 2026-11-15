import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect, Record as Rec } from "effect";
import { inspectPoses } from "#scripts/check/poses";
import { parseSources } from "#scripts/check/source";

/** The rule's sentence after the places it names. */
const FIX =
  "Give this place an act of its own from packages/mascot/nina/act.ts, the one that fits what she does here, so she never does one thing in two places.";

/** Inspects modules with the act policy alone. */
function inspect(files: Readonly<Record<string, string>>) {
  return Effect.scoped(
    Effect.map(
      parseSources(
        Arr.map(Rec.toEntries(files), ([file, sourceText]) => ({
          file,
          sourceText,
        }))
      ),
      ({ modules }) => inspectPoses(modules)
    )
  );
}

describe("Nina act source policy", () => {
  it.effect("rejects an act that two modules draw, at each of them", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect({
          "apps/www/src/components/exams.tsx": `
export function Exams() {
  return <EmptyState scene={<EmptyNina act="pointing" />} title={t("empty")} />;
}`,
          "apps/www/src/components/rooms.tsx": `
export function Rooms() {
  return <EmptyState scene={<DeferredEmptyNina act="pointing" />} title={t("empty")} />;
}`,
        }),
        [
          `apps/www/src/components/exams.tsx:3: Nina is "pointing" here and in 1 other place (apps/www/src/components/rooms.tsx). ${FIX}`,
          `apps/www/src/components/rooms.tsx:3: Nina is "pointing" here and in 1 other place (apps/www/src/components/exams.tsx). ${FIX}`,
        ]
      );
    })
  );

  it.effect(
    "names three of an act's other places and counts the rest, whichever way the act is written",
    () =>
      Effect.gen(function* () {
        const findings = yield* inspect({
          "apps/www/src/components/a.tsx": `
export function A() {
  return <Nina act={failed ? "searching" : "waving"} whole />;
}`,
          "apps/www/src/components/b.tsx": `
const ACTS = { failed: "searching", open: "reading" } as const;
export function B({ state }) {
  return <EmptyNina act={ACTS[state]} />;
}`,
          "apps/www/src/components/c.tsx": `
const SCENES = { missing: { act: "searching", things: ["letter"] } } as const;
export function C({ scene }) {
  const { act } = SCENES[scene];
  return <Nina act={act} whole />;
}`,
          "apps/www/src/components/d.tsx": `
export function D() {
  return <Nina act="searching" whole />;
}`,
          "apps/www/src/components/e.tsx": `
export function E() {
  return <TryoutDemoNina act="searching" />;
}`,
        });
        assert.deepStrictEqual(Arr.take(findings, 1), [
          `apps/www/src/components/a.tsx:3: Nina is "searching" here and in 4 other places (apps/www/src/components/b.tsx, apps/www/src/components/c.tsx, apps/www/src/components/d.tsx, and 1 more). ${FIX}`,
        ]);
        assert.strictEqual(findings.length, 5);
      })
  );

  it.effect(
    "accepts one act in several states of one module, a wrapper that hands its act on, a toy, and what is no act of hers",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect({
            "apps/www/src/components/classes.tsx": `
let unset;
const { held } = table;
function helper() {}
export function Classes() {
  return (
    <>
      <EmptyState scene={<EmptyNina act="teaching" />} title={t("denied")} />
      <EmptyState scene={<EmptyNina act="teaching" />} title={t("empty")} />
      <Nina label="" size={32} />
      <this.Nina act="teaching" />
      <Button act="teaching" />
    </>
  );
}`,
            "apps/www/src/components/state/nina.tsx": `
export function EmptyNina({ act }) {
  return <Nina act={act} whole />;
}`,
            "apps/www/src/components/toys.tsx": `
const moves = { "act": "teaching", act: held, other: "teaching" };
export function Toys() {
  return <NinaToy act="teaching" slot="hero" />;
}`,
            "apps/www/src/components/names.ts": `
export const scene = { act: "teaching" };`,
          }),
          []
        );
      })
  );
});
