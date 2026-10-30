import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import {
  keepRoomCode,
  RoomCodeStorageFailed,
  scannedToken,
  takeRoomCode,
} from "@/components/exams/sitting/scan";

describe("scannedToken", () => {
  it("reads the token after the hash of a scanned room address", () => {
    expect(scannedToken("#X26U2H")).toEqual(Option.some("X26U2H"));
  });

  it("reads it as the student would type it, in upper case without spaces", () => {
    expect(scannedToken("#x26 u2h ")).toEqual(Option.some("X26U2H"));
  });

  it("reads no token from an address without one", () => {
    expect(scannedToken("")).toEqual(Option.none());
    expect(scannedToken("#")).toEqual(Option.none());
  });
});

/** A session store that keeps its values in one record, as a browser tab does. */
function sessionStore() {
  const values: Record<string, string> = {};
  return {
    getItem: (key: string) => values[key] ?? null,
    removeItem: (key: string) => {
      delete values[key];
    },
    setItem: (key: string, value: string) => {
      values[key] = value;
    },
  };
}

/** A session store that refuses every call, as a private window does. */
function refusingStore() {
  const denied = () => {
    throw new Error("denied");
  };
  return { getItem: denied, removeItem: denied, setItem: denied };
}

describe("keepRoomCode and takeRoomCode", () => {
  it.effect(
    "keep the code scanned for a sitting until its page takes it, once",
    () =>
      Effect.gen(function* () {
        const store = sessionStore();
        yield* keepRoomCode("/sittings/w17dbtag", "#x26u2h", store);

        expect(yield* takeRoomCode("w17dbtag", store)).toEqual(
          Option.some("X26U2H")
        );
        expect(yield* takeRoomCode("w17dbtag", store)).toEqual(Option.none());
      })
  );

  it.effect(
    "keep nothing for an address that names no sitting or carries no code",
    () =>
      Effect.gen(function* () {
        const store = sessionStore();
        yield* keepRoomCode("/exams", "#X26U2H", store);
        yield* keepRoomCode("/sittings/w17dbtag/results", "#X26U2H", store);
        yield* keepRoomCode("/sittings/w17dbtag", "", store);

        expect(yield* takeRoomCode("w17dbtag", store)).toEqual(Option.none());
      })
  );

  it.effect(
    "take no code, and fail to keep one, when the browser refuses its storage",
    () =>
      Effect.gen(function* () {
        const failure = yield* keepRoomCode(
          "/sittings/w17dbtag",
          "#X26U2H",
          refusingStore()
        ).pipe(Effect.flip);

        expect(failure).toBeInstanceOf(RoomCodeStorageFailed);
        expect(yield* takeRoomCode("w17dbtag", refusingStore())).toEqual(
          Option.none()
        );
      })
  );

  it.effect("use the tab's own session storage by default", () =>
    Effect.gen(function* () {
      yield* keepRoomCode("/sittings/w17dbtag", "#X26U2H");

      expect(window.sessionStorage.getItem("nakafa-room-code:w17dbtag")).toBe(
        "X26U2H"
      );
      expect(yield* takeRoomCode("w17dbtag")).toEqual(Option.some("X26U2H"));
      expect(window.sessionStorage.getItem("nakafa-room-code:w17dbtag")).toBe(
        null
      );
    })
  );

  it.effect("take no code when the tab cannot open its storage", () =>
    Effect.gen(function* () {
      const spy = vi
        .spyOn(window, "sessionStorage", "get")
        .mockImplementation(() => {
          throw new Error("denied");
        });
      try {
        expect(yield* takeRoomCode("w17dbtag")).toEqual(Option.none());
      } finally {
        spy.mockRestore();
      }
    })
  );
});
