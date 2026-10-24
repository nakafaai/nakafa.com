import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import {
  createHomeReleases,
  releaseInRows,
} from "@/components/tenant/home/release";

const sittingIdOf = Schema.decodeUnknownSync(Id("examSittings"));

describe("tenant home releases in flight", () => {
  it("holds a sitting while its release is in flight, and gives it up when the release ends", () => {
    const store = createHomeReleases();
    const sitting = sittingIdOf("sitting-a");
    store.getState().start(sitting);
    expect(store.getState().ids).toStrictEqual([sitting]);
    store.getState().end(sitting);
    expect(store.getState().ids).toStrictEqual([]);
  });

  it("keeps the other releases in flight when one ends", () => {
    const store = createHomeReleases();
    const first = sittingIdOf("sitting-a");
    const second = sittingIdOf("sitting-b");
    store.getState().start(first);
    store.getState().start(second);
    store.getState().end(first);
    expect(store.getState().ids).toStrictEqual([second]);
  });
});

describe("tenant home closed sittings after a release", () => {
  it("marks the released sitting as released, with no release left to offer", () => {
    const first = sittingIdOf("sitting-a");
    const second = sittingIdOf("sitting-b");
    const rows = [
      { canRelease: true, id: first, resultsReleased: false, room: "Lab 1" },
      { canRelease: true, id: second, resultsReleased: false, room: "Lab 2" },
    ];
    expect(releaseInRows(rows, first)).toStrictEqual([
      { canRelease: false, id: first, resultsReleased: true, room: "Lab 1" },
      { canRelease: true, id: second, resultsReleased: false, room: "Lab 2" },
    ]);
  });
});
