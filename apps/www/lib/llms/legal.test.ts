// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLlmsLegalPageText } from "@/lib/llms/legal";

const mockReadFile = vi.hoisted(() => vi.fn());

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  mockReadFile.mockImplementation(actual.readFile);

  return {
    ...actual,
    readFile: mockReadFile,
  };
});

describe("legal llms markdown", () => {
  beforeEach(() => {
    mockReadFile.mockClear();
  });

  it("reads legal markdown from the MDX source file", async () => {
    const text = await Effect.runPromise(
      getLlmsLegalPageText({
        cleanSlug: "terms-of-service",
        locale: "en",
      })
    );

    expect(text).toContain("# Terms of Service");
    expect(text).toContain("Last updated:");
  });

  it("returns null when the route has no legal MDX source", async () => {
    await expect(
      Effect.runPromise(
        getLlmsLegalPageText({
          cleanSlug: "search",
          locale: "en",
        })
      )
    ).resolves.toBeNull();

    expect(mockReadFile).toHaveBeenCalledWith(
      expect.stringContaining(
        "app/[locale]/(app)/(shared)/(site)/(legal)/search/en.mdx"
      ),
      "utf8"
    );
  });

  it("rejects nested or hidden source paths before reading", async () => {
    const slugs = ["privacy-policy/extra", "../privacy-policy", ".env"];

    for (const cleanSlug of slugs) {
      await expect(
        Effect.runPromise(
          getLlmsLegalPageText({
            cleanSlug,
            locale: "en",
          })
        )
      ).resolves.toBeNull();
    }

    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it("returns null when a declared legal source file is missing", async () => {
    const error = Object.assign(new Error("missing"), { code: "ENOENT" });
    mockReadFile.mockRejectedValueOnce(error);

    await expect(
      Effect.runPromise(
        getLlmsLegalPageText({
          cleanSlug: "terms-of-service",
          locale: "en",
        })
      )
    ).resolves.toBeNull();
  });

  it("surfaces unexpected legal source read failures", async () => {
    const failures = [
      Object.assign(new Error("denied"), { code: "EACCES" }),
      new Error("unknown"),
      Object.assign(new Error("unknown code"), { code: 1 }),
      "read failed",
    ];

    for (const failure of failures) {
      mockReadFile.mockRejectedValueOnce(failure);

      await expect(
        Effect.runPromise(
          getLlmsLegalPageText({
            cleanSlug: "terms-of-service",
            locale: "en",
          })
        )
      ).rejects.toHaveProperty(
        "name",
        "(FiberFailure) LegalMarkdownReadFailed"
      );
    }
  });
});
