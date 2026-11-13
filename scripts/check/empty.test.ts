import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectEmptySource } from "#scripts/check/empty";
import { parseSources } from "#scripts/check/source";

const VIEW = "apps/www/src/components/example.tsx";

/** Inspects one module with the empty state policy alone. */
function inspect(sourceText: string, file = VIEW) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectEmptySource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

describe("Empty state source policy", () => {
  it.effect("rejects an EmptyState that shows no Nina", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`
export function List() {
  return (
    <>
      <EmptyState title={t("empty")} />
      <EmptyState scene={<h1>{t("title")}</h1>} title={t("empty")} />
    </>
  );
}`),
        [
          `${VIEW}:5: an EmptyState shows no Nina. Give it scene={<EmptyNina act="..." />}, DeferredEmptyNina where her code loads apart, or a whole page's DeferredFigure, so every empty place shows her.`,
          `${VIEW}:6: an EmptyState shows no Nina. Give it scene={<EmptyNina act="..." />}, DeferredEmptyNina where her code loads apart, or a whole page's DeferredFigure, so every empty place shows her.`,
        ]
      );
    })
  );

  it.effect(
    "accepts Nina, a page's figure, a scene a value holds, and the state folder",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function List() {
  return (
    <>
      <EmptyState scene={<EmptyNina act="sleeping" />} title={t("empty")} />
      <EmptyState scene={failed ? <EmptyNina act="sad" /> : <DeferredFigure />} title={t("empty")} />
      <EmptyState scene={<DeferredEmptyNina act="waving" />} title={t("soon")} />
    </>
  );
}`),
          []
        );
        assert.deepStrictEqual(
          yield* inspect(
            `import { Empty } from "@repo/design-system/components/ui/empty";
export function EmptyState() { return <Empty />; }`,
            "apps/www/src/components/state/empty.tsx"
          ),
          []
        );
        assert.deepStrictEqual(
          yield* inspect(
            `import { Empty } from "@repo/design-system/components/ui/empty";`,
            "apps/www/src/components/example.ts"
          ),
          []
        );
      })
  );

  it.effect(
    "rejects the empty parts outside the state folder and an empty state of a module's own",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`import { Empty, EmptyTitle } from "@repo/design-system/components/ui/empty";
import { EmptyState } from "@/components/state/empty";
export function FeedEmpty({ children }) {
  return <p>{children}</p>;
}
const SearchEmpty = () => <p />;
export function ListEmpty() {
  return <EmptyState scene={<EmptyNina act="sleeping" />} title="x" />;
}
const Label = "empty";
let later;
export default function () {
  return null;
}`),
          [
            `${VIEW}:1: an empty state is built from the parts of @repo/design-system/components/ui/empty. Draw EmptyState from components/state/empty, which gives every empty place its scene, its title and its way on.`,
            `${VIEW}:3: FeedEmpty draws an empty state of its own. Draw EmptyState with Nina in its scene instead.`,
            `${VIEW}:6: SearchEmpty draws an empty state of its own. Draw EmptyState with Nina in its scene instead.`,
          ]
        );
      })
  );
});
