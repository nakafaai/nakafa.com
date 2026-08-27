import { afterEach, describe, expect, it, vi } from "@effect/vitest";
import {
  BrowserSidebarCookieWriterLive,
  persistSidebarState,
  SidebarCookieWriter,
  SidebarStatePersistenceError,
} from "@repo/design-system/lib/sidebar/persistence";
import { Effect, Layer } from "effect";

const TEST_COOKIE_NAME = "sidebar-state-test";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sidebar state persistence", () => {
  it.live("serializes the exact state cookie through its writer service", () =>
    Effect.gen(function* () {
      let persistedCookie = "";
      const recordingWriter = Layer.succeed(SidebarCookieWriter, {
        write: (cookie) =>
          Effect.sync(() => {
            persistedCookie = cookie;
          }),
      });

      yield* persistSidebarState({
        cookieName: TEST_COOKIE_NAME,
        open: true,
      }).pipe(Effect.provide(recordingWriter));

      expect(persistedCookie).toBe(
        `${TEST_COOKIE_NAME}=true; path=/; max-age=604800`
      );
    })
  );

  it.live("writes sidebar state through the browser layer", () =>
    Effect.gen(function* () {
      yield* persistSidebarState({
        cookieName: TEST_COOKIE_NAME,
        open: true,
      }).pipe(Effect.provide(BrowserSidebarCookieWriterLive));

      expect(document.cookie).toContain(`${TEST_COOKIE_NAME}=true`);
    })
  );

  it.live(
    "exposes browser write failures through the typed error channel",
    () =>
      Effect.gen(function* () {
        const cause = new Error("Cookies are disabled.");
        vi.stubGlobal("document", {
          set cookie(_cookie: string) {
            throw cause;
          },
        });

        const error = yield* persistSidebarState({
          cookieName: TEST_COOKIE_NAME,
          open: false,
        }).pipe(Effect.provide(BrowserSidebarCookieWriterLive), Effect.flip);

        expect(error).toBeInstanceOf(SidebarStatePersistenceError);
        expect(error).toMatchObject({
          _tag: "SidebarStatePersistenceError",
          cause,
          cookieName: TEST_COOKIE_NAME,
          message: `Failed to persist sidebar state in ${TEST_COOKIE_NAME}.`,
        });
      })
  );
});
