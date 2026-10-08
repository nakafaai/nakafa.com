import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Option, Schema } from "effect";
import {
  ContentViewDeviceStorageFailed,
  clearContentViewDevice,
  ensureContentViewDevice,
  isContentViewDeviceRetained,
  readContentViewIdentity,
  resolveContentViewAttribution,
} from "@/lib/content/views/device";

const DEVICE_KEY = "nakafa-device-id";
const CREATED_DEVICE_PATTERN = /^\d+-[\w-]{9}$/;
/** Writes the JSON text earlier releases stored, including values the device contract rejects. */
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const unavailableStorage = {
  getItem: () => {
    throw new Error("storage unavailable");
  },
  removeItem: () => {
    throw new Error("storage unavailable");
  },
  setItem: () => {
    throw new Error("storage unavailable");
  },
};

describe("content-view device attribution", () => {
  it("waits while analytics consent is still resolving", () => {
    for (const isAuthenticated of [false, true]) {
      expect(
        resolveContentViewAttribution({ isAuthenticated, status: "pending" })
      ).toBe("pending");
    }
  });

  it("counts a granted view per device, with the account when signed in", () => {
    expect(
      resolveContentViewAttribution({
        isAuthenticated: false,
        status: "granted",
      })
    ).toBe("device");
    expect(
      resolveContentViewAttribution({
        isAuthenticated: true,
        status: "granted",
      })
    ).toBe("accountDevice");
  });

  it("counts an ungranted view for the account and never for the device", () => {
    for (const status of ["browser-signal", "denied", "prompt"] as const) {
      expect(
        resolveContentViewAttribution({ isAuthenticated: true, status })
      ).toBe("account");
      expect(
        resolveContentViewAttribution({ isAuthenticated: false, status })
      ).toBe("none");
    }
  });

  it("retains the identifier only while consent is granted or unresolved", () => {
    expect(isContentViewDeviceRetained("granted")).toBe(true);
    expect(isContentViewDeviceRetained("pending")).toBe(true);
    for (const status of ["browser-signal", "denied", "prompt"] as const) {
      expect(isContentViewDeviceRetained(status)).toBe(false);
    }
  });
});

describe("content-view device storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it.effect("creates and stores one identifier on first use", () =>
    Effect.gen(function* () {
      const created = yield* ensureContentViewDevice();
      const reused = yield* ensureContentViewDevice();

      expect(created).toMatch(CREATED_DEVICE_PATTERN);
      expect(reused).toBe(created);
      expect(window.localStorage.getItem(DEVICE_KEY)).toBe(encodeJson(created));
    })
  );

  it.effect("keeps an identifier stored by an earlier release", () =>
    Effect.gen(function* () {
      window.localStorage.setItem(DEVICE_KEY, encodeJson("legacy-device"));

      const deviceId = yield* ensureContentViewDevice();

      expect(deviceId).toBe("legacy-device");
    })
  );

  it.effect("replaces an empty or malformed stored value", () =>
    Effect.gen(function* () {
      for (const stored of [encodeJson(""), "not-json"]) {
        window.localStorage.setItem(DEVICE_KEY, stored);

        const deviceId = yield* ensureContentViewDevice();

        expect(deviceId).toMatch(CREATED_DEVICE_PATTERN);
        expect(window.localStorage.getItem(DEVICE_KEY)).toBe(
          encodeJson(deviceId)
        );
      }
    })
  );

  it.effect("records an ungranted account view without touching storage", () =>
    Effect.gen(function* () {
      const pending = yield* readContentViewIdentity("pending");
      const none = yield* readContentViewIdentity("none");
      const account = yield* readContentViewIdentity("account");

      expect(Option.isNone(pending)).toBe(true);
      expect(Option.isNone(none)).toBe(true);
      expect(Option.getOrThrow(account)).toEqual({});
      expect(window.localStorage.getItem(DEVICE_KEY)).toBeNull();
    })
  );

  it.effect("records a granted view with this browser's identifier", () =>
    Effect.gen(function* () {
      const device = yield* readContentViewIdentity("device");
      const accountDevice = yield* readContentViewIdentity("accountDevice");

      expect(Option.getOrThrow(device)).toEqual(
        Option.getOrThrow(accountDevice)
      );
      expect(window.localStorage.getItem(DEVICE_KEY)).toBe(
        encodeJson(Option.getOrThrow(device).deviceId)
      );
    })
  );

  it.effect(
    "records a granted view without an identifier storage cannot keep",
    () =>
      Effect.gen(function* () {
        const device = yield* readContentViewIdentity(
          "device",
          unavailableStorage
        );
        const accountDevice = yield* readContentViewIdentity(
          "accountDevice",
          unavailableStorage
        );

        expect(Option.isNone(device)).toBe(true);
        expect(Option.getOrThrow(accountDevice)).toEqual({});
      })
  );

  it.effect("removes the stored identifier", () =>
    Effect.gen(function* () {
      yield* ensureContentViewDevice();

      yield* clearContentViewDevice();

      expect(window.localStorage.getItem(DEVICE_KEY)).toBeNull();
    })
  );

  it.effect("fails with a typed error when storage is unavailable", () =>
    Effect.gen(function* () {
      const fullStorage = {
        getItem: () => null,
        removeItem: () => undefined,
        setItem: () => {
          throw new Error("quota exceeded");
        },
      };

      const readFailure = yield* ensureContentViewDevice(
        unavailableStorage
      ).pipe(Effect.flip);
      const writeFailure = yield* ensureContentViewDevice(fullStorage).pipe(
        Effect.flip
      );
      const removeFailure = yield* clearContentViewDevice(
        unavailableStorage
      ).pipe(Effect.flip);

      expect(readFailure).toBeInstanceOf(ContentViewDeviceStorageFailed);
      expect(writeFailure).toBeInstanceOf(ContentViewDeviceStorageFailed);
      expect(removeFailure).toBeInstanceOf(ContentViewDeviceStorageFailed);
    })
  );
});
