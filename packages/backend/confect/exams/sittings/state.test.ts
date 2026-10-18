import { describe, expect, it } from "@effect/vitest";
import {
  decideProctorAction,
  type ProctorAction,
  type ProctoredState,
} from "@repo/backend/confect/exams/sittings/state";
import { Effect } from "effect";

/** The refusal that an action gets, for the state and timing the test names. */
const refusalOf = (
  action: typeof ProctorAction.Type,
  state: typeof ProctoredState.Type,
  beforeDeadline: boolean
) => Effect.flip(decideProctorAction(action, state, beforeDeadline));

describe("exams/sittings state: lock", () => {
  it.effect("locks an attempt in progress and keeps its deadline", () =>
    Effect.gen(function* () {
      expect(
        yield* decideProctorAction("lock", "inProgress", true)
      ).toStrictEqual({
        deadline: "kept",
        state: "locked",
      });
    })
  );

  it.effect("accepts a lock on a locked attempt with no change", () =>
    Effect.gen(function* () {
      expect(yield* decideProctorAction("lock", "locked", true)).toStrictEqual({
        deadline: "kept",
        state: "locked",
      });
    })
  );

  it.effect("refuses a lock on a closing attempt by its state", () =>
    Effect.gen(function* () {
      expect(yield* refusalOf("lock", "closing", true)).toMatchObject({
        _tag: "ProctorActionRefused",
        action: "lock",
        reason: "state",
        state: "closing",
      });
    })
  );
});

describe("exams/sittings state: unlock", () => {
  it.effect("returns a locked attempt to progress before its deadline", () =>
    Effect.gen(function* () {
      expect(
        yield* decideProctorAction("unlock", "locked", true)
      ).toStrictEqual({
        deadline: "kept",
        state: "inProgress",
      });
    })
  );

  it.effect("moves a locked attempt to closing after its deadline", () =>
    Effect.gen(function* () {
      expect(
        yield* decideProctorAction("unlock", "locked", false)
      ).toStrictEqual({
        deadline: "kept",
        state: "closing",
      });
    })
  );

  it.effect("refuses an unlock on an attempt in progress by its state", () =>
    Effect.gen(function* () {
      expect(yield* refusalOf("unlock", "inProgress", true)).toMatchObject({
        action: "unlock",
        reason: "state",
        state: "inProgress",
      });
    })
  );

  it.effect("refuses an unlock on a closing attempt by its state", () =>
    Effect.gen(function* () {
      expect(yield* refusalOf("unlock", "closing", false)).toMatchObject({
        action: "unlock",
        reason: "state",
        state: "closing",
      });
    })
  );
});

describe("exams/sittings state: addMinutes", () => {
  it.effect(
    "moves the deadline of an attempt in progress before its deadline",
    () =>
      Effect.gen(function* () {
        expect(
          yield* decideProctorAction("addMinutes", "inProgress", true)
        ).toStrictEqual({
          deadline: "moved",
          state: "inProgress",
        });
      })
  );

  it.effect(
    "refuses added minutes on an attempt in progress after its deadline",
    () =>
      Effect.gen(function* () {
        expect(
          yield* refusalOf("addMinutes", "inProgress", false)
        ).toMatchObject({
          action: "addMinutes",
          reason: "deadline",
          state: "inProgress",
        });
      })
  );

  it.effect(
    "moves the deadline of a locked attempt before its deadline and keeps it locked",
    () =>
      Effect.gen(function* () {
        expect(
          yield* decideProctorAction("addMinutes", "locked", true)
        ).toStrictEqual({
          deadline: "moved",
          state: "locked",
        });
      })
  );

  it.effect(
    "refuses added minutes on a locked attempt after its deadline",
    () =>
      Effect.gen(function* () {
        expect(yield* refusalOf("addMinutes", "locked", false)).toMatchObject({
          action: "addMinutes",
          reason: "deadline",
          state: "locked",
        });
      })
  );

  it.effect("refuses added minutes on a closing attempt by its state", () =>
    Effect.gen(function* () {
      expect(yield* refusalOf("addMinutes", "closing", true)).toMatchObject({
        action: "addMinutes",
        reason: "state",
        state: "closing",
      });
    })
  );
});

describe("exams/sittings state: states the table does not decide", () => {
  it.effect(
    "refuses a proctor action on a submitted attempt by its state",
    () =>
      Effect.gen(function* () {
        expect(
          yield* Effect.flip(decideProctorAction("lock", "submitted", true))
        ).toMatchObject({
          _tag: "ProctorActionRefused",
          action: "lock",
          reason: "state",
          state: "submitted",
        });
      })
  );

  it.effect("refuses a proctor action on a ready attempt by its state", () =>
    Effect.gen(function* () {
      expect(
        yield* Effect.flip(decideProctorAction("close", "ready", true))
      ).toMatchObject({
        _tag: "ProctorActionRefused",
        action: "close",
        reason: "state",
        state: "ready",
      });
    })
  );
});

describe("exams/sittings state: close", () => {
  it.effect(
    "sets the deadline of an attempt in progress to now, so it closes",
    () =>
      Effect.gen(function* () {
        expect(
          yield* decideProctorAction("close", "inProgress", true)
        ).toStrictEqual({
          deadline: "now",
          state: "closing",
        });
      })
  );

  it.effect(
    "sets the deadline of a locked attempt to now and keeps it locked",
    () =>
      Effect.gen(function* () {
        expect(
          yield* decideProctorAction("close", "locked", true)
        ).toStrictEqual({
          deadline: "now",
          state: "locked",
        });
      })
  );

  it.effect("accepts a close on a closing attempt with no change", () =>
    Effect.gen(function* () {
      expect(
        yield* decideProctorAction("close", "closing", false)
      ).toStrictEqual({
        deadline: "kept",
        state: "closing",
      });
    })
  );
});
