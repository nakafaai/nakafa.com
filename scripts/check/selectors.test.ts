import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectSelectorSource } from "#scripts/check/selectors";
import { parseSources } from "#scripts/check/source";

const FILE = "apps/www/src/components/comments/provider.tsx";

/** Inspects one module with the store selector policy alone. */
function inspect(sourceText: string) {
  return Effect.scoped(
    Effect.map(parseSources([{ file: FILE, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectSelectorSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

/** The finding of a selector that builds a new value on line `line`. */
const fresh = (line: number) =>
  `${FILE}:${line}: this store selector answers a new array or object on every read, which renders React again without end: wrap it in useShallow, or answer a module-level constant (store-selector)`;

/** The finding of a caller's selector passed on bare on line `line`. */
const bare = (line: number, name: string) =>
  `${FILE}:${line}: ${name} comes from the hook's caller, who cannot see that it must answer a stable value: pass useShallow(${name}) to useStore (store-selector)`;

describe("Store selector policy", () => {
  it.effect(
    "reports a selector that builds an object, an array, a new value or a lazy empty fallback",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`import { useStore as read } from "zustand";
const a = read(store, (state) => ({ open: state.open }));
const b = read(store, (state) => [state.open]);
const c = read(store, (state) => Option.getOrElse(state.photos, () => []));
const d = read(store, function (state) { if (state.open) { return state.list; } return new Map(); });
const e = read(store, (state) => state.photos ?? []);
const f = read(store, (state) => ({ ...state }) as Draft);
const g = read(store, (state) => (state.open ? state.list : []));`),
          [fresh(2), fresh(3), fresh(4), fresh(5), fresh(6), fresh(7), fresh(8)]
        );
      })
  );

  it.effect("reports a hook that passes its caller's selector on bare", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`import { useStore } from "zustand";
export function useCommentDraft<T>(selector: (draft: Draft) => T) {
  return useStore(store, selector);
}`),
        [bare(3, "selector")]
      );
    })
  );

  it.effect(
    "keeps a shallow selector, a stable answer, a nested builder, and a store read without a selector",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
const NO_PHOTOS = [];
export function useDraft<T>(selector: (draft: Draft) => T) {
  return useStore(store, useShallow(selector));
}
const a = useStore(store, useShallow((state) => ({ open: state.open })));
const b = useStore(store, (state) => Option.getOrElse(state.photos, () => NO_PHOTOS));
const c = useStore(store, (state) => state.open);
const d = useStore(store, (state) => { const build = () => ({}); return state.open; });
const e = useStore(store);
const f = useStore(store, picked);
const g = useStore(store, (state) => { if (state.closed) { return; } return state.open; });
const h = useStore(store, (state) => (state.open ? state.list : NO_PHOTOS));
function useLab({ store }: Lab) { return useStore(store, (state) => state.open); }`),
          []
        );
      })
  );

  it.effect(
    "reads nothing in a module that does not import Zustand's useStore",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`import { useStore } from "@tanstack/react-store";
import type { StoreApi } from "zustand";
const a = useStore(store, (state) => ({ open: state.open }));`),
          []
        );
      })
  );
});
