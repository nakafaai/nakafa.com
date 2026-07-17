import { formatCodeBlockData } from "@repo/contents/_types/llms/code";
import { describe, expect, it } from "vitest";

describe("CodeBlock data formatting", () => {
  it("ignores missing and blank code", () => {
    expect(formatCodeBlockData("")).toBe("");
    expect(formatCodeBlockData("code: `   `")).toBe("");
  });

  it("formats optional metadata and nested code fences", () => {
    const data = [
      'language: "markdown",',
      'filename: "README.md",',
      "code: `# Example",
      "\\`\\`\\`ts",
      "const ready = true;",
      "\\`\\`\\``",
    ].join("\n");

    expect(formatCodeBlockData(data)).toBe(
      "File: README.md\n```markdown\n# Example\n``\\`ts\nconst ready = true;\n``\\`\n```"
    );
  });

  it("formats code without filename or language metadata", () => {
    expect(formatCodeBlockData("code: `const ready = true;`")).toBe(
      "```\nconst ready = true;\n```"
    );
  });
});
