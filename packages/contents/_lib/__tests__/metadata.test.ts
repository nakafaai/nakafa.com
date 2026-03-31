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
