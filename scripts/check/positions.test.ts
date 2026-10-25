import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { classReferences } from "#scripts/check/positions";
import { parseSources } from "#scripts/check/source";

const VIEW = "apps/www/src/components/example.tsx";

/** Joins the lines of one module. */
function lines(...rows: readonly string[]) {
  return Arr.join(rows, "\n");
}

/** Spells a template literal with one span, because a plain string cannot hold a placeholder. */
function template(head: string, span: string, tail: string) {
  return Arr.join(["`", head, "$", "{", span, "}", tail, "`"], "");
}

/** Returns the names that one module reads in its class positions, in the order it reads them. */
function names(sourceText: string) {
  return Effect.scoped(
    Effect.map(parseSources([{ file: VIEW, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, ({ sourceFile }) =>
        Arr.map(classReferences(sourceFile), ({ text }) => text)
      )
    )
  );
}

describe("class positions", () => {
  it.effect.each(
    Arr.map(
      ["class", "className", "classList", "containerClassName", "classNames"],
      (attribute) => ({ attribute })
    )
  )("reads the $attribute attribute as a class position", ({ attribute }) =>
    Effect.gen(function* () {
      const read = yield* names(`const view = <div ${attribute}={ON} />;`);
      assert.deepStrictEqual(read, ["ON"]);
    })
  );

  it.effect.each(
    Arr.map(["cn", "cva", "cx", "clsx", "twMerge"], (callee) => ({ callee }))
  )("reads the arguments of $callee as class positions", ({ callee }) =>
    Effect.gen(function* () {
      const read = yield* names(`const view = ${callee}("size-4", ON);`);
      assert.deepStrictEqual(read, ["ON"]);
    })
  );

  it.effect.each([
    { name: "a condition branch", value: 'open ? ON : "p-1"', read: ["ON"] },
    {
      name: "the other condition branch",
      value: 'open ? "p-1" : ON',
      read: ["ON"],
    },
    { name: "the right side of &&", value: "open && ON", read: ["ON"] },
    { name: "either side of ||", value: 'ON || "p-1"', read: ["ON"] },
    {
      name: "either side of ??",
      value: "custom ?? ON",
      read: ["custom", "ON"],
    },
    { name: "a concatenation", value: 'ON + " p-1"', read: ["ON"] },
    { name: "the value of an assignment", value: "last = ON", read: ["ON"] },
    {
      name: "the value of a chained assignment",
      value: "last = other = ON",
      read: ["ON"],
    },
    { name: "the right side of &&=", value: "open &&= ON", read: ["ON"] },
    { name: "the right side of a comma", value: "(track(), ON)", read: ["ON"] },
    {
      name: "either side of ||=",
      value: "custom ||= ON",
      read: ["custom", "ON"],
    },
    {
      name: "either side of ??=",
      value: "custom ??= ON",
      read: ["custom", "ON"],
    },
    {
      name: "either side of +=",
      value: "custom += ON",
      read: ["custom", "ON"],
    },
    {
      name: "a template span",
      value: template("", "ON", " p-1"),
      read: ["ON"],
    },
    { name: "an array element", value: '["p-1", [ON]]', read: ["ON"] },
    { name: "a spread element", value: '["p-1", ...[ON]]', read: ["ON"] },
    {
      name: "a computed object key",
      value: "{ [ON]: open }",
      read: ["ON", "open"],
    },
    { name: "an object value", value: "{ rounded: ON }", read: ["ON"] },
    {
      name: "a spread object",
      value: "{ ...{ rounded: ON } }",
      read: ["ON"],
    },
    { name: "a shorthand object member", value: "{ ON }", read: ["ON"] },
    {
      name: "parentheses and an assertion",
      value: "((ON as string))",
      read: ["ON"],
    },
    { name: "a satisfies check", value: "ON satisfies string", read: ["ON"] },
    { name: "a non-null assertion", value: "ON!", read: ["ON"] },
    { name: "a member of an object", value: "ON.card", read: ["ON"] },
    { name: "a looked-up member", value: "ON[size]", read: ["ON"] },
    { name: "a member chain", value: "ON.card.title", read: ["ON"] },
    {
      name: "an argument of a call",
      value: "pick(ON, size)",
      read: ["ON", "size"],
    },
    { name: "the receiver of a method call", value: "ON.trim()", read: ["ON"] },
    { name: "a member of a call result", value: "pick(ON).card", read: ["ON"] },
    {
      name: "an array in an argument of a call",
      value: 'Arr.join([ON, "p-1"], " ")',
      read: ["Arr", "ON"],
    },
    {
      name: "a call in an argument of a call",
      value: 'Option.getOrElse(Record.get(ON, size), () => "")',
      read: ["Option", "Record", "ON", "size"],
    },
  ])("reads $name inside a class function argument", ({ read, value }) =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* names(`const view = cn(${value});`), read);
    })
  );

  it.effect(
    "reads the base, variants, compound variants, and defaults of cva",
    () =>
      Effect.gen(function* () {
        const read = yield* names(
          lines(
            "const button = cva(BASE, {",
            "  compoundVariants: [{ size: SIZE, tone: [SIZE], class: BOTH }],",
            "  defaultVariants: { size: SIZE },",
            "  variants: { size: { sm: SOFT } },",
            "});"
          )
        );
        assert.deepStrictEqual(read, [
          "BASE",
          "SIZE",
          "SIZE",
          "BOTH",
          "SIZE",
          "SOFT",
        ]);
      })
  );

  it.effect("reads the values of a classNames object", () =>
    Effect.gen(function* () {
      const read = yield* names(
        "const view = <Calendar classNames={{ root: ROOT, day }} />;"
      );
      assert.deepStrictEqual(read, ["ROOT", "day"]);
    })
  );

  it.effect("reads a class function call inside a class position once", () =>
    Effect.gen(function* () {
      const read = yield* names(
        "const view = <div className={cn(ON, pick(cn(OTHER)))} />;"
      );
      assert.deepStrictEqual(read, ["ON", "OTHER"]);
    })
  );

  it.effect("treats the object that a call takes as its options", () =>
    Effect.gen(function* () {
      const read = yield* names(
        lines(
          "const view = (",
          "  <a",
          "    className={cn(",
          "      buttonVariants({ variant: VARIANT, size: VARIANT }),",
          "      pick(size, { tone: VARIANT })",
          "    )}",
          "  />",
          ");"
        )
      );
      assert.deepStrictEqual(read, ["size"]);
    })
  );

  it.effect("reads no name from text, operands, or functions", () =>
    Effect.gen(function* () {
      const read = yield* names(
        lines(
          "const view = cn(",
          "  count > 1,",
          "  ON === other,",
          "  () => ON,",
          "  1,",
          "  { run() { return ON; } },",
          "  new Set(ON),",
          '  "flex",',
          "  `flex`",
          ");"
        )
      );
      assert.deepStrictEqual(read, []);
    })
  );

  it.effect("reads only the attributes the language server reads", () =>
    Effect.gen(function* () {
      const read = yield* names(
        lines(
          "const view = (",
          "  <div htmlFor={ID} aria-label={LABEL} data-state={STATE.open}>",
          "    <input className />",
          '    <input className="flex" />',
          "    <use xlink:href={ID} />",
          "    <span className={/* none */} />",
          "  </div>",
          ");"
        )
      );
      assert.deepStrictEqual(read, []);
    })
  );
});
