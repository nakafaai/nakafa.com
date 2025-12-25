import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLocale, getPathname } from "../browser";

describe("getLocale", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      location: { pathname: "" },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 'en' for English locale path", () => {
    window.location.pathname = "/en/docs";
    expect(getLocale()).toBe("en");
  });

  it("returns 'id' for Indonesian locale path", () => {
    window.location.pathname = "/id/dokumen";
    expect(getLocale()).toBe("id");
  });

  it("returns default locale for root path", () => {
    window.location.pathname = "/";
    expect(getLocale()).toBe("en");
  });

  it("returns default locale for path without locale prefix", () => {
    window.location.pathname = "/docs/getting-started";
    expect(getLocale()).toBe("en");
  });

  it("returns default locale for invalid locale prefix", () => {
    window.location.pathname = "/fr/docs";
    expect(getLocale()).toBe("en");
  });

  it("handles nested paths with locale", () => {
    window.location.pathname = "/en/packages/app/components/Button";
    expect(getLocale()).toBe("en");
  });

  it("handles empty pathname", () => {
    window.location.pathname = "";
    expect(getLocale()).toBe("en");
  });
});

describe("getPathname", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      location: { pathname: "" },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns pathname without locale prefix for English", () => {
    window.location.pathname = "/en/docs/getting-started";
    expect(getPathname()).toBe("/docs/getting-started");
  });

  it("returns pathname without locale prefix for Indonesian", () => {
    window.location.pathname = "/id/dokumen/panduan";
    expect(getPathname()).toBe("/dokumen/panduan");
  });

  it("returns root slash for locale-only path", () => {
    window.location.pathname = "/en";
    expect(getPathname()).toBe("/");
  });

  it("returns root slash for root path", () => {
    window.location.pathname = "/";
    expect(getPathname()).toBe("/");
  });

  it("returns full pathname when no locale prefix exists", () => {
    window.location.pathname = "/docs/getting-started";
    expect(getPathname()).toBe("/docs/getting-started");
  });

  it("handles nested paths with locale", () => {
    window.location.pathname = "/en/packages/app/components/Button";
    expect(getPathname()).toBe("/packages/app/components/Button");
  });

  it("handles empty pathname", () => {
    window.location.pathname = "";
    expect(getPathname()).toBe("/");
  });

  it("handles paths with multiple segments", () => {
    window.location.pathname = "/en/blog/2024/12/24/release-notes";
    expect(getPathname()).toBe("/blog/2024/12/24/release-notes");
  });
});
