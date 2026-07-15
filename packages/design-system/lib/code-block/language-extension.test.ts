import { getCodeFileExtension } from "@repo/design-system/lib/code-block/language-extension";
import { describe, expect, it } from "vitest";

describe("getCodeFileExtension", () => {
  it("uses text for missing and unsupported languages", () => {
    expect(getCodeFileExtension(undefined)).toBe("txt");
    expect(getCodeFileExtension("not-a-language")).toBe("txt");
  });

  it.each([
    ["typescript", "ts"],
    ["blade", "blade.php"],
    ["codeowners", "CODEOWNERS"],
    ["文言", "wy"],
  ])("maps %s to %s", (language, extension) => {
    expect(getCodeFileExtension(language)).toBe(extension);
  });

  it("uses a canonical language identifier when it is already an extension", () => {
    expect(getCodeFileExtension("css")).toBe("css");
  });
});
