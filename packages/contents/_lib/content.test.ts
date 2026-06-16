import { getContent, getContents } from "@repo/contents/_lib/content";
import {
  GitHubFetchError,
  InvalidPathError,
  MetadataParseError,
  ModuleLoadError,
} from "@repo/contents/_shared/error";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockFetchText,
  mockGetMDXSlugsForLocale,
  mockImportContentModule,
  mockReadFile,
} = vi.hoisted(() => ({
  mockFetchText: vi.fn(),
  mockGetMDXSlugsForLocale: vi.fn(),
  mockImportContentModule: vi.fn(),
  mockReadFile: vi.fn(),
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

vi.mock("@repo/contents/_lib/mdx-slugs/cache", () => ({
  getMdxSlugsForLocale: (locale: string) =>
    Effect.succeed(mockGetMDXSlugsForLocale(locale)),
}));

vi.mock("@repo/contents/_lib/module", () => ({
  getLocalizedContentPath: (cleanPath: string, locale: string) => {
    if (cleanPath.endsWith("/answer") || cleanPath.endsWith("/question")) {
      return `${cleanPath}.${locale}.mdx`;
    }

    return `${cleanPath}/${locale}.mdx`;
  },
  importContentModule: mockImportContentModule,
}));

const rawMetadataSource = `
export const metadata = {
  title: "Raw Title",
  description: "Raw Description",
  authors: [{ name: "Raw Author" }],
  date: "2024-01-01"
};

# Raw Content
`;

const moduleContent = {
  metadata: {
    title: "Module Title",
    description: "Module Description",
    authors: [{ name: "Module Author" }],
    date: "2024-01-01",
  },
  default: () => "Module MDX",
};

beforeEach(() => {
  mockFetchText.mockRejectedValue(new Error("Network error"));
  mockGetMDXSlugsForLocale.mockReturnValue([]);
  mockImportContentModule.mockResolvedValue(moduleContent);
  mockReadFile.mockResolvedValue(rawMetadataSource);
});

afterEach(() => {
  vi.clearAllMocks();
  mockFetchText.mockReset();
  mockGetMDXSlugsForLocale.mockReset();
  mockImportContentModule.mockReset();
  mockReadFile.mockReset();
});

describe("getContent", () => {
  it("loads raw metadata without importing MDX when includeMDX is false", async () => {
    const result = await Effect.runPromise(
      getContent("en", "articles/politics/test-article", {
        includeMDX: false,
      })
    );

    expect(result).toStrictEqual({
      metadata: {
        title: "Raw Title",
        description: "Raw Description",
        authors: [{ name: "Raw Author" }],
        date: "2024-01-01",
      },
      raw: rawMetadataSource,
    });
    expect(mockImportContentModule).not.toHaveBeenCalled();
  });

  it("falls back to GitHub raw content when the local file read fails", async () => {
    mockReadFile.mockRejectedValue(new Error("missing local file"));
    mockFetchText.mockResolvedValue(rawMetadataSource);

    const result = await Effect.runPromise(
      getContent("en", "articles/politics/test-article", {
        includeMDX: false,
      })
    );

    expect(result.metadata.title).toBe("Raw Title");
    expect(mockFetchText).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/nakafaai/nakafa.com/refs/heads/main/packages/contents/articles/politics/test-article/en.mdx"
    );
  });

  it("fails with GitHubFetchError when local and fallback reads fail", async () => {
    mockReadFile.mockRejectedValue(new Error("missing local file"));
    mockFetchText.mockRejectedValue(new Error("network down"));

    const failure = await Effect.runPromise(
      Effect.flip(
        getContent("en", "articles/politics/test-article", {
          includeMDX: false,
        })
      )
    );

    expect(failure).toBeInstanceOf(GitHubFetchError);
  });

  it("fails with InvalidPathError for traversal attempts", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(getContent("en", "../etc/passwd", { includeMDX: false }))
    );

    expect(failure).toBeInstanceOf(InvalidPathError);
  });

  it("loads raw content and the MDX module when includeMDX is true", async () => {
    const result = await Effect.runPromise(
      getContent("en", "articles/politics/test-article")
    );

    expect(result).toStrictEqual({
      ...moduleContent,
      raw: rawMetadataSource,
    });
    expect(mockImportContentModule).toHaveBeenCalledWith(
      "articles/politics/test-article",
      "en"
    );
  });

  it("fails with ModuleLoadError when the MDX module cannot load", async () => {
    mockImportContentModule.mockRejectedValue(new Error("module missing"));

    const failure = await Effect.runPromise(
      Effect.flip(getContent("en", "articles/politics/test-article"))
    );

    expect(failure).toBeInstanceOf(ModuleLoadError);
  });

  it("keeps the MDX module path on imported metadata failures", async () => {
    mockImportContentModule.mockResolvedValue({
      metadata: {
        title: "Broken",
      },
      default: () => "Broken MDX",
    });

    const failure = await Effect.runPromise(
      Effect.flip(getContent("en", "articles/politics/broken-article"))
    );

    expect(failure).toBeInstanceOf(MetadataParseError);
    expect(failure).toMatchObject({
      path: "@repo/contents/articles/politics/broken-article/en.mdx",
    });
  });

  it("fails with MetadataParseError when raw metadata is missing", async () => {
    mockReadFile.mockResolvedValue("# No metadata here");

    const failure = await Effect.runPromise(
      Effect.flip(
        getContent("en", "articles/politics/no-metadata", {
          includeMDX: false,
        })
      )
    );

    expect(failure).toBeInstanceOf(MetadataParseError);
  });
});

describe("getContents", () => {
  it("lists matching slugs with default locale and filters unreadable entries", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      "articles/politics/valid-entry",
      "articles/politics/broken-entry",
      "curriculum/high-school/10/mathematics",
    ]);
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.includes("broken-entry/en.mdx")) {
        return Promise.resolve("# Missing metadata");
      }

      return Promise.resolve(rawMetadataSource);
    });

    const result = await Effect.runPromise(
      getContents({
        basePath: "articles/politics",
        includeMDX: false,
      })
    );

    expect(mockGetMDXSlugsForLocale).toHaveBeenCalledWith("en");
    expect(result).toHaveLength(1);
    expect(result[0]).toStrictEqual({
      metadata: {
        title: "Raw Title",
        description: "Raw Description",
        authors: [{ name: "Raw Author" }],
        date: "2024-01-01",
      },
      raw: rawMetadataSource,
      url: "https://nakafa.com/en/articles/politics/valid-entry",
      slug: "articles/politics/valid-entry",
      locale: "en",
    });
  });

  it("uses includeMDX true and en locale when no options are provided", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      "articles/politics/default-entry",
    ]);

    const result = await Effect.runPromise(getContents());

    expect(result).toHaveLength(1);
    expect(result[0]?.metadata.title).toBe("Module Title");
    expect(result[0]?.slug).toBe("articles/politics/default-entry");
    expect(result[0]?.locale).toBe("en");
    expect(mockImportContentModule).toHaveBeenCalledWith(
      "articles/politics/default-entry",
      "en"
    );
  });

  it("returns an empty list when no cached slugs match the base path", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      "curriculum/high-school/10/mathematics",
    ]);

    const result = await Effect.runPromise(
      getContents({
        basePath: "articles/politics",
        includeMDX: false,
        locale: "id",
      })
    );

    expect(result).toStrictEqual([]);
    expect(mockGetMDXSlugsForLocale).toHaveBeenCalledWith("id");
    expect(mockReadFile).not.toHaveBeenCalled();
  });
});
