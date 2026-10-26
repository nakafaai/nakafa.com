// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { readNotFoundPageHandler } from "@/lib/routing/not-found.server";

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeaders: vi.fn(),
}));

describe("standalone not-found page server function", () => {
  it("reads the locale and the host that the request names", () => {
    vi.mocked(getRequestHeaders).mockReturnValue(
      new Headers({ host: "harapan.nakafa.com", "x-nakafa-locale": "id" })
    );

    expect(readNotFoundPageHandler()).toStrictEqual({
      locale: "id",
      school: true,
    });
  });
});
