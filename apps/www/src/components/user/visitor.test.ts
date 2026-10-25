import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  appendVisitorPage,
  failNextVisitorPage,
  readVisitorPage,
  requestNextVisitorPage,
  startVisitorList,
  syncVisitorList,
  type VisitorListState,
  visitorListView,
} from "@/components/user/visitor";

const first = {
  continueCursor: "cursor-1",
  isDone: false,
  page: ["a", "b"],
};

describe("visitor profile list", () => {
  it("starts from the loader's first page", () => {
    expect(startVisitorList(first)).toStrictEqual({
      cursor: "cursor-1",
      failed: false,
      isDone: false,
      pending: false,
      rows: ["a", "b"],
      source: first,
    });
  });

  it("starts failed with no rows when the server read no first page", () => {
    const state = startVisitorList<string>(undefined);
    expect(state).toStrictEqual({
      cursor: "",
      failed: true,
      isDone: true,
      pending: false,
      rows: [],
      source: undefined,
    });
    expect(visitorListView(state)).toStrictEqual({
      empty: false,
      failed: true,
      ready: true,
      rows: [],
    });
  });

  it("rebuilds a failed start from the first page that a retry hands over", () => {
    const failed = startVisitorList<string>(undefined);
    expect(syncVisitorList(failed, undefined)).toBe(failed);
    const retried = syncVisitorList(failed, first);
    expect(retried).toStrictEqual(startVisitorList(first));
    expect(visitorListView(retried)).toMatchObject({
      failed: false,
      rows: ["a", "b"],
    });
  });

  it("keeps the pages it has read while the loader hands over the same first page", () => {
    const read = appendVisitorPage(
      requestNextVisitorPage(startVisitorList(first)),
      {
        continueCursor: "cursor-2",
        isDone: true,
        page: ["c"],
      }
    );
    expect(syncVisitorList(read, first)).toBe(read);
  });

  it("reads one next page at a time and appends it", () => {
    const requested = requestNextVisitorPage(startVisitorList(first));
    expect(requested.pending).toBe(true);
    expect(requestNextVisitorPage(requested)).toBe(requested);
    const appended = appendVisitorPage(requested, {
      continueCursor: "cursor-2",
      isDone: true,
      page: ["c"],
    });
    expect(appended).toStrictEqual({
      cursor: "cursor-2",
      failed: false,
      isDone: true,
      pending: false,
      rows: ["a", "b", "c"],
      source: first,
    });
    expect(requestNextVisitorPage(appended)).toBe(appended);
  });

  it("ignores a page that no read is waiting for", () => {
    const state = startVisitorList(first);
    expect(
      appendVisitorPage(state, { continueCursor: "x", isDone: true, page: [] })
    ).toBe(state);
    expect(failNextVisitorPage(state)).toBe(state);
  });

  it("records a failed next page and reads it again", () => {
    const failed = failNextVisitorPage(
      requestNextVisitorPage(startVisitorList(first))
    );
    expect(failed).toMatchObject({
      failed: true,
      pending: false,
      rows: ["a", "b"],
    });
    expect(visitorListView(failed)).toMatchObject({
      empty: false,
      failed: true,
    });
    expect(requestNextVisitorPage(failed)).toMatchObject({
      failed: false,
      pending: true,
    });
  });

  it("shows the empty sentence only for a finished list with no rows", () => {
    const empty = startVisitorList({
      continueCursor: "",
      isDone: true,
      page: [],
    });
    expect(visitorListView(empty)).toMatchObject({
      empty: true,
      failed: false,
    });
  });

  it.effect("commits the page a read returns to the list it started from", () =>
    Effect.gen(function* () {
      let state: VisitorListState<string> = requestNextVisitorPage(
        startVisitorList(first)
      );
      yield* readVisitorPage<string>({
        commit: (update) => {
          state = update(state);
        },
        cursor: state.cursor,
        readPage: (cursor) =>
          Promise.resolve({
            continueCursor: `${cursor}-next`,
            isDone: true,
            page: ["c"],
          }),
      });
      expect(state).toMatchObject({
        cursor: "cursor-1-next",
        failed: false,
        isDone: true,
        pending: false,
        rows: ["a", "b", "c"],
      });
    })
  );

  it.effect("commits a failed read as a failed next page", () =>
    Effect.gen(function* () {
      let state: VisitorListState<string> = requestNextVisitorPage(
        startVisitorList(first)
      );
      yield* readVisitorPage<string>({
        commit: (update) => {
          state = update(state);
        },
        cursor: state.cursor,
        readPage: () => Promise.reject(new Error("offline")),
      });
      expect(state).toMatchObject({
        failed: true,
        pending: false,
        rows: ["a", "b"],
      });
    })
  );
});
