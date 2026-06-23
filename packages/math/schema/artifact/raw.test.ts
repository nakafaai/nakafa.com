import {
  ArtifactSafetyReadError,
  readRawJsonByteCount,
} from "@repo/math/schema/artifact/raw";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

describe("artifact raw traversal", () => {
  it("counts primitive JSON values and ignores non-JSON symbols", async () => {
    await expectRawBytes(null, 4);
    await expectRawBytes("x", 3);
    await expectRawBytes(7, 1);
    await expectRawBytes(Symbol("skip"), undefined);
  });

  it("counts strings and skips undefined object fields without invoking JSON hooks", async () => {
    const bytes = await Effect.runPromise(
      readRawJsonByteCount({ keep: "x", skip: undefined }, new WeakSet(), {
        arrayItems: 4,
        bytes: 100,
      })
    );

    expect(bytes).toBeGreaterThan(0);
  });

  it("stops array traversal once the byte budget is exceeded", async () => {
    const bytes = await Effect.runPromise(
      readRawJsonByteCount(["large", "large"], new WeakSet(), {
        arrayItems: 4,
        bytes: 10,
      })
    );

    expect(bytes).toBeGreaterThan(10);
  });

  it("stops array traversal when the raw array limit is exceeded", async () => {
    const bytes = await Effect.runPromise(
      readRawJsonByteCount([1, 2], new WeakSet(), { arrayItems: 1, bytes: 100 })
    );

    expect(bytes).toBe(101);
  });

  it("maps invalid raw array lengths into the typed safety error", async () => {
    const raw = new Proxy([], {
      get(target, property, receiver) {
        return property === "length"
          ? "invalid"
          : Reflect.get(target, property, receiver);
      },
    });
    const exit = await Effect.runPromiseExit(
      readRawJsonByteCount(raw, new WeakSet(), { arrayItems: 4, bytes: 100 })
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(exit.cause.toString()).toContain(ArtifactSafetyReadError.name);
    }
  });

  it("maps throwing own-key reads into the typed safety error", async () => {
    const raw = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("blocked");
        },
      }
    );
    const exit = await Effect.runPromiseExit(
      readRawJsonByteCount(raw, new WeakSet(), { arrayItems: 4, bytes: 100 })
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(exit.cause.toString()).toContain(ArtifactSafetyReadError.name);
    }
  });
});

/** Reads raw bytes for one primitive traversal fixture. */
async function expectRawBytes(input: unknown, expected: number | undefined) {
  await expect(
    Effect.runPromise(
      readRawJsonByteCount(input, new WeakSet(), { arrayItems: 4, bytes: 100 })
    )
  ).resolves.toBe(expected);
}
