import { describe, expect, it } from "@effect/vitest";
import {
  isLocaleBypassPath,
  isUnsupportedSystemPath,
} from "@/lib/routing/bypass";

describe("routing bypass", () => {
  it.each([
    "/llms.txt",
    "/logo.svg",
    "/manifest.webmanifest",
    "/robots.txt",
    "/rss.xml",
    "/sitemap.txt",
    "/sitemap.xml",
    "/skill.md",
    "/e22d548f7fd2482a9022e3b84e944901.txt",
    "/.well-known/llms.txt",
    "/.well-known/agent-skills/index.json",
    "/.well-known/agent-skills/nakafa/SKILL.md",
  ])("recognizes the exact public system path %s", (pathname) => {
    expect(isLocaleBypassPath(pathname)).toBe(true);
  });

  it("does not bypass ordinary localized or unknown system paths", () => {
    expect(isLocaleBypassPath("/en/search")).toBe(false);
    expect(isLocaleBypassPath("/.well-known/unknown")).toBe(false);
  });

  it.each([
    "svg",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "glb",
    "gltf",
    "bin",
    "ktx2",
    "hdr",
    "exr",
    "js",
    "css",
    "xml",
    "webmanifest",
    "txt",
  ])("recognizes unsupported root .%s files", (extension) => {
    expect(isUnsupportedSystemPath(`/missing.${extension}`)).toBe(true);
  });

  it("keeps supported and nested assets outside the root rejection", () => {
    expect(isUnsupportedSystemPath("/missing.png")).toBe(false);
    expect(isUnsupportedSystemPath("/models/car.svg")).toBe(false);
  });

  it("rejects unknown well-known resources without intercepting published discovery", () => {
    expect(
      isUnsupportedSystemPath(
        "/.well-known/appspecific/com.chrome.devtools.json"
      )
    ).toBe(true);
    expect(isUnsupportedSystemPath("/.well-known/unknown")).toBe(true);
    expect(
      isUnsupportedSystemPath("/.well-known/agent-skills/index.json")
    ).toBe(false);
    expect(isUnsupportedSystemPath("/robots.txt")).toBe(false);
  });
});
