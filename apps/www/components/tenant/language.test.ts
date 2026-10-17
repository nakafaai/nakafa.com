// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { saveSchoolLanguage } from "@/components/tenant/language";

const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60;

const headers = vi.hoisted(() => ({ cookies: vi.fn(), set: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: headers.cookies }));

describe("saveSchoolLanguage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headers.cookies.mockResolvedValue({ set: headers.set });
  });

  it("writes the language under the cookie name that next-intl reads on school hosts", async () => {
    await saveSchoolLanguage("de");

    expect(headers.set).toHaveBeenCalledExactlyOnceWith("NEXT_LOCALE", "de", {
      maxAge: ONE_YEAR_IN_SECONDS,
      path: "/",
      sameSite: "lax",
    });
  });

  it("refuses a language that no school host renders and writes nothing", async () => {
    await expect(saveSchoolLanguage("fr")).rejects.toThrow();

    expect(headers.set).not.toHaveBeenCalled();
  });

  it("fails when the request has no cookies to write", async () => {
    headers.cookies.mockRejectedValue(new Error("outside a request"));

    await expect(saveSchoolLanguage("id")).rejects.toThrow();
  });
});
