import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectReactSource, inspectStateSource } from "#scripts/check/react";
import { parseSources } from "#scripts/check/source";

const VIEW = "apps/www/components/example.tsx";

/** Inspects one TSX module with the React policy alone. */
function inspect(sourceText: string, file = VIEW) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectReactSource(parsed.file, parsed.sourceFile)
      )
    )
  );
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

/** Inspects one module with the shared-state policy alone. */
function inspectState(sourceText: string, file = VIEW) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectStateSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

const USE_CONTEXT = "read contexts with use() instead of React's useContext";
const CREATE =
  "create Zustand stores per provider with createStore and read them with useStore, instead of a module-level store from create";
const REMOVED =
  "import nothing from use-context-selector. Read render values from a React context with use(), and keep state a provider owns in a Zustand store created per provider";

describe("Shared state policy", () => {
  it.effect("rejects any use-context-selector import", () =>
    Effect.gen(function* () {
      const violations = yield* inspectState(`
import { createContext, useContextSelector } from "use-context-selector";
import type { Context } from "use-context-selector";
export const Theme = createContext("light");`);
      assert.deepStrictEqual(violations, [
        `${VIEW}: ${REMOVED}.`,
        `${VIEW}: ${REMOVED}.`,
      ]);
    })
  );

  it.effect(
    "rejects useContext and module-level stores in every import form",
    () =>
      Effect.gen(function* () {
        const file = "apps/www/lib/theme.ts";
        const violations = yield* inspectState(
          `
import React, { useContext as read } from "react";
import * as Core from "react";
import { create } from "zustand";
import * as Zustand from "zustand";
export const useTheme = () => read(Theme);
export const useLegacy = () => React.useContext(Theme);
export const useCore = () => Core.useContext(Theme);
export const useCount = create(() => ({ count: 0 }));
export const useOther = Zustand.create(() => ({ count: 0 }));`,
          file
        );
        assert.deepStrictEqual(violations, [
          `${file}: ${USE_CONTEXT}.`,
          `${file}: ${CREATE}.`,
          `${file}: ${USE_CONTEXT}.`,
          `${file}: ${USE_CONTEXT}.`,
          `${file}: ${CREATE}.`,
        ]);
      })
  );

  it.effect(
    "allows React contexts read with use and stores created per provider",
    () =>
      Effect.gen(function* () {
        const violations = yield* inspectState(`
import "react";
import React, { createContext, type ReactNode, use, useState } from "react";
import { createStore, type StoreApi, useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { LibraryContext } from "library";
const Theme = createContext("light");
export const useTheme = () => use(Theme);
export const useFlag = () => React.useState(false);
export const useLibrary = () => use(LibraryContext);
export const read = (store: { useContext: () => void }) => store.useContext();
export function useCount(store: StoreApi<{ count: number }>) {
  return useStore(store, useShallow((state) => state.count));
}`);
        assert.deepStrictEqual(violations, []);
      })
  );
});
