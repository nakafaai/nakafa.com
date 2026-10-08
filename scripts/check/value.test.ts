import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { isInterfaceDeclaration } from "typescript/unstable/ast";
import { parseSources } from "#scripts/check/source";
import { frameworkNames, holdsValueMember } from "#scripts/check/value";

/**
 * Lists, for each member of the interfaces in one module in source order,
 * whether the member holds a function, a constructor, or a React or MDX value.
 */
const holds = Effect.fn("ValueTest.holds")(function* (sourceText: string) {
  const { modules } = yield* parseSources([
    { file: "apps/www/lib/example.ts", sourceText },
  ]);
  return Arr.flatMap(modules, ({ sourceFile }) => {
    const names = frameworkNames(sourceFile);
    return Arr.flatMap(sourceFile.statements, (statement) =>
      isInterfaceDeclaration(statement)
        ? Arr.map(statement.members, (member) =>
            holdsValueMember(member, names)
          )
        : []
    );
  });
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
});
