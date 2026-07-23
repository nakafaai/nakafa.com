import { describe, expect, it } from "vitest";
import {
  isLocaleBypassPath,
  isUnsupportedRootFilePath,
} from "@/lib/routing/bypass";

describe("routing bypass", () => {
  it.each([
    "/mcp",
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
    expect(isUnsupportedRootFilePath(`/missing.${extension}`)).toBe(true);
  });

  it("keeps supported and nested assets outside the root rejection", () => {
    expect(isUnsupportedRootFilePath("/missing.png")).toBe(false);
    expect(isUnsupportedRootFilePath("/models/car.svg")).toBe(false);
  });
});
