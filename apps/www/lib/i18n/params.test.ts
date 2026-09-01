// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { getActiveLocaleOrThrow, getLocaleOrThrow } from "@/lib/i18n/params";

const hasPreviewConfigMock = vi.hoisted(() => vi.fn(() => false));

vi.mock("@/lib/content/preview/config", () => ({
  hasPreviewConfig: hasPreviewConfigMock,
}));

vi.mock("@repo/internationalization/src/routing", () => ({
  routing: { locales: ["en", "id"] },
}));

describe("getLocaleOrThrow", () => {
  beforeEach(() => {
    hasPreviewConfigMock.mockReset();
    hasPreviewConfigMock.mockReturnValue(false);
  });

  it("returns active locales and rejects inactive public locales", () => {
    expect(getLocaleOrThrow("en")).toBe("en");
    expect(getActiveLocaleOrThrow("id")).toBe("id");
    expect(() => getActiveLocaleOrThrow("de")).toThrow();
    expect(() => getLocaleOrThrow("de")).toThrow();
  });

  it("admits a staged contract locale only for authenticated preview", () => {
    hasPreviewConfigMock.mockReturnValue(true);

    expect(getLocaleOrThrow("de")).toBe("de");
  });

  it("rejects a locale outside the contract with or without preview", () => {
    expect(() => getLocaleOrThrow("fr")).toThrow();
    hasPreviewConfigMock.mockReturnValue(true);

    expect(() => getLocaleOrThrow("fr")).toThrow();
  });
});
