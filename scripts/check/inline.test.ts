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
    "reports an object type in a parameter, a variable, a return type, a predicate, and a satisfies target",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* shapes(`export function save(input: { readonly id: string; readonly title: string }) {}
export const pick = ({ id }: { id: string }) => id;
const totals: { count: number } = { count: 0 };
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
class Store {
  set(next: { id: string }) {}
}
`),
          [1, 2, 3, 4, 5, 8, 11, 14, 15, 17]
        );
      })
  );

  it.effect("reports one annotation once, whatever it spells out", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* shapes(`export function fold(input: { kind: "a" } | { kind: "b"; rows: { id: string }[] }) {}
`),
        [1]
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
export function plain(value) {}
const [state] = useState<{ id: string }>();
export function first<Row extends { readonly order: number }>(rows: readonly Row[]) {}
export const part = pick satisfies Extract<Row, { kind: "a" }>;
`),
          []
        );
      })
  );

  it.effect("leaves an object type that holds or extends a value alone", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* shapes(`import type { ReactNode } from "react";
export function watch(input: { readonly onDone: () => void }) {}
export function frame(input: { readonly children: ReactNode }) {}
export function metadata({ params }: { params: PageProps<"/[locale]">["params"] }) {}
export function stop(options: { readonly signal: AbortSignal; readonly pending: Promise<void> }) {}
export function respond(body: string, options?: ResponseInit & { readonly url?: string }) {}
export function widen(input: (Base & { readonly extra: string }) | null) {}
`),
        [7]
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
export function send(input: { readonly request: Request }) {}
export function receive(input: { readonly response: Response }) {}
`),
          [3, 4]
        );
      })
  );

  it.effect(
    "leaves the props of a React component alone, and reports every other parameter of a .tsx module",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* shapes(
            `export function Card({ title }: { title: string }) {}
export const Row = ({ label }: { label: string }) => null;
export const Cell = memo(({ value }: { value: number }) => null);
export const Named = memo(function Named({ value }: { value: number }) {});
export default function ({ title }: { title: string }) {}
export function Second(props: Props, state: { open: boolean }) {}
export function format(input: { title: string }) {}
const helper = (input: { title: string }) => input.title;
run(({ id }: { id: string }) => id);
class Panel {
  render(input: { title: string }) {}
}
`,
            "apps/www/components/card.tsx"
          ),
          [5, 6, 7, 8, 9, 11]
        );
        assert.deepStrictEqual(
          yield* shapes(
            "export function Card({ title }: { title: string }) {}\n",
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
            "export function build(input: { mode: string }) {}\n",
            "apps/www/next.config.ts"
          ),
          []
        );
        assert.deepStrictEqual(
          yield* shapes(
            `import { type Page } from "@playwright/test";
export function read(page: Page) {
  return page.evaluate((input: { id: string }) => input.id, { id: "a" });
}
export function outside(input: { id: string }) {}
`,
            "apps/www/e2e/support/read.browser.ts"
          ),
          [5]
        );
      })
  );
});
