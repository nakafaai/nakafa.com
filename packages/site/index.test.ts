import { describe, expect, it } from "@effect/vitest";
import {
  createLoopbackConnectSources,
  createSecurityHeaders,
} from "@repo/site";
import { Array as Arr, Option } from "effect";

/** Matches the origin that serves Google's Picker script, inside the script sources. */
const PICKER_SCRIPT_SOURCE = /script-src [^;]*https:\/\/apis\.google\.com/u;

/** Matches the origin of the frame Google's Picker opens, inside the frame sources. */
const PICKER_FRAME_SOURCE = /frame-src [^;]*https:\/\/docs\.google\.com/u;

describe("createLoopbackConnectSources", () => {
  it("allows the exact HTTP and WebSocket origins for local Convex", () => {
    expect(
      createLoopbackConnectSources(new URL("http://127.0.0.1:3210/api/query"))
    ).toEqual(["http://127.0.0.1:3210", "ws://127.0.0.1:3210"]);
    expect(
      createLoopbackConnectSources(new URL("http://localhost:3210"))
    ).toEqual(["http://localhost:3210", "ws://localhost:3210"]);
  });

  it("does not widen remote or secure Convex origins", () => {
    expect(
      createLoopbackConnectSources(
        new URL("https://dapper-antelope-269.convex.cloud")
      )
    ).toEqual([]);
    expect(
      createLoopbackConnectSources(new URL("http://example.com:3210"))
    ).toEqual([]);
  });
});

describe("createSecurityHeaders", () => {
  it("builds the default CSP header", () => {
    const csp = Option.getOrUndefined(
      Arr.findFirst(
        createSecurityHeaders(),
        (header) => header.key === "Content-Security-Policy"
      )
    );

    expect(csp?.value).toContain("script-src 'self'");
    expect(csp?.value).toContain("connect-src 'self'");
    expect(csp?.value).not.toContain("https://raw.githubusercontent.com");
    expect(csp?.value).toContain("media-src 'self'");
    expect(csp?.value).not.toContain("posthog.com");
  });

  it("lets Google's Picker load its script and open its frame", () => {
    const csp = Option.getOrUndefined(
      Arr.findFirst(
        createSecurityHeaders(),
        (header) => header.key === "Content-Security-Policy"
      )
    );

    expect(csp?.value).toMatch(PICKER_SCRIPT_SOURCE);
    expect(csp?.value).toMatch(PICKER_FRAME_SOURCE);
  });

  it("adds app-owned connect sources without widening shared apps", () => {
    const csp = Option.getOrUndefined(
      Arr.findFirst(
        createSecurityHeaders({
          additionalConnectSources: ["https://raw.githubusercontent.com"],
        }),
        (header) => header.key === "Content-Security-Policy"
      )
    );

    expect(csp?.value).toContain(
      "connect-src 'self' wss://*.convex.cloud https://*.convex.cloud"
    );
    expect(csp?.value).toContain("https://raw.githubusercontent.com");
  });

  it("allows local storage images only for the app's selected loopback origin", () => {
    const sources = createLoopbackConnectSources(
      new URL("http://127.0.0.1:3212")
    );
    const csp = Option.getOrUndefined(
      Arr.findFirst(
        createSecurityHeaders({
          additionalImageSources: Arr.filter(sources, (source) =>
            source.startsWith("http:")
          ),
        }),
        (header) => header.key === "Content-Security-Policy"
      )
    );

    expect(csp?.value).toContain(
      "img-src 'self' blob: data: https: https://*.googleusercontent.com http://127.0.0.1:3212;"
    );
    expect(csp?.value).not.toContain("ws://127.0.0.1:3212");
    expect(createSecurityHeaders()[0]?.value).not.toContain("127.0.0.1");
  });
});
