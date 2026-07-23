// @vitest-environment node
import { GitCommitShaSchema } from "@nakafa/aksara-contracts/ids";
import { describe, expect, it } from "vitest";
import {
  getAksaraUrl,
  getGithubUrl,
  getRawAksaraUrl,
  getRawGithubUrl,
} from "@/lib/utils/github";

const revision = GitCommitShaSchema.make("a".repeat(40));

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

  it("builds immutable Aksara browser and raw URLs", () => {
    expect(
      getAksaraUrl({ path: "packages/corpus/test/en.mdx", revision })
    ).toBe(
      `https://github.com/nakafaai/aksara/blob/${revision}/packages/corpus/test/en.mdx`
    );
    expect(
      getRawAksaraUrl({
        path: "/packages/corpus/test/en.mdx",
        revision,
      })
    ).toBe(
      `https://raw.githubusercontent.com/nakafaai/aksara/${revision}/packages/corpus/test/en.mdx`
    );
  });
});
