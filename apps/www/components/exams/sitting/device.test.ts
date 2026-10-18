import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import {
  readSittingDevice,
  rememberSittingDevice,
  SittingDeviceStorageFailed,
} from "@/components/exams/sitting/device";

const deviceId = "0f8c2d4e-3a6b-4c1d-9e7f-5b2a1c3d4e5f";
const sittingId = "sitting-a";

/** A browser store that keeps one value for each read and records each write. */
function storageWith(value: string | null) {
  return {
    getItem: vi.fn<(key: string) => string | null>(() => value),
    setItem: vi.fn<(key: string, value: string) => void>(),
  };
}

/** A browser store that refuses every call, as a private window does. */
function refusingStorage() {
  return {
    getItem: vi.fn<(key: string) => string | null>(() => {
      throw new Error("denied");
    }),
    setItem: vi.fn<(key: string, value: string) => void>(() => {
      throw new Error("denied");
    }),
  };
}

describe("readSittingDevice", () => {
  it.effect("reads the device that the browser keeps for the sitting", () =>
    Effect.gen(function* () {
      const storage = storageWith(deviceId);

      const found = yield* readSittingDevice(sittingId, storage);

      expect(Option.isSome(found)).toBe(true);
      expect(storage.getItem).toHaveBeenCalledWith(
        `nakafa-sitting-device:${sittingId}`
      );
    })
  );

  it.effect("reads none when the browser keeps no device for the sitting", () =>
    Effect.gen(function* () {
      const found = yield* readSittingDevice(sittingId, storageWith(null));

      expect(Option.isNone(found)).toBe(true);
    })
  );

  it.effect("reads none for a stored value that is not a device", () =>
    Effect.gen(function* () {
      const found = yield* readSittingDevice(
        sittingId,
        storageWith("not-a-device")
      );

      expect(Option.isNone(found)).toBe(true);
    })
  );

  it.effect("reads none when the browser refuses its storage", () =>
    Effect.gen(function* () {
      const found = yield* readSittingDevice(sittingId, refusingStorage());

      expect(Option.isNone(found)).toBe(true);
    })
  );
});

describe("the browser's own storage", () => {
  it.effect("reads the device that the browser keeps for the sitting", () =>
    Effect.gen(function* () {
      const key = `nakafa-sitting-device:${sittingId}`;
      window.localStorage.setItem(key, deviceId);

      const found = yield* readSittingDevice(sittingId);
      window.localStorage.removeItem(key);

      expect(Option.getOrUndefined(found)).toBe(deviceId);
    })
  );

  it.effect("keeps the device in the browser's storage under its sitting", () =>
    Effect.gen(function* () {
      const key = `nakafa-sitting-device:${sittingId}`;

      yield* rememberSittingDevice(sittingId, deviceId);
      const kept = window.localStorage.getItem(key);
      window.localStorage.removeItem(key);

      expect(kept).toBe(deviceId);
    })
  );

  it.effect(
    "reads no device and keeps none when the browser refuses to open its storage",
    () =>
      Effect.gen(function* () {
        const spy = vi
          .spyOn(window, "localStorage", "get")
          .mockImplementation(() => {
            throw new Error("denied");
          });
        try {
          const found = yield* readSittingDevice(sittingId);
          const failure = yield* rememberSittingDevice(
            sittingId,
            deviceId
          ).pipe(Effect.flip);

          expect(Option.isNone(found)).toBe(true);
          expect(failure).toBeInstanceOf(SittingDeviceStorageFailed);
        } finally {
          spy.mockRestore();
        }
      })
  );
});

describe("rememberSittingDevice", () => {
  it.effect("keeps the device under the key of its sitting", () =>
    Effect.gen(function* () {
      const storage = storageWith(null);

      yield* rememberSittingDevice(sittingId, deviceId, storage);

      expect(storage.setItem).toHaveBeenCalledWith(
        `nakafa-sitting-device:${sittingId}`,
        deviceId
      );
    })
  );

  it.effect(
    "fails with a tagged error when the browser refuses to keep it",
    () =>
      Effect.gen(function* () {
        const exit = yield* rememberSittingDevice(
          sittingId,
          deviceId,
          refusingStorage()
        ).pipe(Effect.flip);

        expect(exit).toBeInstanceOf(SittingDeviceStorageFailed);
      })
  );
});
