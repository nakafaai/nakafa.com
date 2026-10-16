import { describe, expect, it } from "@effect/vitest";
import {
  isPrunable,
  STEP_KEEP_DELAY,
} from "@repo/backend/confect/editor/prune";
import { Duration } from "effect";

const KEEP_DELAY_MILLIS = Duration.toMillis(STEP_KEEP_DELAY);

describe("editor/prune rule", () => {
  it("prunes a step that a snapshot covers once it is at least the keep delay old", () => {
    expect(
      isPrunable({
        at: 0,
        now: KEEP_DELAY_MILLIS,
        snapshotVersion: 5,
        version: 5,
      })
    ).toBe(true);
  });

  it("keeps a covered step one millisecond younger than the keep delay", () => {
    expect(
      isPrunable({
        at: 1,
        now: KEEP_DELAY_MILLIS,
        snapshotVersion: 5,
        version: 5,
      })
    ).toBe(false);
  });

  it("keeps a step the snapshot does not cover, however old it is", () => {
    expect(
      isPrunable({
        at: 0,
        now: KEEP_DELAY_MILLIS * 100,
        snapshotVersion: 5,
        version: 6,
      })
    ).toBe(false);
  });
});
