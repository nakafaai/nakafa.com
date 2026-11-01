import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Option } from "effect";
import { KeyValueStore } from "effect/persistence";
import {
  KEPT_NAME_SCRIPT,
  keepName,
  readKeptName,
  tryoutActionNameOf,
} from "@/components/tryout/set/kept";

const SET = "/en/try-out/indonesia/snbt/2027/set-1";

const scoped = <A, E>(
  effect: Effect.Effect<A, E, KeyValueStore.KeyValueStore>
) => Effect.provide(effect, KeyValueStore.layerMemory);

/** Runs the cell's script over the browser's storage, and returns what it set on the cell. */
function runScript(stored: string | null, pathname = SET) {
  const set: Record<string, string> = {};
  const parentElement = {
    setAttribute: (name: string, value: string) => {
      set[name] = value;
    },
  };
  new Function("localStorage", "location", "document", KEPT_NAME_SCRIPT)(
    { getItem: () => stored },
    { pathname },
    { currentScript: { parentElement } }
  );
  return set;
}

describe("tryoutActionNameOf", () => {
  it("continues a running attempt, restarts a finished one, and starts otherwise", () => {
    expect(tryoutActionNameOf({ status: "in-progress" })).toBe("continue-cta");
    expect(tryoutActionNameOf({ status: "completed" })).toBe("restart-cta");
    expect(tryoutActionNameOf(null)).toBe("start-cta");
    expect(tryoutActionNameOf(undefined)).toBe("start-cta");
  });
});

describe("kept names", () => {
  it.effect("reads nothing for a page the browser never read", () =>
    scoped(
      Effect.gen(function* () {
        expect(yield* readKeptName(SET)).toEqual(Option.none());
      })
    )
  );

  it.effect("keeps the latest name a page read", () =>
    scoped(
      Effect.gen(function* () {
        yield* keepName(SET, "start-cta");
        yield* keepName(SET, "continue-cta");

        expect(yield* readKeptName(SET)).toEqual(Option.some("continue-cta"));
      })
    )
  );

  it.effect("lets the page read longest ago leave first", () =>
    scoped(
      Effect.gen(function* () {
        yield* keepName("/oldest", "start-cta");
        yield* keepName("/refreshed", "start-cta");
        yield* Effect.forEach(
          Arr.makeBy(38, (index) => `/page-${index}`),
          (page) => keepName(page, "start-cta"),
          { discard: true }
        );
        yield* keepName("/refreshed", "continue-cta");
        yield* keepName("/newest", "start-cta");

        expect(yield* readKeptName("/oldest")).toEqual(Option.none());
        expect(yield* readKeptName("/refreshed")).toEqual(
          Option.some("continue-cta")
        );
      })
    )
  );

  it.effect("reads an entry that no longer decodes as nothing kept", () =>
    scoped(
      Effect.gen(function* () {
        const store = yield* KeyValueStore.KeyValueStore;
        yield* store.set("nakafa-tryout-names", "not json");

        expect(yield* readKeptName(SET)).toEqual(Option.none());
      })
    )
  );
});

describe("KEPT_NAME_SCRIPT", () => {
  it("names the cell with what the browser kept for this address", () => {
    expect(runScript(JSON.stringify({ [SET]: "continue-cta" }))).toStrictEqual({
      "data-kept-name": "continue-cta",
    });
  });

  it("leaves the cell alone for an address it kept nothing for", () => {
    expect(runScript(`{"${SET}":"continue-cta"}`, "/en/try-out")).toStrictEqual(
      {}
    );
  });

  it("leaves the cell alone without storage or with storage it cannot read", () => {
    expect(runScript(null)).toStrictEqual({});
    expect(runScript("not json")).toStrictEqual({});
  });
});
