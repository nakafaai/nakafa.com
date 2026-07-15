import {
  BrowserSidebarCookieWriterLive,
  persistSidebarState,
  SIDEBAR_COOKIE_MAX_AGE,
  SidebarCookieWriter,
  SidebarStatePersistenceError,
} from "@repo/design-system/lib/sidebar/persistence";
import { Effect, Layer } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const TEST_COOKIE_NAME = "sidebar-state-test";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sidebar state persistence", () => {
  it("serializes the exact state cookie through its writer service", () => {
    let persistedCookie = "";
    const recordingWriter = Layer.succeed(SidebarCookieWriter, {
      write: (cookie) =>
        Effect.sync(() => {
          persistedCookie = cookie;
        }),
    });

    Effect.runSync(
      persistSidebarState({
        cookieName: TEST_COOKIE_NAME,
        open: true,
      }).pipe(Effect.provide(recordingWriter))
    );

    expect(persistedCookie).toBe(
      `${TEST_COOKIE_NAME}=true; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
    );
  });

  it("writes sidebar state through the browser layer", () => {
    Effect.runSync(
      persistSidebarState({
        cookieName: TEST_COOKIE_NAME,
        open: true,
      }).pipe(Effect.provide(BrowserSidebarCookieWriterLive))
    );

    expect(document.cookie).toContain(`${TEST_COOKIE_NAME}=true`);
  });

  it("exposes browser write failures through the typed error channel", () => {
    const cause = new Error("Cookies are disabled.");
    vi.stubGlobal("document", {
      set cookie(_cookie: string) {
        throw cause;
      },
    });

    const error = Effect.runSync(
      persistSidebarState({
        cookieName: TEST_COOKIE_NAME,
        open: false,
      }).pipe(Effect.provide(BrowserSidebarCookieWriterLive), Effect.flip)
    );

    expect(error).toBeInstanceOf(SidebarStatePersistenceError);
    expect(error).toMatchObject({
      _tag: "SidebarStatePersistenceError",
      cause,
      cookieName: TEST_COOKIE_NAME,
      message: `Failed to persist sidebar state in ${TEST_COOKIE_NAME}.`,
    });
  });
});
