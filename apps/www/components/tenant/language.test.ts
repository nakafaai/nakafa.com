// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { LOCALE_COOKIE } from "@repo/internationalization/src/locale";
import { saveSchoolLanguageHandler } from "@/components/tenant/language";

const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60;

const cookies = vi.hoisted(() => ({ setCookie: vi.fn() }));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.com/"),
  setCookie: cookies.setCookie,
}));

describe("saveSchoolLanguageHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes the language under the locale cookie that the requests read", async () => {
    await saveSchoolLanguageHandler({ data: "de" });

    expect(cookies.setCookie).toHaveBeenCalledExactlyOnceWith(
      LOCALE_COOKIE,
      "de",
      {
        maxAge: ONE_YEAR_IN_SECONDS,
        path: "/",
        sameSite: "lax",
      }
    );
  });

  it("fails when the request has no cookies to write", async () => {
    cookies.setCookie.mockImplementation(() => {
      throw new Error("outside a request");
    });

    await expect(saveSchoolLanguageHandler({ data: "id" })).rejects.toThrow();
  });
});
