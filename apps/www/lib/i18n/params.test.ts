// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getActiveLocaleOrThrow, getLocaleOrThrow } from "@/lib/i18n/params";

const hasPreviewConfigMock = vi.hoisted(() => vi.fn(() => false));

vi.mock("@/lib/content/preview/config", () => ({
  hasPreviewConfig: hasPreviewConfigMock,
}));

describe("getLocaleOrThrow", () => {
  beforeEach(() => {
    hasPreviewConfigMock.mockReset();
    hasPreviewConfigMock.mockReturnValue(false);
  });

  it("returns a configured locale", () => {
    expect(getLocaleOrThrow("en")).toBe("en");
    expect(getActiveLocaleOrThrow("id")).toBe("id");
  });

  it("rejects an inactive locale without an exact local preview", () => {
    expect(() => getLocaleOrThrow("de")).toThrow();
  });

  it("accepts a contract locale only inside an exact local preview", () => {
    hasPreviewConfigMock.mockReturnValue(true);

    expect(getLocaleOrThrow("de")).toBe("de");
    expect(() => getActiveLocaleOrThrow("de")).toThrow();
    expect(() => getLocaleOrThrow("fr")).toThrow();
  });
});
