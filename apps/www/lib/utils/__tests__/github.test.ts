import { describe, expect, it } from "vitest";
import { getGithubUrl, getRawGithubUrl } from "../github";

describe("getGithubUrl", () => {
  it("returns GitHub URL with default ref", () => {
    const result = getGithubUrl({ path: "/docs/index.md" });
    expect(result).toBe(
      "https://github.com/nakafaai/nakafa.com/tree/main/docs/index.md"
    );
  });

  it("handles path without leading slash", () => {
    const result = getGithubUrl({ path: "docs/index.md" });
    expect(result).toBe(
      "https://github.com/nakafaai/nakafa.com/tree/maindocs/index.md"
    );
  });

  it("returns GitHub URL with custom ref", () => {
    const result = getGithubUrl({
      path: "/docs/index.md",
      ref: "/tree/v1.0.0",
    });
    expect(result).toBe(
      "https://github.com/nakafaai/nakafa.com/tree/v1.0.0/docs/index.md"
    );
  });

  it("handles nested paths", () => {
    const result = getGithubUrl({
      path: "/packages/app/components/Button.tsx",
    });
    expect(result).toBe(
      "https://github.com/nakafaai/nakafa.com/tree/main/packages/app/components/Button.tsx"
    );
  });

  it("handles root path", () => {
    const result = getGithubUrl({ path: "/" });
    expect(result).toBe("https://github.com/nakafaai/nakafa.com/tree/main/");
  });

  it("handles empty ref", () => {
    const result = getGithubUrl({ path: "/docs/index.md", ref: "" });
    expect(result).toBe("https://github.com/nakafaai/nakafa.com/docs/index.md");
  });
});

describe("getRawGithubUrl", () => {
  it("returns raw GitHub URL for path with leading slash", () => {
    const result = getRawGithubUrl("/docs/index.md");
    expect(result).toBe(
      "https://raw.githubusercontent.com/nakafaai/nakafa.com/refs/heads/main/docs/index.md"
    );
  });

  it("handles path without leading slash", () => {
    const result = getRawGithubUrl("docs/index.md");
    expect(result).toBe(
      "https://raw.githubusercontent.com/nakafaai/nakafa.com/refs/heads/main/docs/index.md"
    );
  });

  it("handles nested paths", () => {
    const result = getRawGithubUrl("/packages/app/components/Button.tsx");
    expect(result).toBe(
      "https://raw.githubusercontent.com/nakafaai/nakafa.com/refs/heads/main/packages/app/components/Button.tsx"
    );
  });

  it("handles root path", () => {
    const result = getRawGithubUrl("/");
    expect(result).toBe(
      "https://raw.githubusercontent.com/nakafaai/nakafa.com/refs/heads/main/"
    );
  });

  it("handles paths with multiple slashes", () => {
    const result = getRawGithubUrl("//double/slash");
    expect(result).toBe(
      "https://raw.githubusercontent.com/nakafaai/nakafa.com/refs/heads/main//double/slash"
    );
  });

  it("handles paths with special characters", () => {
    const result = getRawGithubUrl("/docs/2024-12-24-release-notes.md");
    expect(result).toBe(
      "https://raw.githubusercontent.com/nakafaai/nakafa.com/refs/heads/main/docs/2024-12-24-release-notes.md"
    );
  });
});
