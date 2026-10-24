import { describe, expect, it } from "@effect/vitest";
import { TRYOUT_CATALOG_LIMIT } from "@repo/backend/confect/contentRelease/tryout/limits";
import { Effect, Option } from "effect";
import { selectionKey } from "@/components/tryout/catalog/table/keys";
import type {
  TryoutSetListArgs,
  TryoutSetPage,
  TryoutSetRequest,
} from "@/components/tryout/catalog/table/types";
import {
  commitVisitorWindow,
  failVisitorSets,
  requestVisitorSets,
  settleVisitorSets,
  startVisitorSets,
  syncVisitorSets,
  visitorReadInput,
  visitorSetView,
  visitorWindowKey,
} from "@/components/tryout/catalog/table/visitor";

const request: TryoutSetRequest = {
  countryKey: "id",
  examKey: "utbk",
  filter: "all",
  locale: "id",
  sort: { direction: "asc", field: "order" },
  trackKey: "saintek",
};

const other: TryoutSetRequest = {
  ...request,
  filter: "not-started",
  sort: { direction: "desc", field: "title" },
};

function args(base: TryoutSetRequest, numItems: number): TryoutSetListArgs {
  return { ...base, paginationOpts: { cursor: null, numItems } };
}

function page(isDone: boolean, snapshotId = "snapshot-1"): TryoutSetPage {
  return {
    continueCursor: "",
    isDone,
    page: [],
    snapshotId,
    viewerId: null,
  };
}

const bootstrap = { args: args(request, 25), result: page(false) };

describe("visitor set list state", () => {
  it("starts from the loader's first page and keeps its window", () => {
    const state = startVisitorSets(bootstrap);
    expect(state.committed).toStrictEqual({
      key: visitorWindowKey(request, 25),
      page: bootstrap.result,
    });
    expect(state.pendingKey).toStrictEqual(Option.none());
    expect(state.failedKey).toStrictEqual(Option.none());
    expect(visitorSetView(state, request)).toMatchObject({
      busy: false,
      error: false,
      hasMore: true,
      nextSize: 50,
      offline: false,
      snapshotId: "snapshot-1",
    });
  });

  it("keeps the state for the same bootstrap and rebuilds it for another", () => {
    const state = startVisitorSets(bootstrap);
    expect(syncVisitorSets(state, bootstrap)).toBe(state);
    const next = { args: args(other, 25), result: page(true, "snapshot-2") };
    const rebuilt = syncVisitorSets(state, next);
    expect(rebuilt.committed.page).toBe(next.result);
    expect(rebuilt.window).toStrictEqual({
      selection: selectionKey(next.args),
      size: 25,
    });
  });

  it("drops a response for another track once the loader hands over that track", () => {
    const state = requestVisitorSets(startVisitorSets(bootstrap), request, 50);
    const rebuilt = syncVisitorSets(state, {
      args: args({ ...request, trackKey: "soshum" }, 25),
      result: page(true, "snapshot-2"),
    });
    expect(
      settleVisitorSets(rebuilt, visitorWindowKey(request, 50), page(false))
    ).toBe(rebuilt);
  });

  it("commits the response for the request the state waits for", () => {
    const key = visitorWindowKey(request, 50);
    const waiting = requestVisitorSets(
      startVisitorSets(bootstrap),
      request,
      50
    );
    expect(visitorSetView(waiting, request)).toMatchObject({
      busy: true,
      error: false,
    });
    const settled = settleVisitorSets(waiting, key, page(true, "snapshot-3"));
    expect(settled.pendingKey).toStrictEqual(Option.none());
    expect(settled.committed).toStrictEqual({
      key,
      page: page(true, "snapshot-3"),
    });
    expect(visitorSetView(settled, request)).toMatchObject({
      busy: false,
      hasMore: false,
      snapshotId: "snapshot-3",
    });
  });

  it("drops a response for a request that a later one replaced", () => {
    const first = requestVisitorSets(startVisitorSets(bootstrap), request, 50);
    const later = requestVisitorSets(first, other, 25);
    const stale = settleVisitorSets(
      later,
      visitorWindowKey(request, 50),
      page(true, "stale")
    );
    expect(stale).toBe(later);
    const failed = failVisitorSets(later, visitorWindowKey(request, 50));
    expect(failed).toBe(later);
  });

  it("reports a failed request for the window it asked for", () => {
    const key = visitorWindowKey(request, 50);
    const waiting = requestVisitorSets(
      startVisitorSets(bootstrap),
      request,
      50
    );
    const failed = failVisitorSets(waiting, key);
    expect(failed.pendingKey).toStrictEqual(Option.none());
    expect(failed.failedKey).toStrictEqual(Option.some(key));
    expect(visitorSetView(failed, request)).toMatchObject({
      busy: false,
      error: true,
    });
    const retried = requestVisitorSets(failed, request, 50);
    expect(retried.failedKey).toStrictEqual(Option.none());
  });

  it("restarts the window on a new selection and stops at the catalog limit", () => {
    const grown = requestVisitorSets(startVisitorSets(bootstrap), request, 50);
    expect(visitorSetView(grown, other)).toMatchObject({ nextSize: 50 });
    expect(visitorSetView(grown, request)).toMatchObject({ nextSize: 75 });
    const full = requestVisitorSets(
      startVisitorSets(bootstrap),
      request,
      TRYOUT_CATALOG_LIMIT
    );
    expect(visitorSetView(full, request)).toMatchObject({
      hasMore: false,
      nextSize: TRYOUT_CATALOG_LIMIT,
    });
  });

  it.effect("commits the page that a window read returns for its request", () =>
    Effect.gen(function* () {
      const key = visitorWindowKey(request, 50);
      let state = requestVisitorSets(startVisitorSets(bootstrap), request, 50);
      yield* commitVisitorWindow({
        commit: (update) => {
          state = update(state);
        },
        key,
        read: Effect.succeed({ result: page(true, "snapshot-2") }),
      });
      expect(state.committed).toStrictEqual({
        key,
        page: page(true, "snapshot-2"),
      });
      expect(state.pendingKey).toStrictEqual(Option.none());
    })
  );

  it.effect("records a failed window read for the request it asked for", () =>
    Effect.gen(function* () {
      const key = visitorWindowKey(request, 50);
      let state = requestVisitorSets(startVisitorSets(bootstrap), request, 50);
      yield* commitVisitorWindow({
        commit: (update) => {
          state = update(state);
        },
        key,
        read: Effect.fail("offline"),
      });
      expect(state.failedKey).toStrictEqual(Option.some(key));
      expect(state.pendingKey).toStrictEqual(Option.none());
    })
  );

  it("maps a request to the server function input", () => {
    expect(visitorReadInput(request, 75)).toStrictEqual({
      locale: "id",
      numItems: 75,
      search: { direction: "asc", sort: "order", status: "all" },
      track: { countryKey: "id", examKey: "utbk", trackKey: "saintek" },
    });
  });
});
