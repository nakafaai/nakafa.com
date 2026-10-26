import { afterEach, describe, expect, it } from "@effect/vitest";
import { LIBRARY_ACCEPT } from "@repo/backend/confect/classroom/library/item";
import { Effect, Fiber, Option } from "effect";
import { pickDriveFile } from "@/components/tenant/classes/library/drive";

const SCRIPT = 'script[src="https://apis.google.com/js/api.js"]';

const keys = { accessToken: "access", apiKey: "key", appId: "972685787969" };

const picked = { id: "file-1", mimeType: "application/pdf", name: "Modul.pdf" };

/** What the Picker double hands the page: its last callback, and its last built Picker. */
const shown = {
  answer: vi.fn<(answer: unknown) => void>(),
  dispose: vi.fn(),
  setVisible: vi.fn<(visible: boolean) => void>(),
};

/** A Drive view double that records the types it offers. */
class DocsView {
  readonly setMimeTypes = vi.fn((_types: string) => this);
}

/** A Picker builder double that records each setting and keeps the callback. */
class PickerBuilder {
  static readonly last: PickerBuilder[] = [];
  readonly addView = vi.fn((_view: DocsView) => this);
  readonly build = vi.fn(() => ({
    dispose: shown.dispose,
    setVisible: shown.setVisible,
  }));
  readonly setAppId = vi.fn((_appId: string) => this);
  readonly setCallback = vi.fn((callback: (answer: unknown) => void) => {
    shown.answer.mockImplementation(callback);
    return this;
  });
  readonly setDeveloperKey = vi.fn((_key: string) => this);
  readonly setLocale = vi.fn((_locale: string) => this);
  readonly setOAuthToken = vi.fn((_token: string) => this);

  constructor() {
    PickerBuilder.last.push(this);
  }
}

/** Google's loader and Picker as its script defines them on the page. */
const installGoogle = ({ picker = true } = {}) => {
  window.gapi = { load: (_library, loaded) => loaded() };
  if (picker) {
    window.google = {
      picker: { DocsView, PickerBuilder, ViewId: { DOCS: "all" } },
    };
  }
};

/** Waits until the effect under test added Google's script, and answers it. */
const appendedScript = Effect.gen(function* () {
  let script = document.head.querySelector(SCRIPT);
  while (script === null) {
    yield* Effect.yieldNow;
    script = document.head.querySelector(SCRIPT);
  }
  return script;
});

/** Waits until the Picker shows. */
const pickerShown = Effect.gen(function* () {
  while (shown.setVisible.mock.calls.length === 0) {
    yield* Effect.yieldNow;
  }
});

describe("pickDriveFile", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "gapi");
    Reflect.deleteProperty(window, "google");
    document.head.querySelector(SCRIPT)?.remove();
    PickerBuilder.last.length = 0;
    shown.answer.mockReset();
    shown.dispose.mockReset();
    shown.setVisible.mockReset();
  });

  it.effect(
    "loads Google's script once, shows the Picker with the teacher's keys, and answers the picked file or none on a cancel",
    () =>
      Effect.gen(function* () {
        const first = yield* Effect.forkChild(pickDriveFile(keys, "id"));
        const script = yield* appendedScript;
        installGoogle();
        script.dispatchEvent(new Event("load"));
        yield* pickerShown;
        shown.answer({ action: "loaded" });
        shown.answer({ docs: "unreadable" });
        shown.answer({ action: "picked", docs: [picked] });
        expect(yield* Fiber.join(first)).toEqual(Option.some(picked));
        const builder = PickerBuilder.last[0];
        expect(builder?.setAppId).toHaveBeenCalledWith("972685787969");
        expect(builder?.setDeveloperKey).toHaveBeenCalledWith("key");
        expect(builder?.setOAuthToken).toHaveBeenCalledWith("access");
        expect(builder?.setLocale).toHaveBeenCalledWith("id");
        expect(
          builder?.addView.mock.calls[0]?.[0].setMimeTypes
        ).toHaveBeenCalledWith(LIBRARY_ACCEPT);
        expect(shown.setVisible).toHaveBeenCalledWith(true);

        shown.setVisible.mockReset();
        const second = yield* Effect.forkChild(pickDriveFile(keys, "en"));
        yield* pickerShown;
        shown.answer({ action: "cancel" });
        expect(yield* Fiber.join(second)).toEqual(Option.none());
        shown.setVisible.mockReset();
        const empty = yield* Effect.forkChild(pickDriveFile(keys, "en"));
        yield* pickerShown;
        shown.answer({ action: "picked" });
        expect(yield* Fiber.join(empty)).toEqual(Option.none());
        expect(document.head.querySelectorAll(SCRIPT)).toHaveLength(1);
      })
  );

  it.effect("closes the Picker when the page stops waiting for it", () =>
    Effect.gen(function* () {
      installGoogle();
      const waiting = yield* Effect.forkChild(pickDriveFile(keys, "id"));
      yield* pickerShown;
      yield* Fiber.interrupt(waiting);
      expect(shown.dispose).toHaveBeenCalledTimes(1);
    })
  );

  it.effect(
    "fails when Google's script does not load, or loads without its loader or its Picker",
    () =>
      Effect.gen(function* () {
        const failed = yield* Effect.forkChild(pickDriveFile(keys, "id"));
        (yield* appendedScript).dispatchEvent(new Event("error"));
        expect((yield* Fiber.join(failed).pipe(Effect.flip))._tag).toBe(
          "PickerUnavailable"
        );
        expect(document.head.querySelector(SCRIPT)).toBeNull();
        const bare = yield* Effect.forkChild(pickDriveFile(keys, "id"));
        (yield* appendedScript).dispatchEvent(new Event("load"));
        expect((yield* Fiber.join(bare).pipe(Effect.flip))._tag).toBe(
          "PickerUnavailable"
        );
        installGoogle({ picker: false });
        expect((yield* pickDriveFile(keys, "id").pipe(Effect.flip))._tag).toBe(
          "PickerUnavailable"
        );
      })
  );
});
