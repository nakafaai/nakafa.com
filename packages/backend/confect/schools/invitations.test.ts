import { afterEach, describe, expect, it } from "@effect/vitest";
import { generateInviteCode } from "@repo/backend/confect/schools/invitations";
import { Effect } from "effect";

const INVITE_CODE = /^[A-Za-z0-9_-]{10}$/;

/** Eight bytes 0 to 7 encode to the ten symbols AAECAwQFBg. */
const SEQUENTIAL_BYTES = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);

/** Replaces the runtime's random source, so the code a test expects is a literal. */
function fixedRandomBytes(bytes: Uint8Array) {
  return vi
    .spyOn(globalThis.crypto, "getRandomValues")
    .mockImplementation((array) => {
      if (!(array instanceof Uint8Array)) {
        throw new Error("Expected a byte array.");
      }
      array.set(bytes);
      return array;
    });
}

describe("generateInviteCode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.effect("generates ten URL-safe symbols", () =>
    Effect.gen(function* () {
      const code = yield* generateInviteCode();

      expect(code).toMatch(INVITE_CODE);
    })
  );

  it.effect("encodes the first sixty random bits as ten symbols", () =>
    Effect.gen(function* () {
      fixedRandomBytes(SEQUENTIAL_BYTES);

      const code = yield* generateInviteCode();

      expect(code).toBe("AAECAwQFBg");
    })
  );

  it.effect("maps the first and last alphabet symbols", () =>
    Effect.gen(function* () {
      fixedRandomBytes(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]));
      const lowest = yield* generateInviteCode();
      fixedRandomBytes(
        new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255])
      );
      const highest = yield* generateInviteCode();

      expect(lowest).toBe("AAAAAAAAAA");
      expect(highest).toBe("__________");
    })
  );

  it.effect("generates a different code on each call", () =>
    Effect.gen(function* () {
      const first = yield* generateInviteCode();
      const second = yield* generateInviteCode();

      expect(second).not.toBe(first);
    })
  );

  it.effect("dies when the runtime's random source fails", () =>
    Effect.gen(function* () {
      const failure = new Error("Random source unavailable.");
      vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation(() => {
        throw failure;
      });

      const defect = yield* generateInviteCode().pipe(
        Effect.catchDefect((cause) => Effect.succeed(cause))
      );

      expect(defect).toBe(failure);
    })
  );
});
