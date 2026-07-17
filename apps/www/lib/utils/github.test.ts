// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getGithubUrl, getRawGithubUrl } from "@/lib/utils/github";

describe("GitHub URL utilities", () => {
  it("builds a repository URL with the default branch", () => {
    expect(getGithubUrl({ path: "/docs/index.md" })).toBe(
      "https://github.com/nakafaai/nakafa.com/tree/main/docs/index.md"
    );
  });

  it("normalizes a path and accepts a custom ref", () => {
    expect(getGithubUrl({ path: "docs/index.md", ref: "/tree/v1.0.0" })).toBe(
      "https://github.com/nakafaai/nakafa.com/tree/v1.0.0/docs/index.md"
    );
  });

  it("builds a raw-content URL", () => {
    expect(getRawGithubUrl("docs/index.md")).toBe(
      "https://raw.githubusercontent.com/nakafaai/nakafa.com/refs/heads/main/docs/index.md"
    );
  });
});
