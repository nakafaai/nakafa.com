import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import {
  entersBySelf,
  roomEntryOf,
  roomJoinAddress,
} from "@/components/exams/sitting/join";
import { keepRoomCode, takeRoomCode } from "@/components/exams/sitting/scan";

describe("roomJoinAddress", () => {
  it("opens the sitting on the proctor's school host, with the token after the hash", () => {
    expect(
      roomJoinAddress("https://harapan.nakafa.com", "w17dbtag", "X26U2H")
    ).toBe("https://harapan.nakafa.com/sittings/w17dbtag#X26U2H");
  });

  it("keeps the port of a local school host", () => {
    expect(
      roomJoinAddress("http://acc-1.localhost:3000", "w17dbtag", "X26U2H")
    ).toBe("http://acc-1.localhost:3000/sittings/w17dbtag#X26U2H");
  });
});

describe("roomEntryOf", () => {
  const deviceKey = "nakafa-sitting-device:w17dbtag";
  const deviceId = "0f8c2d4e-3a6b-4c1d-9e7f-5b2a1c3d4e5f";

  it.effect(
    "enters with the device this browser keeps, and spends a kept code",
    () =>
      Effect.gen(function* () {
        window.localStorage.setItem(deviceKey, deviceId);
        yield* keepRoomCode("/sittings/w17dbtag", "#X26U2H");
        try {
          expect(yield* roomEntryOf("w17dbtag", "#X26U2H")).toEqual(
            Option.some("")
          );
          expect(yield* takeRoomCode("w17dbtag")).toEqual(Option.none());
        } finally {
          window.localStorage.removeItem(deviceKey);
        }
      })
  );

  it.effect("enters with the code after the hash before the kept one", () =>
    Effect.gen(function* () {
      yield* keepRoomCode("/sittings/w17dbtag", "#OLD234");

      expect(yield* roomEntryOf("w17dbtag", "#x26u2h")).toEqual(
        Option.some("X26U2H")
      );
      expect(yield* takeRoomCode("w17dbtag")).toEqual(Option.none());
    })
  );

  it.effect("enters with the code kept across the sign-in", () =>
    Effect.gen(function* () {
      yield* keepRoomCode("/sittings/w17dbtag", "#X26U2H");

      expect(yield* roomEntryOf("w17dbtag", "")).toEqual(Option.some("X26U2H"));
    })
  );

  it.effect(
    "leaves the student to type the token when nothing was scanned",
    () =>
      Effect.gen(function* () {
        expect(yield* roomEntryOf("w17dbtag", "")).toEqual(Option.none());
      })
  );
});

describe("entersBySelf", () => {
  it("enters once the sitting has opened, with no attempt or an active one", () => {
    expect(entersBySelf({ attempt: null, sitting: { state: "open" } })).toBe(
      true
    );
    expect(
      entersBySelf({ attempt: { state: "locked" }, sitting: { state: "open" } })
    ).toBe(true);
  });

  it("waits while the sitting is scheduled, and leaves a finished attempt to its results", () => {
    expect(
      entersBySelf({ attempt: null, sitting: { state: "scheduled" } })
    ).toBe(false);
    expect(
      entersBySelf({
        attempt: { state: "submitted" },
        sitting: { state: "closed" },
      })
    ).toBe(false);
  });
});
