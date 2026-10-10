import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { classFindings } from "#scripts/check/classes";
import { parseSources, type RepositorySource } from "#scripts/check/source";

const VIEW = "apps/www/components/example.tsx";
const RULE =
  "write them inside cva(...) (one compoundVariants entry when several variants share them), inside cn(...), or in the className itself, or give the element a small component that owns them";

/** Joins the lines of one module. */
function lines(...rows: readonly string[]) {
  return Arr.join(rows, "\n");
}

/** Spells a template literal with one span, because a plain string cannot hold a placeholder. */
function template(head: string, span: string, tail: string) {
  return Arr.join(["`", head, "$", "{", span, "}", tail, "`"], "");
}

/** Inspects modules with the class policy alone. */
function inspectAll(modules: readonly (typeof RepositorySource.Type)[]) {
  return Effect.scoped(Effect.flatMap(parseSources(modules), classFindings));
}

/** Inspects one module with the class policy alone. */
function inspect(sourceText: string, file = VIEW) {
  return inspectAll([{ file, sourceText }]);
}

/** The message for one constant that keeps class strings, at a line of a module. */
function violation(name: string, line: number, file = VIEW) {
  return `${file}:${line}: ${name} keeps class strings in a constant, where the Tailwind language server cannot read them: ${RULE}.`;
}

describe("class constant policy", () => {
  it.effect(
    "reports a constant shared by variants once, at its declaration",
    () =>
      Effect.gen(function* () {
        const violations = yield* inspect(
          lines(
            "const STREAMED =",
            '  "[&_li]:text-wrap [&_p]:text-wrap";',
            "",
            'const frameVariants = cva("size-full", {',
            "  variants: {",
            "    variant: {",
            '      chat: cn(STREAMED, "text-chat"),',
            '      note: cn(STREAMED, "text-sm"),',
            "    },",
            "  },",
            "});"
          )
        );
        assert.deepStrictEqual(violations, [violation("STREAMED", 1)]);
      })
  );

  it.effect.each(
    Arr.map(
      ["class", "className", "classList", "containerClassName", "classNames"],
      (attribute) => ({ attribute })
    )
  )("reads the $attribute attribute as a class position", ({ attribute }) =>
    Effect.gen(function* () {
      const violations = yield* inspect(
        lines('const ON = "flex";', `const view = <div ${attribute}={ON} />;`)
      );
      assert.deepStrictEqual(violations, [violation("ON", 1)]);
    })
  );

  it.effect.each(
    Arr.map(["cn", "cva", "cx", "clsx", "twMerge"], (callee) => ({ callee }))
  )("reads the arguments of $callee as class positions", ({ callee }) =>
    Effect.gen(function* () {
      const violations = yield* inspect(
        lines('const ON = "flex";', `const view = ${callee}("size-4", ON);`)
      );
      assert.deepStrictEqual(violations, [violation("ON", 1)]);
    })
  );

  it.effect.each([
    { name: "a condition branch", value: 'open ? ON : "p-1"' },
    { name: "the other condition branch", value: 'open ? "p-1" : ON' },
    { name: "the right side of &&", value: "open && ON" },
    { name: "either side of ||", value: 'ON || "p-1"' },
    { name: "either side of ??", value: "custom ?? ON" },
    { name: "a concatenation", value: 'ON + " p-1"' },
    { name: "a template span", value: template("", "ON", " p-1") },
    { name: "an array element", value: '["p-1", [ON]]' },
    { name: "a spread element", value: '["p-1", ...[ON]]' },
    { name: "a computed object key", value: "{ [ON]: open }" },
    { name: "an object value", value: "{ rounded: ON }" },
    { name: "a spread object", value: "{ ...{ rounded: ON } }" },
    { name: "parentheses and an assertion", value: "((ON as string))" },
    { name: "a satisfies check", value: "ON satisfies string" },
    { name: "a non-null assertion", value: "ON!" },
    { name: "a member of an object", value: "ON.card" },
    { name: "a looked-up member", value: "ON[size]" },
    { name: "a member chain", value: "ON.card.title" },
  ])("reads $name of a class function argument", ({ value }) =>
    Effect.gen(function* () {
      const violations = yield* inspect(
        lines(
          'const ON = { card: { title: "flex" } };',
          `const view = cn(${value});`
        )
      );
      assert.deepStrictEqual(violations, [violation("ON", 1)]);
    })
  );

  it.effect(
    "reads the base, variants, compound variants, and defaults of cva",
    () =>
      Effect.gen(function* () {
        const violations = yield* inspect(
          lines(
            'const BASE = "flex";',
            'const SOFT = "p-1";',
            'const BOTH = "m-1";',
            'const SIZE = "md";',
            "const button = cva(BASE, {",
            "  compoundVariants: [{ size: SIZE, tone: [SIZE], class: BOTH }],",
            "  defaultVariants: { size: SIZE },",
            "  variants: { size: { sm: SOFT } },",
            "});"
          )
        );
        assert.deepStrictEqual(violations, [
          violation("BASE", 1),
          violation("SOFT", 2),
          violation("BOTH", 3),
          violation("SIZE", 4),
        ]);
      })
  );

  it.effect("reads the values of a classNames object", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(
        lines(
          'const ROOT = "flex";',
          "const view = <Calendar classNames={{ root: ROOT }} />;"
        )
      );
      assert.deepStrictEqual(violations, [violation("ROOT", 1)]);
    })
  );

  it.effect.each([
    { form: "a string", declaration: 'const ON = "flex";' },
    { form: "a template", declaration: "const ON = `flex`;" },
    {
      form: "a template with a span",
      declaration: `const ON = ${template("flex ", "gap", "")};`,
    },
    { form: "a concatenation", declaration: 'const ON = "flex" + gap;' },
    {
      form: "a condition of strings",
      declaration: 'const ON = open ? "flex" : "grid";',
    },
    { form: "an object of strings", declaration: 'const ON = { sm: "flex" };' },
    { form: "an array of strings", declaration: 'const ON = ["flex", 1];' },
    {
      form: "a nested object",
      declaration: 'const ON = { sm: { lg: "flex" } };',
    },
    {
      form: "a const assertion",
      declaration: 'const ON = { sm: "flex" } as const;',
    },
    {
      form: "a satisfies check",
      declaration: 'const ON = { sm: "flex" } satisfies Styles;',
    },
    {
      form: "a type annotation",
      declaration: 'const ON: Record<string, string> = { sm: "flex" };',
    },
    { form: "a let", declaration: 'let ON = "flex";' },
    { form: "a var", declaration: 'var ON = "flex";' },
    { form: "an exported constant", declaration: 'export const ON = "flex";' },
  ])("reports a constant that holds $form", ({ declaration }) =>
    Effect.gen(function* () {
      const violations = yield* inspect(
        lines(declaration, "const view = <div className={cn(ON.sm, ON)} />;")
      );
      assert.deepStrictEqual(violations, [violation("ON", 1)]);
    })
  );

  it.effect("reports a constant declared inside a component", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(
        lines(
          "function Item() {",
          '  const className = "text-sm";',
          "  return <a className={className} />;",
          "}"
        )
      );
      assert.deepStrictEqual(violations, [violation("className", 2)]);
    })
  );

  it.effect("follows a chain of constants and reports each one once", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(
        lines(
          'const SMALL = "p-1";',
          `const LARGE = ${template("", "SMALL", " m-1")};`,
          "const SIZES = { sm: SMALL, lg: LARGE };",
          "const ALIAS = SIZES;",
          "const first = <div className={ALIAS.sm} />;",
          "const second = <div className={cn(LARGE, SIZES.lg)} />;"
        )
      );
      assert.deepStrictEqual(violations, [
        violation("SMALL", 1),
        violation("LARGE", 2),
      ]);
    })
  );

  it.effect("stops at constants that read each other", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(
        lines(
          `const FIRST = ${template("", "SECOND", " p-1")};`,
          `const SECOND = ${template("", "FIRST", " m-1")};`,
          "const view = <div className={FIRST} />;"
        )
      );
      assert.deepStrictEqual(violations, [
        violation("FIRST", 1),
        violation("SECOND", 2),
      ]);
    })
  );

  it.effect("orders the reports by module and line", () =>
    Effect.gen(function* () {
      const sourceText = lines(
        'const LATER = "p-1";',
        'const EARLIER = "m-1";',
        "const view = <div className={cn(EARLIER, LATER)} />;"
      );
      const violations = yield* inspectAll([
        { file: "apps/www/components/b.tsx", sourceText },
        { file: "apps/www/components/a.tsx", sourceText },
      ]);
      assert.deepStrictEqual(violations, [
        violation("LATER", 1, "apps/www/components/a.tsx"),
        violation("EARLIER", 2, "apps/www/components/a.tsx"),
        violation("LATER", 1, "apps/www/components/b.tsx"),
        violation("EARLIER", 2, "apps/www/components/b.tsx"),
      ]);
    })
  );

  it.effect(
    "accepts classes written where the language server reads them",
    () =>
      Effect.gen(function* () {
        const violations = yield* inspect(
          lines(
            'const button = cva("flex", { variants: { size: { sm: "p-1" } } });',
            'const classes = cn("m-1", open && "p-1");',
            "const alias = classes;",
            'function Item({ className, tone = "sm", ...props }) {',
            "  const { gap } = props;",
            "  return (",
            "    <div",
            '      className="flex"',
            '      classNames={{ root: "p-1", item: cn(className, gap) }}',
            "      containerClassName={cn(button({ size: tone }), classes, alias)}",
            "    />",
            "  );",
            "}",
            "const view = <Item className={button()} />;"
          )
        );
        assert.deepStrictEqual(violations, []);
      })
  );

  it.effect("accepts a string that never reaches a class position", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(
        lines(
          'const ID = "title";',
          'const LABEL = "Close";',
          'const STATE = { open: "open" };',
          "const view = (",
          "  <label htmlFor={ID} aria-label={LABEL} data-state={STATE.open} />",
          ");",
          "const bare = <input className />;",
          "const namespaced = <use xlink:href={ID} />;",
          "const empty = <div className={/* none */}>{ID}</div>;"
        )
      );
      assert.deepStrictEqual(violations, []);
    })
  );

  it.effect("accepts names that are not variables with a value", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(
        lines(
          'import { OTHER } from "./other";',
          'import styles from "./styles.module.css";',
          "const { PICKED } = source;",
          "const [FIRST] = list;",
          "declare const AMBIENT: string;",
          "let late;",
          "function RUNTIME() {}",
          "class Styles {}",
          "for (const ITEM of items) {",
          "  use(<a className={ITEM} />);",
          "}",
          "const view = (",
          "  <div",
          "    className={cn(",
          "      OTHER,",
          "      styles.card,",
          "      PICKED,",
          "      FIRST,",
          "      AMBIENT,",
          "      late,",
          "      RUNTIME,",
          "      Styles,",
          "      undefined,",
          "      missing,",
          "      read().card,",
          "      list[0]?.name",
          "    )}",
          "  />",
          ");"
        )
      );
      assert.deepStrictEqual(violations, []);
    })
  );

  it.effect("ignores operands, values, and calls that hold no class", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(
        lines(
          'const ON = "flex";',
          "const view = (",
          "  <div",
          "    className={cn(",
          "      count > 1,",
          "      ON === other,",
          "      getClass(ON),",
          "      ON.trim(),",
          "      () => ON,",
          "      1,",
          "      { run() { return ON; } },",
          "      new Set(ON),",
          "    )}",
          "  />",
          ");"
        )
      );
      assert.deepStrictEqual(violations, []);
    })
  );

  it.effect("resolves a name to the declaration that its scope sees", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(
        lines(
          'const ON = "flex";',
          "function Inner(ON: string) {",
          "  return <div className={ON} />;",
          "}",
          "function Block() {",
          '  const ON = cva("p-1");',
          "  return <div className={cn(ON)} />;",
          "}"
        )
      );
      assert.deepStrictEqual(violations, []);
    })
  );

  it.effect("keeps the names of one module out of another", () =>
    Effect.gen(function* () {
      const violations = yield* inspectAll([
        { file: "apps/www/components/a.tsx", sourceText: 'const ON = "flex";' },
        {
          file: "apps/www/components/b.tsx",
          sourceText: "const view = <div className={ON} />;",
        },
      ]);
      assert.deepStrictEqual(violations, []);
    })
  );

  it.effect.each([
    { kind: "a test", file: "apps/www/components/example.test.tsx" },
    { kind: "a test support module", file: "apps/www/test.setup.ts" },
    { kind: "a configuration file", file: "apps/www/tailwind.config.ts" },
  ])("skips $kind", ({ file }) =>
    Effect.gen(function* () {
      const violations = yield* inspect(
        lines('const ON = "flex";', "const view = cn(ON);"),
        file
      );
      assert.deepStrictEqual(violations, []);
    })
  );

  it.effect("skips a module that a tool generated", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(
        lines(
          "// @generated by a tool",
          'const ON = "flex";',
          "const view = cn(ON);"
        )
      );
      assert.deepStrictEqual(violations, []);
    })
  );
});
