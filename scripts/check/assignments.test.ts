import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { assignmentsTo } from "#scripts/check/assignments";
import { parseSources } from "#scripts/check/source";

const VIEW = "apps/www/src/components/example.tsx";
const NAME = "ON";

/** Joins the lines of one module. */
function lines(...rows: readonly string[]) {
  return Arr.join(rows, "\n");
}

/** Returns the text of every value that a module assigns to a name `ON`, in the order they are found. */
const values = Effect.fn("AssignmentsTest.values")(function* (
  sourceText: string
) {
  const { modules } = yield* parseSources([{ file: VIEW, sourceText }]);
  return Arr.flatMap(modules, ({ sourceFile }) =>
    Arr.map(assignmentsTo(sourceFile, NAME), ({ value }) =>
      value.getText(sourceFile)
    )
  );
}, Effect.scoped);

describe("assignments to a name", () => {
  it.effect.each(
    Arr.map(["=", "+=", "||=", "??=", "&&="], (operator) => ({ operator }))
  )("counts an assignment with $operator", ({ operator }) =>
    Effect.gen(function* () {
      const written = yield* values(Arr.join(["ON", operator, '"flex";'], " "));
      assert.deepStrictEqual(written, ['"flex"']);
    })
  );

  it.effect.each([
    { form: "parentheses", sourceText: '(ON) = "a";', written: ['"a"'] },
    {
      form: "a non-null assertion",
      sourceText: 'ON! = "a";',
      written: ['"a"'],
    },
    {
      form: "a type assertion",
      sourceText: '(ON as string) = "a";',
      written: ['"a"'],
    },
    {
      form: "a satisfies check",
      sourceText: '(ON satisfies string) = "a";',
      written: ['"a"'],
    },
    {
      form: "a chain of assignments",
      sourceText: 'other = ON = "a";',
      written: ['"a"'],
    },
  ])("counts a name written through $form", ({ sourceText, written }) =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* values(sourceText), written);
    })
  );

  it.effect.each([
    { form: "a member", sourceText: 'ON.card = "a";', written: ['"a"'] },
    { form: "an element", sourceText: 'ON["card"] = "a";', written: ['"a"'] },
    {
      form: "a member of a member",
      sourceText: 'ON.card.name += "a";',
      written: ['"a"'],
    },
    {
      form: "a member of an asserted name",
      sourceText: 'ON!.card = "a";',
      written: ['"a"'],
    },
    {
      form: "a member in a pattern",
      sourceText: "[ON.card] = list;",
      written: ["list"],
    },
  ])(
    "counts a member as a write to the name it starts from: $form",
    ({ sourceText, written }) =>
      Effect.gen(function* () {
        assert.deepStrictEqual(yield* values(sourceText), written);
      })
  );

  it.effect.each([
    { form: "an array pattern", sourceText: "[ON] = list;" },
    {
      form: "an array pattern after a name",
      sourceText: "[first, ON] = list;",
    },
    { form: "an array pattern after a hole", sourceText: "[, ON] = list;" },
    { form: "a rest element", sourceText: "[...ON] = list;" },
    { form: "a nested array pattern", sourceText: "[[ON]] = list;" },
    { form: "an object pattern", sourceText: "({ ON } = list);" },
    { form: "a renamed name", sourceText: "({ card: ON } = list);" },
    {
      form: "a nested object pattern",
      sourceText: "({ card: { ON } } = list);",
    },
    { form: "a rest property", sourceText: "({ ...ON } = list);" },
    {
      form: "an array in an object pattern",
      sourceText: "({ card: [ON] } = list);",
    },
  ])(
    "gives a name in a destructuring pattern the whole value: $form",
    ({ sourceText }) =>
      Effect.gen(function* () {
        assert.deepStrictEqual(yield* values(sourceText), ["list"]);
      })
  );

  it.effect.each([
    {
      form: "an array pattern",
      sourceText: '[ON = "flex"] = list;',
      written: ["list", '"flex"'],
    },
    {
      form: "a renamed name",
      sourceText: '({ card: ON = "flex" } = list);',
      written: ["list", '"flex"'],
    },
    {
      form: "a shorthand member",
      sourceText: '({ ON = "flex" } = list);',
      written: ["list", '"flex"'],
    },
    {
      form: "an array that no pattern holds",
      sourceText: 'use([ON = "flex"]);',
      written: ['"flex"'],
    },
  ])("counts the default of $form", ({ sourceText, written }) =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* values(sourceText), written);
    })
  );

  it.effect.each([
    {
      form: "an operator that cannot give a class",
      sourceText: lines("ON -= 1;", "ON *= 2;", "ON |= 4;"),
    },
    {
      form: "a comparison, a sum, and an increment",
      sourceText: "use(ON === 2, ON + 1, ON++);",
    },
    { form: "a write to another name", sourceText: 'other = "flex";' },
    { form: "a name that is only read", sourceText: "other = ON;" },
    {
      form: "a member of another name that reads it",
      sourceText: lines("other.card = ON;", "other[ON] = 1;"),
    },
    {
      form: "a member that is named like it",
      sourceText: 'other.ON = "flex";',
    },
    {
      form: "a key that is only read",
      sourceText: "({ [ON]: other } = list);",
    },
    {
      form: "a member of a sum that reads it",
      sourceText: '(ON + other).card = "flex";',
    },
    {
      form: "a member of something that is no name",
      sourceText: lines('this.ON = "flex";', 'read().ON = "flex";'),
    },
    {
      form: "the head of a loop",
      sourceText: lines(
        "for (ON of items) {}",
        "for (ON in items) {}",
        "for ([ON] of items) {}"
      ),
    },
  ])("does not count $form", ({ sourceText }) =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* values(sourceText), []);
    })
  );
});
