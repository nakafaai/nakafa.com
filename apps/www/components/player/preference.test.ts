// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  PLAYER_MODE_COOKIE,
  PLAYER_MODE_MAX_AGE,
} from "@/components/player/mode";
import { savePlayerMode } from "@/components/player/preference";

const headers = vi.hoisted(() => ({ cookies: vi.fn(), set: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: headers.cookies }));

describe("savePlayerMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headers.cookies.mockResolvedValue({ set: headers.set });
  });

  it("remembers the chosen view for a year, for the server only", async () => {
    await savePlayerMode("single");

    expect(headers.set).toHaveBeenCalledExactlyOnceWith(
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

  it("refuses a view that arrived from the network and is not one", async () => {
    await expect(savePlayerMode("grid")).rejects.toThrow();

    expect(headers.set).not.toHaveBeenCalled();
  });

  it("fails when the request has no cookies to write", async () => {
    headers.cookies.mockRejectedValue(new Error("outside a request"));

    await expect(savePlayerMode("list")).rejects.toThrow();
  });
});
