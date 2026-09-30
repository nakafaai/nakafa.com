import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { inspectContextSource, inspectReactSource } from "#scripts/check/react";
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

/** Inspects one module with the context policy alone. */
function inspectContexts(sourceText: string, file = VIEW) {
  return sourceViolations([{ file, sourceText }], [inspectContextSource]);
}

/** The message for one React context API. */
function contextViolation(api: string, replacement: string, file = VIEW) {
  return `${file}: use ${replacement} from use-context-selector instead of React's ${api}, so each consumer re-renders only for the value it selects.`;
}

describe("React context policy", () => {
  it.effect("rejects React's context APIs imported by name", () =>
    Effect.gen(function* () {
      const violations = yield* inspectContexts(`
import { createContext, type ReactNode, useContext as read } from "react";
const Theme = createContext("light");
export function useTheme() {
  return read(Theme);
}`);
      assert.deepStrictEqual(violations, [
        contextViolation("createContext", "createContext"),
        contextViolation("useContext", "useContextSelector"),
      ]);
    })
  );

  it.effect(
    "rejects context APIs reached through default and namespace imports",
    () =>
      Effect.gen(function* () {
        const file = "apps/www/lib/theme.ts";
        const violations = yield* inspectContexts(
          `
import React from "react";
import * as Core from "react";
export const Theme = React.createContext("light");
export const useTheme = () => Core.useContext(Theme);
export const useFlag = () => React.useState(false);`,
          file
        );
        assert.deepStrictEqual(violations, [
          contextViolation("createContext", "createContext", file),
          contextViolation("useContext", "useContextSelector", file),
        ]);
      })
  );

  it.effect("allows use-context-selector and third-party contexts", () =>
    Effect.gen(function* () {
      const violations = yield* inspectContexts(`
import "react";
import { type ReactNode, use } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { LibraryContext } from "library";
const Theme = createContext("light");
export const useTheme = () => useContextSelector(Theme, (theme) => theme);
export const useLibrary = () => use(LibraryContext);
export const read = (store: { useContext: () => void }) => store.useContext();`);
      assert.deepStrictEqual(violations, []);
    })
  );
});
