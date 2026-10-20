import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { classFindings } from "#scripts/check/classes";
import { parseSources, type RepositorySource } from "#scripts/check/source";

const VIEW = "apps/www/src/components/example.tsx";
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

  it.effect.each([
    {
      place: "a classNames attribute",
      sourceText: lines(
        'const root = "w-fit";',
        "const view = <Calendar classNames={{ root }} />;"
      ),
      name: "root",
    },
    {
      place: "the variants of cva",
      sourceText: lines(
        'const sm = "h-4";',
        'const size = cva("", { variants: { size: { sm } } });'
      ),
      name: "sm",
    },
    {
      place: "a class attribute through a call",
      sourceText: lines(
        'const ON = ["flex", "gap-2"];',
        'const view = <div className={Arr.join(ON, " ")} />;'
      ),
      name: "ON",
    },
    {
      place: "a class attribute through a method call",
      sourceText: lines(
        'const ON = { sm: "flex" };',
        "const view = <div className={ON.sm.trim()} />;"
      ),
      name: "ON",
    },
  ])("reports the constant that fills $place", ({ name, sourceText }) =>
    Effect.gen(function* () {
      const violations = yield* inspect(sourceText);
      assert.deepStrictEqual(violations, [violation(name, 1)]);
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

  it.effect.each([
    {
      key: "a quoted key",
      declaration: 'const ON = { "bg-primary": open };',
    },
    {
      key: "a computed key",
      declaration: 'const ON = { ["bg-primary"]: open };',
    },
  ])("reports a class map with $key", ({ declaration }) =>
    Effect.gen(function* () {
      const violations = yield* inspect(
        lines(declaration, "const view = cn(ON);")
      );
      assert.deepStrictEqual(violations, [violation("ON", 1)]);
    })
  );

  it.effect("accepts a map with keys that are not strings", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(
        lines("const ON = { flex: open, 1: close };", "const view = cn(ON);")
      );
      assert.deepStrictEqual(violations, []);
    })
  );

  it.effect("follows a shorthand member to the variable it names", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(
        lines(
          'const sm = "h-4";',
          "const STYLES = { sm };",
          "const view = <div className={STYLES.sm} />;"
        )
      );
      assert.deepStrictEqual(violations, [violation("sm", 1)]);
    })
  );

  it.effect(
    "follows the names that a call reads, never the text it holds",
    () =>
      Effect.gen(function* () {
        const violations = yield* inspect(
          lines(
            'const SIZES = { sm: "h-4" };',
            'const picked = pick(SIZES, "sm");',
            'const outlined = buttonVariants({ variant: "outline" });',
            'const joined = Arr.join(["flex", "gap-2"], " ");',
            "const view = <div className={cn(picked, outlined, joined)} />;"
          )
        );
        assert.deepStrictEqual(violations, [violation("SIZES", 1)]);
      })
  );

  it.effect("accepts a variant that a call takes in its options", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(
        lines(
          'const VARIANT = "outline";',
          "const view = <a className={buttonVariants({ variant: VARIANT })} />;"
        )
      );
      assert.deepStrictEqual(violations, []);
    })
  );

  it.effect("reports each destructured name that is given class text", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(
        lines(
          'const { sm, lg } = { sm: "h-4", lg: "h-8" };',
          'const { item = "flex", gap } = options;',
          'const SIZES = { card: "p-1" };',
          "const { card } = SIZES;",
          "const view = <div className={cn(sm, lg, item, gap, card)} />;"
        )
      );
      assert.deepStrictEqual(violations, [
        violation("sm", 1),
        violation("lg", 1),
        violation("item", 2),
        violation("SIZES", 3),
      ]);
    })
  );

  it.effect.each([
    { declaration: "let ON: string;", assignment: 'ON = "flex";' },
    { declaration: 'let ON = cn("a");', assignment: 'ON = "bg-primary";' },
    { declaration: 'let ON = cn("h-4");', assignment: 'ON += " p-2";' },
    { declaration: 'let ON = cn("a");', assignment: 'ON ||= "flex";' },
    { declaration: 'let ON = cn("a");', assignment: 'ON ??= "flex";' },
    { declaration: 'let ON = cn("a");', assignment: 'ON &&= "flex";' },
    { declaration: "let ON: string;", assignment: '[ON] = ["a"];' },
    { declaration: "let ON: string;", assignment: '({ ON } = { ON: "a" });' },
    { declaration: "let ON: string;", assignment: '({ ON = "a" } = options);' },
    { declaration: "const ON = cn();", assignment: 'ON.card = "flex";' },
    { declaration: "let ON, other;", assignment: 'ON = other = "flex";' },
  ])(
    "reports $declaration assigned class text by $assignment",
    ({ assignment, declaration }) =>
      Effect.gen(function* () {
        const violations = yield* inspect(
          lines(declaration, assignment, "const view = <div className={ON} />;")
        );
        assert.deepStrictEqual(violations, [violation("ON", 1)]);
      })
  );

  it.effect("accepts the names that a function takes as parameters", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(
        lines(
          'function Item({ tone = "sm", ...props }, [first], last) {',
          '  tone = "lg";',
          '  first = "p-1";',
          '  last = "flex";',
          "  const { gap } = props;",
          "  return <a className={cn(tone, gap, first, last)} />;",
          "}"
        )
      );
      assert.deepStrictEqual(violations, []);
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
          'const WIDE = "w-4";',
          'let wide = cn("w-2");',
          "wide = WIDE;",
          "const first = <div className={cn(ALIAS.sm, wide)} />;",
          "const second = <div className={cn(LARGE, SIZES.lg)} />;"
        )
      );
      assert.deepStrictEqual(violations, [
        violation("SMALL", 1),
        violation("LARGE", 2),
        violation("WIDE", 5),
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
        { file: "apps/www/src/components/b.tsx", sourceText },
        { file: "apps/www/src/components/a.tsx", sourceText },
      ]);
      assert.deepStrictEqual(violations, [
        violation("LATER", 1, "apps/www/src/components/a.tsx"),
        violation("EARLIER", 2, "apps/www/src/components/a.tsx"),
        violation("LATER", 1, "apps/www/src/components/b.tsx"),
        violation("EARLIER", 2, "apps/www/src/components/b.tsx"),
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
          "let LEVEL: string;",
          'LEVEL = "title";',
          "const view = (",
          "  <label htmlFor={ID} aria-label={LABEL} data-state={STATE.open}>",
          "    {ID}",
          "    <i data-level={LEVEL} />",
          "  </label>",
          ");"
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
          "for (const [KEY, { VALUE }] of entries) {",
          "  use(<a className={cn(KEY, VALUE)} />);",
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
          "      list[0]?.name,",
          "      { OTHER, missing, late }",
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
          '  ON = "p-2";',
          "  return <div className={cn(ON)} />;",
          "}"
        )
      );
      assert.deepStrictEqual(violations, [violation("ON", 6)]);
    })
  );

  it.effect("keeps the names of one module out of another", () =>
    Effect.gen(function* () {
      const violations = yield* inspectAll([
        { file: "apps/www/src/components/a.tsx", sourceText: 'const ON = "flex";' },
        {
          file: "apps/www/src/components/b.tsx",
          sourceText: "const view = <div className={ON} />;",
        },
      ]);
      assert.deepStrictEqual(violations, []);
    })
  );

  it.effect.each([
    { kind: "a test", file: "apps/www/src/components/example.test.tsx" },
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
