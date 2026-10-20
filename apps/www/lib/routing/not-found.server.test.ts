// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { readNotFoundLocaleHandler } from "@/lib/routing/not-found.server";

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeaders: vi.fn(),
}));

describe("standalone not-found locale server function", () => {
  it("reads the locale that the request names in its header", () => {
    vi.mocked(getRequestHeaders).mockReturnValue(
      new Headers({ "x-nakafa-locale": "id" })
    );

    expect(readNotFoundLocaleHandler()).toBe("id");
  });
});
