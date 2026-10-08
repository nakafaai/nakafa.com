import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { effectFindings } from "#scripts/check/effect";
import { parseSources } from "#scripts/check/source";

/** Lists the lines of one module's hand-written data shapes. */
const shapes = Effect.fn("ShapePolicyTest.shapes")(function* (
  sourceText: string,
  file = "apps/www/lib/example.ts"
) {
  const found = yield* effectFindings(
    yield* parseSources([{ file, sourceText }])
  );
  return Arr.map(
    Arr.filter(found, ({ rule }) => rule === "data-type"),
    ({ line }) => line
  );
}, Effect.scoped);

describe("hand-written data shapes", () => {
  it.effect("reports interfaces and type aliases that spell out data", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* shapes(`export interface Lesson {
  readonly title: string;
}
interface Empty {}
type Point = { x: number };
type Result = { ok: true } | { ok: false; reason: string };
type Frozen = Readonly<{ id: string }>;
type Rows = readonly ({ id: string })[];
type Optional = [number, { id: string }?];
type Rest = [number, ...{ id: string }[]];
type Named = [first: { id: string }];
type Merged = Base & { extra: string };
namespace Legacy {
  export interface Entry {
    id: string;
  }
}
`),
        [1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14]
      );
    })
  );

  it.effect("allows derived types, functions, values, and augmentations", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* shapes(`import { Schema } from "effect";
export const Lesson = Schema.Struct({ title: Schema.String });
export interface LessonType extends Schema.Schema.Type<typeof Lesson> {}
type Title = (typeof Lesson.Type)["title"];
type Kind = "article" | "lesson";
type Render = (input: { title: string }) => string;
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type Rows = Array<typeof Lesson.Type>;
type Pairs = [string, number];
declare global {
  interface Window {
    analytics: unknown;
  }
}
declare module "effect" {
  interface Registry {
    lesson: string;
  }
}
`),
        []
      );
    })
  );

  it.effect(
    "allows component props in TSX modules and framework configuration",
    () =>
      Effect.gen(function* () {
        const source = `export interface CardProps {
  title: string;
}
type BadgeProps = { label: string };
interface CardValue {
  title: string;
}
`;
        assert.deepStrictEqual(
          yield* shapes(source, "apps/www/components/card.tsx"),
          [5]
        );
        assert.deepStrictEqual(yield* shapes(source), [1, 4, 5]);
        assert.deepStrictEqual(
          yield* shapes(source, "apps/www/next.config.ts"),
          []
        );
      })
  );

  it.effect("allows the type a recursive Schema.suspend thunk names", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* shapes(`import { Schema } from "effect";
export interface Category {
  readonly children: ReadonlyArray<Category>;
}
export interface Node {
  readonly next?: Node;
}
export const category = Schema.suspend((): Schema.Codec<Category> => CategorySchema);
export const node = Schema.suspend((): Schema.Schema<Node> => NodeSchema);
export type Tree = { readonly children: ReadonlyArray<Tree> };
export const tree = Schema.suspend((): Schema.Codec<Tree> => TreeSchema);
`),
        []
      );
    })
  );

  it.effect(
    "keeps other interfaces and annotations of a recursive type reported",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* shapes(`interface Other {
  readonly id: string;
}
export interface Category {
  readonly children: ReadonlyArray<Category>;
}
export const category = Schema.suspend((): Schema.Codec<Category> => CategorySchema);
interface Lesson {
  readonly title: string;
}
export const lesson: Schema.Codec<Lesson> = LessonSchema;
type Plain = { readonly id: string };
export const plain: Schema.Codec<Plain> = PlainSchema;
`),
          [1, 8, 12]
        );
      })
  );

  it.effect("allows a selector that picks union members", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* shapes(`type Program = Extract<Row, { readonly family: "program" }>;
type Drafts = Exclude<Status, { readonly state: "draft" | "archived"; readonly count: 1 }>;
type Flags = Extract<Row, { readonly done: true; readonly failed: false }>;
type Level = Extract<Row, { readonly n: -1 }>;
type Choice = Extract<Row, { readonly k: ("a" | "b") }>;
`),
        []
      );
    })
  );

  it.effect("keeps generics with declared object arguments reported", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* shapes(`type Shape = Extract<Row, { readonly id: string }>;
type Picked = Pick<Row, { readonly family: "program" }>;
type Wrapped = Extract<{ readonly family: "program" }, Row>;
type Extended = Extract<Row, { readonly family: "program" }> & { extra: string };
type Mixed = Exclude<Row, { readonly family: "program"; readonly id: string }>;
type Ranged = Extract<Row, { readonly n: (-1 | number) }>;
`),
        [1, 2, 3, 4, 5, 6]
      );
    })
  );

  it.effect(
    "keeps a recursive type reported when the thunk names another schema",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* shapes(`interface Node {
  readonly next?: Node;
}
export const node = Schema.suspend((): Effects.Codec<Node> => NodeSchema);
export const bare = Schema.suspend((): Schema.Codec => BareSchema);
export const other = Schema.suspend(makeThunk);
`),
          [1]
        );
      })
  );

  it.effect("allows a shape whose own member holds a function", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* shapes(`export interface Toggle {
  readonly onChange: (value: boolean) => void;
}
export type Handlers = { readonly onOpen: () => void };
export type Wrapped = Readonly<{ onOpen: (() => void) | null }>;
`),
        []
      );
    })
  );

  it.effect(
    "keeps a shape reported when its members are only call or construct signatures",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* shapes(`export interface Callable {
  (value: boolean): void;
}
export interface Constructible {
  new (value: boolean): Toggle;
}
`),
          [1, 4]
        );
      })
  );

  it.effect("allows a shape whose own member holds a React value", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* shapes(`import type { ReactNode } from "react";
export interface Card {
  readonly body: ReactNode;
}
`),
        []
      );
    })
  );

  it.effect(
    "keeps a shape reported when a member names no React import or is a local alias",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* shapes(`import type { ReactNode } from "./nodes";
type Render = () => void;
export interface Imported {
  readonly body: ReactNode;
}
export interface Aliased {
  readonly render: Render;
}
export interface Data {
  readonly title: string;
}
`),
          [3, 6, 9]
        );
      })
  );

  it.effect("allows a generic shape that uses its type parameter", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* shapes(`export interface Box<T> {
  readonly value: T;
}
export type Pair<T> = { readonly left: T; readonly right: T[] };
export interface Tree<T> {
  readonly children: ReadonlyArray<Tree<T>>;
}
export type Lookup<K> = Readonly<{ key: K }>;
export interface Visitor<T> {
  visit(value: T): void;
}
`),
        []
      );
    })
  );

  it.effect(
    "keeps a generic shape reported when no member uses its parameter",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* shapes(`export interface Unused<T> {
  readonly id: string;
}
export type Plain<T> = { readonly id: string };
export interface Other<T> {
  readonly value: Inner<U>;
}
`),
          [1, 4, 5]
        );
      })
  );

  it.effect(
    "keeps a generic shape reported when a member rebinds its parameter",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* shapes(`export interface Shadow<T> {
  readonly map: { readonly [T in "a" | "b"]: T };
}
export interface Renders<T> {
  readonly box: { readonly render: <T>(value: T) => T };
}
export interface Visitor<T> {
  readonly api: { visit<T>(value: T): void };
}
export interface Unwrapped<T> {
  readonly value: Promise<number> extends Promise<infer T> ? T : never;
}
export interface Used<T> {
  readonly map: { readonly [K in "a"]: T };
  readonly value: Promise<number> extends Promise<infer U> ? U | T : never;
}
`),
          [1, 4, 7, 10]
        );
      })
  );

  it.effect("leaves a shape that a browser page function declares alone", () =>
    Effect.gen(function* () {
      const found = yield* effectFindings(
        yield* parseSources([
          {
            file: "apps/www/e2e/named.browser.ts",
            sourceText: `import { test } from "@playwright/test";
import { countShared } from "@/e2e/support/frames";
export interface Outside {
  readonly id: string;
}
page.evaluate(() => {
  interface Inside {
    readonly id: string;
  }
  return 1;
});
page.evaluate(countShared);
function countFrames() {
  interface Frame {
    readonly id: string;
  }
  return 1;
}
page.evaluate(countFrames);
`,
          },
          {
            file: "apps/www/e2e/support/frames.ts",
            sourceText: `export function countShared() {
  interface Row {
    readonly id: string;
  }
  return 1;
}
export interface Helper {
  readonly id: string;
}
`,
          },
        ])
      );
      assert.deepStrictEqual(
        Arr.map(
          Arr.filter(found, ({ rule }) => rule === "data-type"),
          ({ file, line }) => `${file}:${line}`
        ),
        ["apps/www/e2e/named.browser.ts:3", "apps/www/e2e/support/frames.ts:7"]
      );
    })
  );
});
