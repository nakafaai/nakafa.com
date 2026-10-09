import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { effectFindings } from "#scripts/check/effect";
import { parseSources } from "#scripts/check/source";

/** Lists the lines of the data shapes that one module writes, as the shape rule reports them. */
const shapes = Effect.fn("InlinePolicyTest.shapes")(function* (
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

describe("data shapes written inline", () => {
  it.effect(
    "reports an object type in a variable, a return type, a predicate, a satisfies target, and inside named arguments",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* shapes(`const totals: { count: number } = { count: 0 };
let rows: readonly { id: string }[];
export function read(): { ok: boolean } {
  return { ok: true };
}
export function load(): Promise<{ ok: boolean }> {
  return run();
}
export function isGroup(value: unknown): value is { items: readonly unknown[] } {
  return check(value);
}
export const missing = { kind: "missing" } satisfies { kind: "missing" };
export const table: Record<string, { label: string }> = {};
export function list(input: { locale: string; rows: readonly { id: string }[] }) {}
export function each(rows: { id: string }[]) {}
export function fold(input: { kind: "a" } | { kind: "b"; at: number }) {}
`),
          [1, 2, 3, 6, 9, 12, 13, 14, 15, 16]
        );
      })
  );

  it.effect(
    "leaves the object type that names a function's arguments alone",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* shapes(`export function save(input: { readonly id: string; readonly title: string }) {}
export const pick = ({ id }: { id: string }) => id;
export function wrap(input: ({ id: string })) {}
export function mixed(input: { run(): void; plain; id: string }) {}
export function extend(input: Cursor & { readonly category: string }) {}
export function patch(overrides?: Partial<{ credits: number }>, fixed?: Readonly<Base>) {}
export function nested(input: Cursor & { readonly rows: { id: string }[] }) {}
export function own(input: Required) {}
class Store {
  set(next: { id: string }) {}
}
`),
          [7]
        );
      })
  );

  it.effect(
    "leaves annotations without an object type, empty object types, type arguments of calls, and constraints alone",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* shapes(`import { Schema } from "effect";
const Lesson = Schema.Struct({ title: Schema.String });
export function save(lesson: typeof Lesson.Type, count: number, anything: {}) {}
export function count(): number {
  return 1;
}
export function isLesson(value: unknown): value is typeof Lesson.Type {
  return check(value);
}
export function assertReady(value: unknown): asserts value {}
export function plain(value) {}
const [state] = useState<{ id: string }>();
export function first<Row extends { readonly order: number }>(rows: readonly Row[]) {}
export const part = pick satisfies Extract<Row, { kind: "a" }>;
let empty: {};
`),
          []
        );
      })
  );

  it.effect("leaves an object type that holds or extends a value alone", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* shapes(`import type { ReactNode } from "react";
let watch: { readonly onDone: () => void };
let frame: { readonly children: ReactNode };
let route: { params: PageProps<"/[locale]">["params"] };
let stop: { readonly signal: AbortSignal; readonly pending: Promise<void> };
let init: ResponseInit & { readonly url?: string };
let widen: (Base & { readonly extra: string }) | null;
`),
        [7]
      );
    })
  );

  it.effect(
    "leaves an object type that names a type parameter in scope alone",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* shapes(`export function stop<const ToolName extends string>(
  steps: readonly { readonly toolCalls: readonly { readonly toolName: ToolName }[] }[]
) {}
export function narrow<Family extends Kind>(
  value: Snapshot
): value is Extract<Snapshot, { readonly family: Family }> {
  return check(value);
}
class Box<Item> {
  read(): { readonly item: Item } {
    return run();
  }
  plain(): { readonly id: string } {
    return run();
  }
}
export function unused<Item>(rows: { id: string }[]) {}
export function shadowed<Item>(rows: { keys: { [Item in Keys]: Item }; id: string }[]) {}
`),
          [13, 17, 18]
        );
      })
  );

  it.effect(
    "leaves an object type that holds a three.js object or a TypeScript syntax-tree node alone",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* shapes(`import { type Color, Vector3 } from "three";
import type { CallExpression, PropertyAccessExpression } from "typescript/unstable/ast";
let particles: { readonly position: Vector3; readonly id: string }[];
export function isPainted(value: unknown): value is { readonly color: Color } {
  return check(value);
}
export function isMethodCall(
  node: unknown
): node is CallExpression & { readonly expression: PropertyAccessExpression } {
  return check(node);
}
let plain: { readonly position: readonly [number, number, number] }[];
`),
          [12]
        );
      })
  );

  it.effect(
    "judges a platform type name that the module binds itself as the module's own type",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* shapes(`import type { Request } from "./request";
type Response = typeof ResponseSchema.Type;
let sent: { readonly request: Request };
let received: { readonly response: Response };
`),
          [3, 4]
        );
      })
  );

  it.effect(
    "leaves the props of a React component alone, and judges every other parameter of a .tsx module",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* shapes(
            `export function Card({ rows }: { rows: { id: string }[] }) {}
export const Row = ({ rows }: { rows: { id: string }[] }) => null;
export const Cell = memo(({ rows }: { rows: { id: string }[] }) => null);
export const Named = memo(function Named({ rows }: { rows: { id: string }[] }) {});
export default function ({ rows }: { rows: { id: string }[] }) {}
export function Second(props: Props, state: { rows: { id: string }[] }) {}
export function format(input: { rows: { id: string }[] }) {}
const helper = (input: { rows: { id: string }[] }) => input.rows;
run(({ rows }: { rows: { id: string }[] }) => rows);
class Panel {
  render(input: { rows: { id: string }[] }) {}
}
`,
            "apps/www/components/card.tsx"
          ),
          [5, 6, 7, 8, 9, 11]
        );
        assert.deepStrictEqual(
          yield* shapes(
            "export function Card({ rows }: { rows: { id: string }[] }) {}\n",
            "apps/www/lib/card.ts"
          ),
          [1]
        );
      })
  );

  it.effect(
    "leaves framework configuration and browser page functions alone",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* shapes(
            'export const settings: { mode: string } = { mode: "a" };\n',
            "apps/www/next.config.ts"
          ),
          []
        );
        assert.deepStrictEqual(
          yield* shapes(
            `import { type Page } from "@playwright/test";
export function read(page: Page) {
  return page.evaluate((rows: { id: string }[]) => rows.length, []);
}
export function outside(rows: { id: string }[]) {}
`,
            "apps/www/e2e/support/read.browser.ts"
          ),
          [5]
        );
      })
  );
});
