import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber, MutableRef } from "effect";
import { putLibraryFile } from "@/components/tenant/classes/library/send";

/** The last request the fake XMLHttpRequest made, so a test answers it. */
const latest = MutableRef.make<FakeRequest | null>(null);

/** An XMLHttpRequest that records what it is asked and answers when the test says so. */
class FakeRequest {
  readonly headers: Record<string, string> = {};
  readonly listeners: Record<string, () => void> = {};
  readonly uploadListeners: Record<string, (event: ProgressEvent) => void> = {};
  readonly upload = {
    addEventListener: (
      type: string,
      listener: (event: ProgressEvent) => void
    ) => {
      this.uploadListeners[type] = listener;
    },
  };
  aborted = false;
  body: unknown = null;
  method = "";
  status = 0;
  url = "";

  constructor() {
    MutableRef.set(latest, this);
  }

  abort() {
    this.aborted = true;
  }

  addEventListener(type: string, listener: () => void) {
    this.listeners[type] = listener;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  send(body: unknown) {
    this.body = body;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
}

vi.stubGlobal("XMLHttpRequest", FakeRequest);

/** A PDF the teacher picked. */
const file = new File(["%PDF-1.7"], "modul.pdf", { type: "application/pdf" });

describe("putLibraryFile", () => {
  it.effect(
    "puts the file with its type, reports progress, and fails on a refusal or a dropped connection",
    () =>
      Effect.gen(function* () {
        const progress = vi.fn();
        const sent = yield* Effect.forkChild(
          putLibraryFile("https://r2.test/a", file, progress)
        );
        yield* Effect.yieldNow;
        const request = MutableRef.get(latest);
        request?.uploadListeners.progress?.(
          new ProgressEvent("progress", {
            lengthComputable: true,
            loaded: 4,
            total: 8,
          })
        );
        request?.uploadListeners.progress?.(new ProgressEvent("progress"));
        if (request !== null) {
          request.status = 200;
          request.listeners.load?.();
        }
        yield* Fiber.join(sent);
        expect(request).toMatchObject({
          body: file,
          headers: { "content-type": "application/pdf" },
          method: "PUT",
          url: "https://r2.test/a",
        });
        expect(progress.mock.calls).toEqual([[0.5]]);

        const refused = yield* Effect.forkChild(
          putLibraryFile("https://r2.test/b", file, progress)
        );
        yield* Effect.yieldNow;
        const second = MutableRef.get(latest);
        if (second !== null) {
          second.status = 403;
          second.listeners.load?.();
        }
        expect(yield* Fiber.join(refused).pipe(Effect.flip)).toMatchObject({
          _tag: "UploadFailed",
          status: 403,
        });

        const dropped = yield* Effect.forkChild(
          putLibraryFile("https://r2.test/c", file, progress)
        );
        yield* Effect.yieldNow;
        MutableRef.get(latest)?.listeners.error?.();
        expect(yield* Fiber.join(dropped).pipe(Effect.flip)).toMatchObject({
          _tag: "UploadFailed",
          status: 0,
        });

        const stopped = yield* Effect.forkChild(
          putLibraryFile("https://r2.test/d", file, progress)
        );
        yield* Effect.yieldNow;
        yield* Fiber.interrupt(stopped);
        expect(MutableRef.get(latest)?.aborted).toBe(true);
      })
  );
});
