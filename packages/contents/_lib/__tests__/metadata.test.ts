import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  extractMetadata,
  getContentMetadata,
  getContentMetadataWithRaw,
  getContentsMetadata,
} from "@repo/contents/_lib/metadata";
import {
  FileReadError,
  InvalidPathError,
  MetadataParseError,
} from "@repo/contents/_shared/error";
import { Effect, Option } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockReadFile, mockGetMDXSlugsForLocale } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockGetMDXSlugsForLocale: vi.fn(),
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

vi.mock("@repo/contents/_lib/cache", () => ({
  getMDXSlugsForLocale: mockGetMDXSlugsForLocale,
}));

const createRawMetadata = (title: string) => `
export const metadata = {
  title: "${title}",
  description: "${title} Description",
  authors: [{ name: "${title} Author" }],
  date: "01/01/2024",
  subject: "Mathematics"
};

# ${title}
`;

const localeFileNames = new Set(["en.mdx", "id.mdx"]);
const seoContentRoots = ["articles", "subject"] as const;

/** Returns the package root whether Vitest runs from the workspace or repo root. */
function getContentsRoot() {
  if (process.cwd().endsWith("packages/contents")) {
    return process.cwd();
  }

  return path.join(process.cwd(), "packages/contents");
}

/** Collects localized MDX files below a content directory. */
function collectLocalizedMdxFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectLocalizedMdxFiles(entryPath));
      continue;
    }

    if (entry.isFile() && localeFileNames.has(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

beforeEach(() => {
  mockReadFile.mockResolvedValue(createRawMetadata("Default"));
  mockGetMDXSlugsForLocale.mockReturnValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
  mockReadFile.mockReset();
  mockGetMDXSlugsForLocale.mockReset();
});

describe("extractMetadata", () => {
  it("returns parsed metadata for valid content", () => {
    const result = extractMetadata(createRawMetadata("Valid"));

    expect(Option.isSome(result)).toBe(true);
    expect(Option.getOrUndefined(result)).toStrictEqual({
      title: "Valid",
      description: "Valid Description",
      authors: [{ name: "Valid Author" }],
      date: "01/01/2024",
      subject: "Mathematics",
    });
  });

  it("returns none when metadata export is missing", () => {
    const result = extractMetadata("# No metadata here");

    expect(Option.isNone(result)).toBe(true);
  });

  it("returns none when metadata is malformed", () => {
    const result = extractMetadata(`
export const metadata = {
  title: "Broken",
  authors: [{ name: "Author" }],
  date: "01/01/2024",
`);

    expect(Option.isNone(result)).toBe(true);
  });

  it("returns none when metadata fails schema validation", () => {
    const result = extractMetadata(`
export const metadata = {
  title: "Broken",
  authors: "Author",
  date: "01/01/2024"
};
`);

    expect(Option.isNone(result)).toBe(true);
  });

  it("returns none when metadata date is not MM/DD/YYYY", () => {
    const result = extractMetadata(`
export const metadata = {
  title: "Broken",
  authors: [{ name: "Author" }],
  date: "2024-01-01"
};
`);

    expect(Option.isNone(result)).toBe(true);
  });
});

describe("content SEO metadata", () => {
  it("keeps subject and article metadata complete and unique", () => {
    const contentsRoot = getContentsRoot();
    const descriptions = new Map<string, string>();
    const failures: string[] = [];

    for (const root of seoContentRoots) {
      const files = collectLocalizedMdxFiles(path.join(contentsRoot, root));

      for (const file of files) {
        const raw = readFileSync(file, "utf8");
        const metadata = extractMetadata(raw);
        const label = path.relative(contentsRoot, file);

        if (Option.isNone(metadata)) {
          failures.push(`${label} metadata cannot be parsed`);
          continue;
        }

        const { title, description, authors } = metadata.value;
        const trimmedTitle = title.trim();
        const trimmedDescription = description?.trim();

        if (!trimmedTitle) {
          failures.push(`${label} title is empty`);
        }

        if (!trimmedDescription) {
          failures.push(`${label} description is empty`);
        }

        if (authors.length === 0) {
          failures.push(`${label} authors are empty`);
        }

        if (!trimmedDescription) {
          continue;
        }

        const duplicate = descriptions.get(trimmedDescription);

        if (duplicate) {
          failures.push(`${label} repeats description from ${duplicate}`);
          continue;
        }

        descriptions.set(trimmedDescription, label);
      }
    }

    expect(failures).toEqual([]);
  });
});

describe("getContentMetadataWithRaw", () => {
  it("returns metadata together with raw content", async () => {
    const raw = createRawMetadata("Algebra");
    mockReadFile.mockResolvedValue(raw);

    const result = await Effect.runPromise(
      getContentMetadataWithRaw("en", "subject/high-school/10/mathematics")
    );

    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual({
      metadata: {
        title: "Algebra",
        description: "Algebra Description",
        authors: [{ name: "Algebra Author" }],
        date: "01/01/2024",
        subject: "Mathematics",
      },
      raw,
    });
  });

  it("fails with InvalidPathError for traversal attempts", async () => {
    const result = await Effect.runPromise(
      Effect.match(getContentMetadataWithRaw("en", "../etc/passwd"), {
        onSuccess: () => null,
        onFailure: (error) => error,
      })
    );

    expect(result).toBeInstanceOf(InvalidPathError);
  });

  it("fails with FileReadError when file reading fails", async () => {
    mockReadFile.mockRejectedValue(new Error("missing file"));

    const result = await Effect.runPromise(
      Effect.match(getContentMetadataWithRaw("en", "subject/missing"), {
        onSuccess: () => null,
        onFailure: (error) => error,
      })
    );

    expect(result).toBeInstanceOf(FileReadError);
  });

  it("fails with MetadataParseError when metadata is missing", async () => {
    mockReadFile.mockResolvedValue("# Metadata is missing");

    const result = await Effect.runPromise(
      Effect.match(getContentMetadataWithRaw("en", "subject/no-metadata"), {
        onSuccess: () => null,
        onFailure: (error) => error,
      })
    );

    expect(result).toBeInstanceOf(MetadataParseError);
  });
});

describe("getContentMetadata", () => {
  it("fails with InvalidPathError for traversal attempts", async () => {
    const result = await Effect.runPromise(
      Effect.match(getContentMetadata("../etc/passwd", "en"), {
        onSuccess: () => null,
        onFailure: (error) => error,
      })
    );

    expect(result).toBeInstanceOf(InvalidPathError);
  });

  it("fails with MetadataParseError when metadata is missing", async () => {
    mockReadFile.mockResolvedValue("# Metadata is missing");

    const result = await Effect.runPromise(
      Effect.match(getContentMetadata("subject/no-metadata", "en"), {
        onSuccess: () => null,
        onFailure: (error) => error,
      })
    );

    expect(result).toBeInstanceOf(MetadataParseError);
  });
});

describe("getContentsMetadata", () => {
  it("lists metadata items and skips unreadable entries", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      "articles/politics/valid-entry",
      "articles/politics/missing-entry",
      "subject/high-school/10/algebra",
    ]);
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.includes("valid-entry/en.mdx")) {
        return Promise.resolve(createRawMetadata("Valid Entry"));
      }

      if (filePath.includes("missing-entry/en.mdx")) {
        return Promise.reject(new Error("missing file"));
      }

      return Promise.resolve(createRawMetadata("Algebra"));
    });

    const result = await Effect.runPromise(getContentsMetadata());

    expect(mockGetMDXSlugsForLocale).toHaveBeenCalledWith("en");
    expect(result).toStrictEqual([
      {
        locale: "en",
        metadata: {
          title: "Valid Entry",
          description: "Valid Entry Description",
          authors: [{ name: "Valid Entry Author" }],
          date: "01/01/2024",
          subject: "Mathematics",
        },
        slug: "articles/politics/valid-entry",
        url: "https://nakafa.com/en/articles/politics/valid-entry",
      },
      {
        locale: "en",
        metadata: {
          title: "Algebra",
          description: "Algebra Description",
          authors: [{ name: "Algebra Author" }],
          date: "01/01/2024",
          subject: "Mathematics",
        },
        slug: "subject/high-school/10/algebra",
        url: "https://nakafa.com/en/subject/high-school/10/algebra",
      },
    ]);
  });

  it("filters metadata by basePath and locale", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      "articles/politics/dynastic-politics",
      "subject/high-school/10/mathematics",
    ]);
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.includes("dynastic-politics/id.mdx")) {
        return Promise.resolve(createRawMetadata("Politik Dinasti"));
      }

      return Promise.resolve(createRawMetadata("Should Not Be Read"));
    });

    const result = await Effect.runPromise(
      getContentsMetadata({
        basePath: "articles/politics",
        locale: "id",
      })
    );

    expect(mockGetMDXSlugsForLocale).toHaveBeenCalledWith("id");
    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual([
      {
        locale: "id",
        metadata: {
          title: "Politik Dinasti",
          description: "Politik Dinasti Description",
          authors: [{ name: "Politik Dinasti Author" }],
          date: "01/01/2024",
          subject: "Mathematics",
        },
        slug: "articles/politics/dynastic-politics",
        url: "https://nakafa.com/id/articles/politics/dynastic-politics",
      },
    ]);
  });
});
