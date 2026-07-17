// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLocale,
  getMaterialContextHint,
  getPathname,
} from "@/lib/utils/browser";

describe("browser utilities", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      location: { pathname: "", search: "" },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads a supported locale from the first path segment", () => {
    window.location.pathname = "/id/materi/matematika";

    expect(getLocale()).toBe("id");
  });

  it("falls back when the path has no supported locale", () => {
    window.location.pathname = "/de/articles";

    expect(getLocale()).toBe("en");
  });

  it("removes the locale prefix from a nested pathname", () => {
    window.location.pathname = "/en/articles/education";

    expect(getPathname()).toBe("/articles/education");
  });

  it("returns root for a locale-only pathname", () => {
    window.location.pathname = "/en";

    expect(getPathname()).toBe("/");
  });

  it("preserves a pathname without a locale prefix", () => {
    window.location.pathname = "/articles/education";

    expect(getPathname()).toBe("/articles/education");
  });

  it("returns root for an empty pathname", () => {
    expect(getPathname()).toBe("/");
  });

  it("reads the material context hint", () => {
    window.location.search = "?ctx=program.node";

    expect(getMaterialContextHint()).toBe("program.node");
  });

  it("returns undefined without a material context hint", () => {
    window.location.search = "?other=value";

    expect(getMaterialContextHint()).toBeUndefined();
  });
});
