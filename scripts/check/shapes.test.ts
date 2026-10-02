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
});
