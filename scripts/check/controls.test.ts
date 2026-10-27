import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectNativeControls } from "#scripts/check/controls";
import { parseSources } from "#scripts/check/source";

const VIEW = "apps/www/src/components/example.tsx";

/** Inspects one module with the native-controls policy alone. */
function inspect(sourceText: string, file = VIEW) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectNativeControls(parsed.file, parsed.sourceFile)
      )
    )
  );
}

describe("native controls policy", () => {
  it.effect(
    "rejects an input whose type the browser draws, naming the field that replaces it",
    () =>
      Effect.gen(function* () {
        const violations = yield* inspect(`
export function Period() {
  return (
    <form>
      <input onChange={() => undefined} type="date" />
      <input type="number"></input>
    </form>
  );
}`);
        assert.deepStrictEqual(violations, [
          `${VIEW}: use DatePicker from @repo/design-system/components/ui/date instead of <input type="date">, whose control the browser draws itself.`,
          `${VIEW}: use NumberField from @repo/design-system/components/ui/number instead of <input type="number">, whose control the browser draws itself.`,
        ]);
      })
  );

  it.effect("rejects a native select", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(`
export function Grade() {
  return <select><option>7</option></select>;
}`);
      assert.deepStrictEqual(violations, [
        `${VIEW}: use Select from @repo/design-system/components/ui/select instead of a native <select>, which the browser draws itself.`,
      ]);
    })
  );

  it.effect(
    "keeps text, file and hidden inputs, inputs without a written type, and components",
    () =>
      Effect.gen(function* () {
        const violations = yield* inspect(`
export function Fields({ kind }: { kind: string }) {
  return (
    <>
      <input type="text" />
      <input className="hidden" type="file" />
      <input />
      <input type={kind} />
      <input type />
      <input {...{ type: kind }} />
      <XAxis type="number" />
      <Select type="date" />
    </>
  );
}`);
        assert.deepStrictEqual(violations, []);
      })
  );

  it.effect("reads only TSX modules", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(
        `export const template = "<input type=\\"date\\" />";`,
        "apps/www/src/lib/example.ts"
      );
      assert.deepStrictEqual(violations, []);
    })
  );
});
