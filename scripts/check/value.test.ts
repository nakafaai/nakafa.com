import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { isInterfaceDeclaration } from "typescript/unstable/ast";
import { effectFindings } from "#scripts/check/effect";
import { parseSources } from "#scripts/check/source";
import { valueMembers } from "#scripts/check/value";

/**
 * Lists, for each member of the interfaces in one module in source order,
 * whether the member holds a value that no Schema describes as data.
 */
const holds = Effect.fn("ValueTest.holds")(function* (sourceText: string) {
  const { modules } = yield* parseSources([
    { file: "apps/www/lib/example.ts", sourceText },
  ]);
  return Arr.flatMap(modules, ({ sourceFile }) => {
    const holdsValue = valueMembers(sourceFile);
    return Arr.flatMap(sourceFile.statements, (statement) =>
      isInterfaceDeclaration(statement)
        ? Arr.map(statement.members, holdsValue)
        : []
    );
  });
}, Effect.scoped);

/** Lists the lines of one module's hand-written data shapes, as the shape rule reports them. */
const reported = Effect.fn("ValueTest.reported")(function* (
  sourceText: string
) {
  const found = yield* effectFindings(
    yield* parseSources([{ file: "apps/www/lib/example.ts", sourceText }])
  );
  return Arr.map(
    Arr.filter(found, ({ rule }) => rule === "data-type"),
    ({ line }) => line
  );
}, Effect.scoped);

describe("value members", () => {
  it.effect(
    "holds a value through a function, a constructor, or a method",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* holds(`export interface Lifecycle {
  readonly onChange: (value: boolean) => void;
  readonly onClose?: () => void;
  readonly build: new () => Builder;
  close(): void;
}
`),
          [true, true, true, true]
        );
      })
  );

  it.effect(
    "holds a value through a React or MDX type, alone or inside a union or an array",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* holds(`import React, { type ComponentType, type ReactNode } from "react";
import type { JSX } from "react";
import type * as Mdx from "mdx/types";
export interface Card {
  readonly body: ReactNode;
  readonly children: ReactNode | null;
  readonly items: ReactNode[];
  readonly rows: readonly ReactNode[];
  readonly element: JSX.Element;
  readonly icons: (JSX.Element | null)[];
  readonly components: Mdx.MDXComponents;
  readonly node: React.ReactNode;
  readonly render: ComponentType<Props>;
}
`),
          [true, true, true, true, true, true, true, true, true]
        );
      })
  );

  it.effect(
    "holds a value through an index signature of functions, not through a call or construct signature",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* holds(`export interface Mixed {
  [key: string]: () => void;
  (value: boolean): void;
  new (value: boolean): Toggle;
}
`),
          [true, false, false]
        );
      })
  );

  it.effect(
    "holds a value through an Effect runtime handle, not through an Effect data type",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* holds(`import { type Effect, type Fiber, Option, Queue, Ref as Reference } from "effect";
import * as Whole from "effect";
import "effect";
export interface Runtime {
  readonly program: Effect.Effect<void>;
  readonly fiber: Fiber.Fiber<void, never> | null;
  readonly queue: Queue.Queue<string>;
  readonly counter: Reference.Ref<number>;
  readonly choice: Option.Option<string>;
  readonly whole: Whole.Effect.Effect<void>;
}
`),
          [true, true, true, true, false, true]
        );
      })
  );

  it.effect(
    "holds a value through an AI SDK message part or a design system Markdown type",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* holds(`import type { TextUIPart } from "ai";
import type { MDXComponents } from "@repo/design-system/types/markdown";
import type { Row } from "./rows";
export interface Entry {
  readonly part: TextUIPart;
  readonly component: MDXComponents[string];
  readonly row: Row;
}
`),
          [true, true, false]
        );
      })
  );

  it.effect(
    "holds an AI SDK value type under its imported or namespace name, not a data type",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* holds(`import type { TextUIPart as Part, JSONValue } from "ai";
import type * as AI from "ai";
export interface Entry {
  readonly part: Part;
  readonly json: JSONValue;
  readonly namespaced: AI.TextUIPart;
}
`),
          [true, false, true]
        );
      })
  );

  it.effect(
    "reads a member through an indexed access, an intersection, a nested object, and type arguments",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* holds(`import type { MDXComponents } from "mdx/types";
import type { ReactNode } from "react";
import type { Lesson, Other } from "./lesson";
export interface Forms {
  readonly component: MDXComponents[string];
  readonly title: Lesson["title"];
  readonly merged: Lesson & { readonly onChange: () => void };
  readonly nested: { readonly close: () => void };
  readonly plain: { readonly id: string };
  readonly handlers: Record<string, () => void>;
  readonly nodes: ReadonlyArray<ReactNode>;
  readonly ids: ReadonlyArray<string>;
  readonly qualified: Other.Thing;
  untyped;
}
`),
          [true, false, true, true, false, true, true, false, false, false]
        );
      })
  );

  it.effect(
    "follows the shapes that the same module declares, and stops at a shape that refers to itself",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* holds(`import type { TextUIPart } from "ai";
import type { Imported, Message } from "./message";
type Part = Exclude<Message, TextUIPart>;
type Tree = { readonly label: string; readonly next: Tree | null };
interface Actions {
  readonly close: () => void;
}
interface Entry {
  readonly part: Part;
}
export interface Holder {
  readonly actions: Actions;
  readonly entries: Entry[];
  readonly tree: Tree;
  readonly imported: Imported;
}
`),
          [true, true, true, true, false, false]
        );
      })
  );
});

describe("value members in the shape rule", () => {
  it.effect("allows a shape whose own member holds a function", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* reported(`export interface Toggle {
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
          yield* reported(`export interface Callable {
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
        yield* reported(`import type { ReactNode } from "react";
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
          yield* reported(`import type { JSXElement } from "estree-jsx";
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
          yield* reported(`import type { ReactNode } from "./nodes";
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
          yield* reported(`import type { TextUIPart } from "ai";
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
});
