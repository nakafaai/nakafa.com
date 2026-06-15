import {
  extractReferences,
  getScopedContent,
  getScopedContents,
  getScopedReferences,
  parseModuleMetadata,
  parseReferences,
  validatePath,
} from "@repo/contents/_lib/scoped";
import {
  GitHubFetchError,
  InvalidPathError,
  MetadataParseError,
  ModuleLoadError,
  ReferenceParseError,
} from "@repo/contents/_shared/error";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetMDXSlugsForLocale,
  mockImportContentModule,
  mockFetchText,
  mockReadFile,
} = vi.hoisted(() => ({
  mockGetMDXSlugsForLocale: vi.fn(),
  mockImportContentModule: vi.fn(),
  mockFetchText: vi.fn(),
  mockReadFile: vi.fn(),
}));

vi.mock("@repo/contents/_lib/mdx-slugs/cache", () => ({
  getMdxSlugsForLocale: (locale: string) =>
    Effect.succeed(mockGetMDXSlugsForLocale(locale)),
}));

vi.mock("@repo/contents/_lib/io/content", async () => {
  const { Effect, Layer } = await import("effect");

  return {
    ContentIO: {
      Default: Layer.empty,
      fetchText: (url: string) =>
        Effect.tryPromise({
          catch: (cause) => cause,
          try: async () => await mockFetchText(url),
        }),
      readFileString: (filePath: string) =>
        Effect.tryPromise({
          catch: (cause) => cause,
          try: async () => await mockReadFile(filePath, "utf8"),
        }),
    },
  };
});

vi.mock("@repo/contents/_lib/module", () => ({
  importContentModule: mockImportContentModule,
}));

const rawMetadataSource = `
export const metadata = {
  title: "Raw Title",
  description: "Raw Description",
  authors: [{ name: "Author" }],
  date: "2024-01-01"
};
`;

describe("scoped content helpers", () => {
  beforeEach(() => {
    mockGetMDXSlugsForLocale.mockReset();
    mockImportContentModule.mockReset();
    mockReadFile.mockReset();
    mockFetchText.mockReset();
    mockGetMDXSlugsForLocale.mockReturnValue([]);
    mockImportContentModule.mockRejectedValue(new Error("Module not found"));
    mockReadFile.mockResolvedValue(rawMetadataSource);
    mockFetchText.mockImplementation(() => {
      throw new Error("Unexpected GitHub fetch");
    });
  });

  it("loads raw metadata without calling the scoped importer", async () => {
    const result = await Effect.runPromise(
      getScopedContent("articles", "en", "articles/politics/test-article", {
        includeMDX: false,
      })
    );

    expect(result.metadata.title).toBe("Raw Title");
    expect(mockImportContentModule).not.toHaveBeenCalled();
  });

  it("falls back to GitHub when the local raw content read fails", async () => {
    mockReadFile.mockRejectedValue(new Error("missing file"));
    mockFetchText.mockResolvedValue(rawMetadataSource);

    const result = await Effect.runPromise(
      getScopedContent(
        "subject",
        "en",
        "subject/high-school/10/mathematics/algebra/basic-concept",
        { includeMDX: false }
      )
    );

    expect(result.metadata.title).toBe("Raw Title");
    expect(mockFetchText).toHaveBeenCalledTimes(1);
  });

  it("fails with GitHubFetchError when both local and GitHub reads fail", async () => {
    mockReadFile.mockRejectedValue(new Error("missing file"));
    mockFetchText.mockImplementation(() => {
      throw new Error("network down");
    });

    const failure = await Effect.runPromise(
      Effect.flip(
        getScopedContent(
          "subject",
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
        getScopedContent("articles", "en", "articles/../../secret", {
          includeMDX: false,
        })
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
          "en",
          "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/1/_question",
          { includeMDX: false }
        )
      )
    );

    expect(failure).toBeInstanceOf(MetadataParseError);
  });

  it("loads scoped MDX content with the provided importer", async () => {
    mockImportContentModule.mockResolvedValue({
      metadata: {
        title: "Scoped Title",
        description: "Scoped Description",
        authors: [{ name: "Author" }],
        date: "2024-01-01",
      },
      default: () => "Scoped MDX",
    });

    const result = await Effect.runPromise(
      getScopedContent("articles", "en", "articles/politics/test-article")
    );

    expect(mockImportContentModule).toHaveBeenCalledWith(
      "articles/politics/test-article",
      "en"
    );
    expect(result.metadata.title).toBe("Scoped Title");
    expect(result.default).toBeTruthy();
  });

  it("loads scoped content lists with the provided importer", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      "articles/politics/test-article",
      "articles/science/another-article",
    ]);

    mockImportContentModule.mockImplementation((cleanPath: string) =>
      Promise.resolve({
        metadata: {
          title: cleanPath,
          description: "Scoped Description",
          authors: [{ name: "Author" }],
          date: "2024-01-01",
        },
        default: () => "Scoped MDX",
      })
    );

    const result = await Effect.runPromise(
      getScopedContents("articles", {
        basePath: "articles/politics",
        locale: "en",
      })
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe("articles/politics/test-article");
    expect(result[0]?.url).toBe(
      "https://nakafa.com/en/articles/politics/test-article"
    );
    expect(mockImportContentModule).toHaveBeenCalledWith(
      "articles/politics/test-article",
      "en"
    );
  });

  it("omits scoped list entries that fail to load", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      "subject/high-school/10/math/algebra",
      "subject/high-school/10/math/geometry",
    ]);

    mockImportContentModule.mockImplementation((cleanPath: string) => {
      if (cleanPath === "subject/high-school/10/math/geometry") {
        return Promise.reject(new Error("broken module"));
      }

      return Promise.resolve({
        metadata: {
          title: cleanPath,
          description: "Scoped Description",
          authors: [{ name: "Author" }],
          date: "2024-01-01",
        },
        default: () => "Scoped MDX",
      });
    });

    const result = await Effect.runPromise(
      getScopedContents("subject", {
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

    mockImportContentModule.mockResolvedValue({
      metadata: {
        title: "Scoped Title",
        description: "Scoped Description",
        authors: [{ name: "Author" }],
        date: "2024-01-01",
      },
      default: () => "Scoped MDX",
    });

    const result = await Effect.runPromise(getScopedContents("articles"));

    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe("articles/politics/test-article");
  });

  it("fails with ModuleLoadError when the scoped importer throws", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        getScopedContent("articles", "en", "articles/politics/test-article")
      )
    );

    expect(failure).toBeInstanceOf(ModuleLoadError);
  });

  it("fails with MetadataParseError when the scoped MDX module metadata is invalid", async () => {
    mockImportContentModule.mockResolvedValue({
      metadata: { title: "Broken" },
      default: () => "Broken MDX",
    });

    const failure = await Effect.runPromise(
      Effect.flip(
        getScopedContent("articles", "en", "articles/politics/test-article")
      )
    );

    expect(failure).toBeInstanceOf(MetadataParseError);
  });

  it("fails with MetadataParseError when the scoped MDX module has no metadata export", async () => {
    mockImportContentModule.mockResolvedValue({
      default: () => "Broken MDX",
    });

    const failure = await Effect.runPromise(
      Effect.flip(
        getScopedContent("articles", "en", "articles/politics/test-article")
      )
    );

    expect(failure).toBeInstanceOf(MetadataParseError);
  });

  it("parses scoped references successfully", async () => {
    const importReferencesModule = vi.fn(() =>
      Effect.succeed({
        references: [
          {
            title: "Scoped Reference",
            authors: "Reference Author",
            year: 2024,
          },
        ],
      })
    );

    const result = await Effect.runPromise(
      getScopedReferences(
        "articles",
        importReferencesModule,
        "articles/politics/test-article"
      )
    );

    expect(importReferencesModule).toHaveBeenCalledWith(
      "politics/test-article"
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
          Effect.succeed({
            references: [{ title: "Broken" }],
          }),
        "articles/politics/test-article"
      )
    );

    expect(result).toStrictEqual([]);
  });

  it("returns an empty array when scoped references use the wrong root", async () => {
    const importReferencesModule = vi.fn(() => Effect.succeed({}));
    const result = await Effect.runPromise(
      getScopedReferences(
        "articles",
        importReferencesModule,
        "subject/high-school/10/mathematics"
      )
    );

    expect(result).toStrictEqual([]);
    expect(importReferencesModule).not.toHaveBeenCalled();
  });

  it("returns an empty array when scoped references have no array export", async () => {
    const result = await Effect.runPromise(
      getScopedReferences(
        "articles",
        () => Effect.succeed({ references: undefined }),
        "articles/politics/test-article"
      )
    );

    expect(result).toStrictEqual([]);
  });

  it("returns an empty array when scoped references are missing entirely", async () => {
    const result = await Effect.runPromise(
      getScopedReferences(
        "articles",
        () => Effect.succeed({}),
        "articles/politics/test-article"
      )
    );

    expect(result).toStrictEqual([]);
  });

  it("returns an empty array when loading scoped references throws", async () => {
    const result = await Effect.runPromise(
      getScopedReferences(
        "articles",
        () =>
          Effect.fail(
            new ModuleLoadError({
              cause: new Error("missing references"),
              message: "Unable to import test references.",
              path: "@repo/contents/articles/politics/test-article/ref.ts",
            })
          ),
        "articles/politics/test-article"
      )
    );

    expect(result).toStrictEqual([]);
  });
});

describe("scoped exported primitives", () => {
  it("validates safe content-relative paths and rejects traversal", async () => {
    const validPath = await Effect.runPromise(
      validatePath("articles/politics/test-article/en.mdx", "/content/root")
    );
    const failure = await Effect.runPromise(
      Effect.flip(validatePath("../secret", "/content/root"))
    );

    expect(validPath).toBe(
      "/content/root/articles/politics/test-article/en.mdx"
    );
    expect(failure).toBeInstanceOf(InvalidPathError);
  });

  it("parses imported module metadata with optional fields", async () => {
    const result = await Effect.runPromise(
      parseModuleMetadata({
        metadata: {
          title: "Imported Article",
          description: "Imported Description",
          authors: [{ name: "Author" }],
          date: "2024-01-01",
          subject: "Politics",
        },
      })
    );

    expect(result).toStrictEqual({
      title: "Imported Article",
      description: "Imported Description",
      authors: [{ name: "Author" }],
      date: "2024-01-01",
      subject: "Politics",
    });
  });

  it("fails imported module metadata with a tagged metadata error", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        parseModuleMetadata(
          {
            metadata: {
              title: "Broken",
            },
          },
          "@repo/contents/articles/politics/broken/en.mdx"
        )
      )
    );

    expect(failure).toBeInstanceOf(MetadataParseError);
    expect(failure).toMatchObject({
      path: "@repo/contents/articles/politics/broken/en.mdx",
    });
  });

  it("extracts reference arrays and ignores missing or malformed exports", () => {
    expect(
      extractReferences({
        references: [{ title: "Reference", authors: "Author", year: 2024 }],
      })
    ).toStrictEqual([{ title: "Reference", authors: "Author", year: 2024 }]);
    expect(extractReferences({ references: "not an array" })).toStrictEqual([]);
    expect(extractReferences(null)).toStrictEqual([]);
  });

  it("parses valid references and fails invalid reference payloads", async () => {
    const valid = await Effect.runPromise(
      parseReferences([
        {
          title: "Reference",
          authors: "Author",
          year: 2024,
        },
      ])
    );
    const failure = await Effect.runPromise(
      Effect.flip(parseReferences([{ title: "Missing author and year" }]))
    );

    expect(valid).toStrictEqual([
      {
        title: "Reference",
        authors: "Author",
        year: 2024,
      },
    ]);
    expect(failure).toBeInstanceOf(ReferenceParseError);
  });
});
