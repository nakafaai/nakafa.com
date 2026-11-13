import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Option } from "effect";
import { KeyValueStore } from "effect/persistence";
import { keptStorage } from "@/components/player/storage";
import {
  KEPT_ATTEMPT_SCRIPT,
  KEPT_NAME_SCRIPT,
  KEPT_PANE_SCRIPT,
  keepActionName,
  keepAttemptLabel,
  keepName,
  readKeptAttempt,
  readKeptName,
  tryoutActionNameOf,
} from "@/components/tryout/set/kept";

const mocks = vi.hoisted(() => ({ report: vi.fn() }));

vi.mock("@/lib/analytics/client", async () => {
  const { Effect: Fx } = await import("effect");
  return {
    reportClientException: (error: unknown, properties: unknown) =>
      Fx.sync(() => mocks.report(error, properties)),
  };
});

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

/** What the browser holds after it kept the set's name. */
const storedNames = `{"${SET}":"continue-cta"}`;

describe("keepActionName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it.effect("keeps the name in the browser for the next hard load", () =>
    Effect.gen(function* () {
      yield* keepActionName(SET, "continue-cta");

      const kept = yield* readKeptName(SET).pipe(Effect.provide(keptStorage));
      expect(kept).toEqual(Option.some("continue-cta"));
      expect(mocks.report).not.toHaveBeenCalled();
    })
  );

  it.effect("reports a browser that refuses its storage and goes on", () =>
    Effect.gen(function* () {
      const refused = vi
        .spyOn(Storage.prototype, "getItem")
        .mockImplementation(() => {
          throw new Error("refused");
        });

      yield* keepActionName(SET, "continue-cta");

      refused.mockRestore();
      expect(mocks.report).toHaveBeenCalledOnce();
    })
  );
});

describe("KEPT_NAME_SCRIPT", () => {
  it("names the cell with what the browser kept for this address", () => {
    expect(runScript(storedNames)).toStrictEqual({
      "data-kept-name": "continue-cta",
    });
  });

  it("leaves the cell alone for an address it kept nothing for", () => {
    expect(runScript(storedNames, "/en/try-out")).toStrictEqual({});
  });

  it("leaves the cell alone without storage or with storage it cannot read", () => {
    expect(runScript(null)).toStrictEqual({});
    expect(runScript("not json")).toStrictEqual({});
  });
});

describe("keepAttemptLabel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it.effect("reads the label of a finished page, by its search too", () =>
    Effect.gen(function* () {
      yield* keepActionName(SET, "restart-cta");
      yield* keepAttemptLabel(SET, "Attempt 2");
      yield* keepAttemptLabel(`${SET}?attemptId=first`, "Attempt 1");

      const read = (search: string) =>
        readKeptAttempt(SET, search).pipe(Effect.provide(keptStorage));
      expect(yield* read("")).toEqual(Option.some("Attempt 2"));
      expect(yield* read("?attemptId=first")).toEqual(Option.some("Attempt 1"));
      expect(yield* read("?attemptId=other")).toEqual(Option.none());
    })
  );

  it.effect("reads no label for a page whose attempt runs again", () =>
    Effect.gen(function* () {
      yield* keepAttemptLabel(SET, "Attempt 2");
      yield* keepActionName(SET, "continue-cta");

      expect(
        yield* readKeptAttempt(SET, "").pipe(Effect.provide(keptStorage))
      ).toEqual(Option.none());
    })
  );

  it.effect("reports a browser that refuses its storage and goes on", () =>
    Effect.gen(function* () {
      const refused = vi
        .spyOn(Storage.prototype, "getItem")
        .mockImplementation(() => {
          throw new Error("refused");
        });

      yield* keepAttemptLabel(SET, "Attempt 2");

      refused.mockRestore();
      expect(mocks.report).toHaveBeenCalledOnce();
    })
  );
});

/** Runs the place's script, and returns the label it drew and whether the place still reads empty. */
function runPlaceScript(
  stored: { attempts?: string; names?: string; signedIn?: string } = {},
  search = ""
) {
  const held: Record<string, string | undefined> = {
    "nakafa-tryout-attempts": stored.attempts,
    "nakafa-tryout-names": stored.names,
  };
  const place = {
    empty: true,
    label: "",
    querySelector: () => ({
      setAttribute: (_name: string, value: string) => {
        place.label = value;
      },
    }),
    removeAttribute: (name: string) => {
      place.empty = name !== "hidden";
    },
  };
  new Function("localStorage", "location", "document", KEPT_ATTEMPT_SCRIPT)(
    { getItem: (key: string) => held[key] ?? null },
    { pathname: SET, search },
    {
      currentScript: { parentElement: place },
      documentElement: { getAttribute: () => stored.signedIn ?? "yes" },
    }
  );
  return { empty: place.empty, label: place.label };
}

describe("KEPT_ATTEMPT_SCRIPT", () => {
  const finished = {
    attempts: `{"${SET}":"Attempt 2"}`,
    names: `{"${SET}":"restart-cta"}`,
  };

  it("shows the place under the label this browser kept", () => {
    expect(runPlaceScript(finished)).toStrictEqual({
      empty: false,
      label: "Attempt 2",
    });
  });

  it("leaves the place empty for anyone but a finished page's learner", () => {
    const empty = { empty: true, label: "" };
    expect(runPlaceScript({ ...finished, signedIn: "no" })).toStrictEqual(
      empty
    );
    expect(
      runPlaceScript({ ...finished, names: `{"${SET}":"continue-cta"}` })
    ).toStrictEqual(empty);
    expect(runPlaceScript(finished, "?attemptId=other")).toStrictEqual(empty);
    expect(runPlaceScript({ attempts: finished.attempts })).toStrictEqual(
      empty
    );
    expect(runPlaceScript()).toStrictEqual(empty);
    expect(runPlaceScript({ ...finished, attempts: "not json" })).toStrictEqual(
      empty
    );
  });
});

/** Runs the pane place's script, and returns the attributes it set and whether it still reads empty. */
function runPaneScript(names: string | null, signedIn = "yes") {
  const place = {
    empty: true,
    side: "",
    removeAttribute: () => {
      place.empty = false;
    },
    setAttribute: (_name: string, value: string) => {
      place.side = value;
    },
  };
  new Function("localStorage", "location", "document", KEPT_PANE_SCRIPT)(
    { getItem: () => names },
    { pathname: SET },
    {
      currentScript: { parentElement: place },
      documentElement: { getAttribute: () => signedIn },
    }
  );
  return { empty: place.empty, side: place.side };
}

describe("KEPT_PANE_SCRIPT", () => {
  it("stands the place beside a page this browser last read as finished", () => {
    expect(runPaneScript(`{"${SET}":"restart-cta"}`)).toStrictEqual({
      empty: false,
      side: "lg",
    });
  });

  it("leaves the place empty for any other page or reader", () => {
    const empty = { empty: true, side: "" };
    expect(runPaneScript(`{"${SET}":"continue-cta"}`)).toStrictEqual(empty);
    expect(runPaneScript(`{"${SET}":"restart-cta"}`, "no")).toStrictEqual(
      empty
    );
    expect(runPaneScript(null)).toStrictEqual(empty);
    expect(runPaneScript("not json")).toStrictEqual(empty);
  });
});
