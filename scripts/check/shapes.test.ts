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

  it.effect("reports a declare namespace that holds local data", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* shapes(`declare namespace Feed {
  interface Row {
    readonly id: string;
  }
}
export type FeedRow = Feed.Row;
`),
        [2]
      );
    })
  );

  it.effect("reports a plain shape that a Schema.suspend thunk names", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* shapes(`import { Schema } from "effect";
export interface UserRow {
  readonly id: string;
  readonly title: string;
}
export const userRows = Schema.suspend((): Schema.Codec<UserRow> => UserRowsSchema);
`),
        [2]
      );
    })
  );

  it.effect("reports a shape whose only AI SDK member is plain JSON data", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* shapes(`import type { JSONValue, TextUIPart } from "ai";
export interface Payload {
  readonly title: string;
  readonly meta: JSONValue;
}
export interface Entry {
  readonly part: TextUIPart;
}
`),
        [2]
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

  it.effect("allows each shape of a mutually recursive pair", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* shapes(`import { Schema } from "effect";
export interface Folder {
  readonly name: string;
  readonly files: ReadonlyArray<Entry>;
}
export interface Entry {
  readonly name: string;
  readonly folder?: Folder;
}
export const folder = Schema.suspend((): Schema.Codec<Folder> => FolderSchema);
export const entry = Schema.suspend((): Schema.Codec<Entry> => EntrySchema);
`),
        []
      );
    })
  );

  it.effect("allows each shape of a cycle that runs through three names", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* shapes(`import { Schema } from "effect";
export interface First {
  readonly second: Second;
}
export interface Second {
  readonly third: Third;
}
export interface Third {
  readonly first?: First;
}
export const first = Schema.suspend((): Schema.Codec<First> => FirstSchema);
export const second = Schema.suspend((): Schema.Codec<Second> => SecondSchema);
export const third = Schema.suspend((): Schema.Codec<Third> => ThirdSchema);
`),
        []
      );
    })
  );

  it.effect("reports a chain of thunk-named shapes that does not close", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* shapes(`import { Schema } from "effect";
export interface First {
  readonly second: Second;
}
export interface Second {
  readonly third: Third;
}
export interface Third {
  readonly id: string;
}
export const first = Schema.suspend((): Schema.Codec<First> => FirstSchema);
export const second = Schema.suspend((): Schema.Codec<Second> => SecondSchema);
export const third = Schema.suspend((): Schema.Codec<Third> => ThirdSchema);
`),
        [2, 5, 8]
      );
    })
  );

  it.effect("reports a shape that only leads into a recursive shape", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* shapes(`import { Schema } from "effect";
export interface Entry {
  readonly node: Node;
}
export interface Node {
  readonly next?: Node;
}
export const entry = Schema.suspend((): Schema.Codec<Entry> => EntrySchema);
export const node = Schema.suspend((): Schema.Codec<Node> => NodeSchema);
`),
        [2]
      );
    })
  );

  it.effect(
    "allows a recursive shape that a function declares for its thunk",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* shapes(`import { Schema } from "effect";
export function build() {
  interface Value {
    readonly next?: Value;
  }
  return Schema.suspend((): Schema.Codec<Value> => ValueSchema);
}
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
    "allows a shape whose own member holds a parser syntax-tree node, and still reports plain data",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* shapes(`import type { JSXElement } from "estree-jsx";
export interface Snippet {
  readonly element: JSXElement;
}
export interface Lesson {
  readonly title: string;
}
`),
          [5]
        );
      })
  );

  it.effect(
    "keeps a shape reported when a member names no React import or a local data alias",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* shapes(`import type { ReactNode } from "./nodes";
type Title = string;
export interface Imported {
  readonly body: ReactNode;
}
export interface Aliased {
  readonly title: Title;
}
`),
          [3, 6]
        );
      })
  );

  it.effect(
    "allows a shape that holds an Effect runtime handle, an AI SDK message part, or a same-module shape of functions",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* shapes(`import type { TextUIPart } from "ai";
import type { Fiber } from "effect";
interface Actions {
  readonly close: () => void;
}
export interface Save {
  readonly fiber: Fiber.Fiber<void, never>;
  readonly owner: symbol;
}
export interface Entry {
  readonly key: string;
  readonly part: TextUIPart;
}
export interface ContextValue {
  readonly actions: Actions;
}
`),
          []
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
  <T>(value: T): T;
}
export interface Visitor<T> {
  new <T>(value: T): Renders<T>;
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
