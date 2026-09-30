import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { inspectReactSource } from "#scripts/check/react";
import { sourceViolations } from "#scripts/check/source";

const VIEW = "apps/www/components/example.tsx";

/** Inspects one TSX module with the React policy alone. */
function inspect(sourceText: string, file = VIEW) {
  return sourceViolations([{ file, sourceText }], [inspectReactSource]);
}

/** The message for one function that returns JSX inside a component. */
function violation(name: string, component: string) {
  return `${VIEW}: declare ${name} as a named module-level component instead of a function that returns JSX inside ${component}.`;
}

describe("React source policy", () => {
  it.effect("rejects render functions declared inside a component", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(`
export function VerseList({ items }: { items: string[] }) {
  const renderVerse = (item: string) => <Verse item={item} key={item} />;
  return <div>{items.map(renderVerse)}</div>;
}`);
      assert.deepStrictEqual(violations, [
        violation("renderVerse", "VerseList"),
      ]);
    })
  );

  it.effect("rejects nested components in every declaration form", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(`
export const Panel = memo(function Panel({ open }: { open: boolean }) {
  function Header() {
    return <h2>Title</h2>;
  }
  const Body = forwardRef(() => (open ? <p>Open</p> : null));
  const renderFooter = useCallback(() => {
    if (open) {
      return <footer />;
    }
    return null;
  }, [open]);
  const Summary = React.memo(() => <>{open && <span />}</>);
  const Hint = () => open && <small />;
  const Empty = () => (open ? null : <em />);
  return <section><Header /><Body />{renderFooter()}<Summary /><Hint /></section>;
});`);
      assert.deepStrictEqual(violations, [
        violation("Header", "Panel"),
        violation("Body", "Panel"),
        violation("renderFooter", "Panel"),
        violation("Summary", "Panel"),
        violation("Hint", "Panel"),
        violation("Empty", "Panel"),
      ]);
    })
  );

  it.effect("reports nested functions against the outermost component", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(`
export default function () {
  const Row = () => {
    const Cell = () => <td />;
    return <tr><Cell /></tr>;
  };
  return <table><Row /></table>;
}`);
      assert.deepStrictEqual(violations, [
        violation("Row", "an anonymous function"),
        violation("Cell", "an anonymous function"),
      ]);
    })
  );

  it.effect(
    "allows inline callbacks, values, and module-level components",
    () =>
      Effect.gen(function* () {
        const violations = yield* inspect(`
function Verse({ item }: { item: string }) {
  return <p>{item}</p>;
}
export const VerseList = ({ items }: { items: string[] }) => {
  const title = t.rich("title", { mark: (chunks) => <mark>{chunks}</mark> });
  const heading = <h2>{title}</h2>;
  const count = useMemo(() => items.length, [items]);
  const label = useCallback(() => String(count), [count]);
  const { length } = items;
  const dynamic = factories[length](() => <div />);
  const select = (item: string) => {
    if (!item) {
      return;
    }
    const handle = () => item;
    return handle;
  };
  return (
    <div onClick={() => select(items[0])}>
      {heading}
      {label()}
      {items.map((item) => <Verse item={item} key={item} />)}
    </div>
  );
};
export function useRenderer() {
  const render = () => <div />;
  return render;
}
const wrapped = observe(() => <div />);
declare function declared(): void;`);
        assert.deepStrictEqual(violations, []);
      })
  );

  it.effect("inspects only TSX modules", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(
        "export function build() { const render = () => null; return render; }",
        "apps/www/lib/example.ts"
      );
      assert.deepStrictEqual(violations, []);
    })
  );
});
