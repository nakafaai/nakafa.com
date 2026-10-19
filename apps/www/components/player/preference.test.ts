// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  PLAYER_MODE_COOKIE,
  PLAYER_MODE_MAX_AGE,
} from "@/components/player/mode";
import { savePlayerModeHandler } from "@/components/player/preference";

const cookies = vi.hoisted(() => ({ setCookie: vi.fn() }));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.com/"),
  setCookie: cookies.setCookie,
}));

describe("savePlayerModeHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("remembers the chosen view for a year, for the server only", async () => {
    await savePlayerModeHandler({ data: "single" });

    expect(cookies.setCookie).toHaveBeenCalledExactlyOnceWith(
      PLAYER_MODE_COOKIE,
      "single",
      {
        httpOnly: true,
        maxAge: PLAYER_MODE_MAX_AGE,
        path: "/",
        sameSite: "lax",
      }
    );
  });

  it("fails when the request has no cookies to write", async () => {
    cookies.setCookie.mockImplementation(() => {
      throw new Error("outside a request");
    });

    await expect(savePlayerModeHandler({ data: "list" })).rejects.toThrow();
  });
});
