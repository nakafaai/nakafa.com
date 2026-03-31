import {
  getScopedContent,
  getScopedContents,
  getScopedReferences,
} from "@repo/contents/_lib/scoped";
import {
  GitHubFetchError,
  InvalidPathError,
  MetadataParseError,
  ModuleLoadError,
} from "@repo/contents/_shared/error";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetMDXSlugsForLocale, mockKyGet, mockReadFile } = vi.hoisted(
  () => ({
    mockGetMDXSlugsForLocale: vi.fn(),
    mockKyGet: vi.fn(),
    mockReadFile: vi.fn(),
  })
);

vi.mock("@repo/contents/_lib/cache", () => ({
  getMDXSlugsForLocale: mockGetMDXSlugsForLocale,
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    promises: {
      ...actual.promises,
      readFile: mockReadFile,
    },
  };
});

vi.mock("ky", () => ({
  default: {
    get: mockKyGet,
  },
}));

const rawMetadataSource = `
export const metadata = {
  title: "Raw Title",
  description: "Raw Description",
  authors: [{ name: "Author" }],
  date: "01/01/2024"
};
`;

describe("scoped content helpers", () => {
  beforeEach(() => {
    mockGetMDXSlugsForLocale.mockReset();
    mockReadFile.mockReset();
    mockKyGet.mockReset();
    mockGetMDXSlugsForLocale.mockReturnValue([]);
    mockReadFile.mockResolvedValue(rawMetadataSource);
    mockKyGet.mockImplementation(() => {
      throw new Error("Unexpected GitHub fetch");
    });
  });

  it("loads raw metadata without calling the scoped importer", async () => {
    const importer = vi.fn(() =>
      Promise.reject(new Error("should not import"))
    );

    const result = await Effect.runPromise(
      getScopedContent(
        "articles",
        importer,
        "en",
        "articles/politics/test-article",
        {
          includeMDX: false,
        }
      )
    );

    expect(result.metadata.title).toBe("Raw Title");
    expect(importer).not.toHaveBeenCalled();
  });

  it("falls back to GitHub when the local raw content read fails", async () => {
    mockReadFile.mockRejectedValue(new Error("missing file"));
    mockKyGet.mockReturnValue({
      text: () => Promise.resolve(rawMetadataSource),
    });

    const result = await Effect.runPromise(
      getScopedContent(
        "subject",
        () => Promise.reject(new Error("should not import")),
        "en",
        "subject/high-school/10/mathematics/algebra/basic-concept",
        { includeMDX: false }
      )
    );

    expect(result.metadata.title).toBe("Raw Title");
    expect(mockKyGet).toHaveBeenCalledTimes(1);
  });

  it("fails with GitHubFetchError when both local and GitHub reads fail", async () => {
    mockReadFile.mockRejectedValue(new Error("missing file"));
    mockKyGet.mockImplementation(() => {
      throw new Error("network down");
    });

    const failure = await Effect.runPromise(
      Effect.flip(
        getScopedContent(
          "subject",
          () => Promise.reject(new Error("should not import")),
          "en",
          "subject/high-school/10/mathematics/algebra/basic-concept",
          { includeMDX: false }
        )
      )
    );

    expect(failure).toBeInstanceOf(GitHubFetchError);
  });

  it("fails when the file path does not belong to the scoped root", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        getScopedContent(
          "articles",
          () => Promise.reject(new Error("should not import")),
          "en",
          "subject/high-school/10/mathematics/algebra/basic-concept",
          { includeMDX: false }
        )
      )
    );

    expect(failure).toBeInstanceOf(InvalidPathError);
  });

  it("fails when a scoped file path attempts path traversal", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        getScopedContent(
          "articles",
          () => Promise.reject(new Error("should not import")),
          "en",
          "articles/../../secret",
          { includeMDX: false }
        )
      )
    );

    expect(failure).toBeInstanceOf(InvalidPathError);
  });

  it("fails metadata-only loads when the raw file has no metadata export", async () => {
    mockReadFile.mockResolvedValue("# No metadata here");

    const failure = await Effect.runPromise(
      Effect.flip(
        getScopedContent(
          "exercises",
          () => Promise.reject(new Error("should not import")),
          "en",
          "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/1/_question",
          { includeMDX: false }
        )
      )
    );

    expect(failure).toBeInstanceOf(MetadataParseError);
  });

  it("loads scoped MDX content with the provided importer", async () => {
    const importer = vi.fn(() =>
      Promise.resolve({
        metadata: {
          title: "Scoped Title",
          description: "Scoped Description",
          authors: [{ name: "Author" }],
          date: "01/01/2024",
        },
        default: () => "Scoped MDX",
      })
    );

    const result = await Effect.runPromise(
      getScopedContent(
        "articles",
        importer,
        "en",
        "articles/politics/test-article"
      )
    );

    expect(importer).toHaveBeenCalledWith("politics/test-article", "en");
    expect(result.metadata.title).toBe("Scoped Title");
    expect(result.default).toBeTruthy();
  });

  it("loads scoped content lists with the provided importer", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      "articles/politics/test-article",
      "articles/science/another-article",
    ]);

    const importer = vi.fn((relativePath: string) =>
      Promise.resolve({
        metadata: {
          title: relativePath,
          description: "Scoped Description",
          authors: [{ name: "Author" }],
          date: "01/01/2024",
        },
        default: () => "Scoped MDX",
      })
    );

    const result = await Effect.runPromise(
      getScopedContents("articles", importer, {
        basePath: "articles/politics",
        locale: "en",
      })
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe("articles/politics/test-article");
    expect(result[0]?.url).toBe(
      "https://nakafa.com/en/articles/politics/test-article"
    );
    expect(importer).toHaveBeenCalledWith("politics/test-article", "en");
  });

  it("omits scoped list entries that fail to load", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      "subject/high-school/10/math/algebra",
      "subject/high-school/10/math/geometry",
    ]);

    const importer = vi.fn((relativePath: string) => {
      if (relativePath === "high-school/10/math/geometry") {
        return Promise.reject(new Error("broken module"));
      }

      return Promise.resolve({
        metadata: {
          title: relativePath,
          description: "Scoped Description",
          authors: [{ name: "Author" }],
          date: "01/01/2024",
        },
        default: () => "Scoped MDX",
      });
    });

    const result = await Effect.runPromise(
      getScopedContents("subject", importer, {
        locale: "en",
      })
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe("subject/high-school/10/math/algebra");
  });

  it("uses the root as the default scoped list base path", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      "articles/politics/test-article",
      "subject/high-school/10/math/algebra",
    ]);

    const importer = vi.fn(() =>
      Promise.resolve({
        metadata: {
          title: "Scoped Title",
          description: "Scoped Description",
          authors: [{ name: "Author" }],
          date: "01/01/2024",
        },
        default: () => "Scoped MDX",
      })
    );

    const result = await Effect.runPromise(
      getScopedContents("articles", importer)
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe("articles/politics/test-article");
  });

  it("fails with ModuleLoadError when the scoped importer throws", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        getScopedContent(
          "articles",
          () => Promise.reject(new Error("boom")),
          "en",
          "articles/politics/test-article"
        )
      )
    );

    expect(failure).toBeInstanceOf(ModuleLoadError);
  });

  it("fails with MetadataParseError when the scoped MDX module metadata is invalid", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        getScopedContent(
          "articles",
          () =>
            Promise.resolve({
              metadata: { title: "Broken" },
              default: () => "Broken MDX",
            }),
          "en",
          "articles/politics/test-article"
        )
      )
    );

    expect(failure).toBeInstanceOf(MetadataParseError);
  });

  it("fails with MetadataParseError when the scoped MDX module has no metadata export", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        getScopedContent(
          "articles",
          () =>
            Promise.resolve({
              default: () => "Broken MDX",
            }),
          "en",
          "articles/politics/test-article"
        )
      )
    );

    expect(failure).toBeInstanceOf(MetadataParseError);
  });

  it("parses scoped references successfully", async () => {
    const result = await Effect.runPromise(
      getScopedReferences(
        "articles",
        () =>
          Promise.resolve({
            references: [
              {
                title: "Scoped Reference",
                authors: "Reference Author",
                year: 2024,
              },
            ],
          }),
        "articles/politics/test-article"
      )
    );

    expect(result).toStrictEqual([
      {
        title: "Scoped Reference",
        authors: "Reference Author",
        year: 2024,
      },
    ]);
  });

  it("returns an empty array when scoped references are invalid", async () => {
    const result = await Effect.runPromise(
      getScopedReferences(
        "articles",
        () =>
          Promise.resolve({
            references: [{ title: "Broken" }],
          }),
        "articles/politics/test-article"
      )
    );

    expect(result).toStrictEqual([]);
  });

  it("returns an empty array when scoped references have no array export", async () => {
    const result = await Effect.runPromise(
      getScopedReferences(
        "articles",
        () => Promise.resolve({ references: undefined }),
        "articles/politics/test-article"
      )
    );

    expect(result).toStrictEqual([]);
  });

  it("returns an empty array when scoped references are missing entirely", async () => {
    const result = await Effect.runPromise(
      getScopedReferences(
        "articles",
        () => Promise.resolve({}),
        "articles/politics/test-article"
      )
    );

    expect(result).toStrictEqual([]);
  });

  it("returns an empty array when loading scoped references throws", async () => {
    const result = await Effect.runPromise(
      getScopedReferences(
        "articles",
        () => Promise.reject(new Error("missing references")),
        "articles/politics/test-article"
      )
    );

    expect(result).toStrictEqual([]);
  });
});
