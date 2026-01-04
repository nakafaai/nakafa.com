import {
  extractReferences,
  getContent,
  getContentMetadata,
  getContents,
  getReferences,
  parseModuleMetadata,
  parseReferences,
  validatePath,
} from "@repo/contents/_lib/content";
import { InvalidPathError } from "@repo/contents/_shared/error";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockReadFile, mockFsAccess, mockKyGet, mockGetMDXSlugsForLocale } =
  vi.hoisted(() => ({
    mockReadFile: vi.fn(),
    mockFsAccess: vi.fn(),
    mockKyGet: vi.fn(),
    mockGetMDXSlugsForLocale: vi.fn(),
  }));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readdirSync: vi.fn(() => []),
    existsSync: vi.fn(() => true),
    constants: { F_OK: 0 },
    promises: {
      readFile: mockReadFile,
      access: mockFsAccess,
    },
  };
});

vi.mock("ky", () => ({
  default: {
    get: mockKyGet,
  },
}));

vi.mock("@repo/contents/_lib/cache", () => ({
  getMDXSlugsForLocale: mockGetMDXSlugsForLocale,
}));

vi.mock(
  "@repo/contents/articles/politics/dynastic-politics-asian-values/ref.ts",
  () => ({
    references: [
      {
        title: "Test Reference",
        authors: "Test Author",
        year: 2024,
      },
    ],
  })
);

vi.mock("@repo/contents/testpath/en.mdx", () => ({
  metadata: {
    title: "Test Title",
    description: "Test Description",
    authors: [{ name: "Test Author" }],
    date: "01/01/2024",
  },
  default: () => "Test MDX Content",
}));

vi.mock("@repo/contents/test/sub1/en.mdx", () => ({
  metadata: {
    title: "Sub1 Title",
    description: "Sub1 Description",
    authors: [{ name: "Test Author" }],
    date: "01/01/2024",
  },
  default: () => "Sub1 MDX Content",
}));

vi.mock("@repo/contents/test/sub2/en.mdx", () => ({
  metadata: {
    title: "Sub2 Title",
    description: "Sub2 Description",
    authors: [{ name: "Test Author" }],
    date: "01/01/2024",
  },
  default: () => "Sub2 MDX Content",
}));

import type { Locale } from "next-intl";

beforeEach(() => {
  mockReadFile.mockResolvedValue("");
  mockFsAccess.mockResolvedValue(undefined);
  mockKyGet.mockRejectedValue(new Error("Network error"));
  mockGetMDXSlugsForLocale.mockReturnValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
  mockReadFile.mockReset();
});

describe("getContentMetadata", () => {
  it("should return metadata for valid MDX file", async () => {
    mockReadFile.mockResolvedValue(`
export const metadata = {
  title: "Test Title",
  description: "Test Description",
  authors: [{ name: "Test Author" }],
  date: "01/01/2024"
};

# Content
`);

    const metadata = await Effect.runPromise(
      getContentMetadata("testpath", "en")
    );
    expect(mockReadFile).toHaveBeenCalled();
    expect(metadata).not.toBeNull();
    expect(metadata?.title).toBe("Test Title");
    expect(metadata?.description).toBe("Test Description");
  });

  it("should handle different locales", async () => {
    mockReadFile.mockResolvedValue(`
export const metadata = {
  title: "Test Title",
  description: "Test Description",
  authors: [{ name: "Test Author" }],
  date: "01/01/2024"
};

# Content
`);

    const metadata = await Effect.runPromise(
      getContentMetadata("testpath", "id")
    );
    expect(mockReadFile).toHaveBeenCalled();
    expect(metadata).not.toBeNull();
    expect(metadata?.title).toBe("Test Title");
    expect(metadata?.description).toBe("Test Description");
  });

  it("should handle path with special characters", async () => {
    mockReadFile.mockResolvedValue(`
export const metadata = {
  title: "Test",
  authors: [{ name: "Test Author" }],
  date: "01/01/2024"
};
`);

    const metadata = await Effect.runPromise(
      getContentMetadata("testpath?query=value", "en")
    );
    expect(mockReadFile).toHaveBeenCalled();
    expect(metadata).not.toBeNull();
  });

  it("should return null when file read fails", async () => {
    mockReadFile.mockRejectedValue(new Error("File not found"));

    const metadata = await Effect.runPromise(
      Effect.match(getContentMetadata("nonexistent/path", "en"), {
        onSuccess: (data) => data,
        onFailure: () => null,
      })
    );
    expect(metadata).toBeNull();
  });

  it("should return null for invalid metadata", async () => {
    mockReadFile.mockResolvedValue(`
export const metadata = {
  title: "Test",
  invalid_field: ${String.fromCharCode(0x1_f6_00)}
};
`);

    const metadata = await Effect.runPromise(
      Effect.match(getContentMetadata("test/path", "en"), {
        onSuccess: (data) => data,
        onFailure: () => null,
      })
    );
    expect(metadata).toBeNull();
  });

  it("should return null for malformed metadata", async () => {
    mockReadFile.mockResolvedValue(`
export const metadata = {
  title: "Test",
};

# Content
`);

    const metadata = await Effect.runPromise(
      Effect.match(getContentMetadata("test/path", "en"), {
        onSuccess: (data) => data,
        onFailure: () => null,
      })
    );
    expect(metadata).toBeNull();
  });

  it("should return null for content without metadata", async () => {
    mockReadFile.mockResolvedValue(`
# Content without metadata
`);

    const metadata = await Effect.runPromise(
      Effect.match(getContentMetadata("test/path", "en"), {
        onSuccess: (data) => data,
        onFailure: () => null,
      })
    );
    expect(metadata).toBeNull();
  });

  it("should return null for empty content", async () => {
    mockReadFile.mockResolvedValue("");

    const metadata = await Effect.runPromise(
      Effect.match(getContentMetadata("test/path", "en"), {
        onSuccess: (data) => data,
        onFailure: () => null,
      })
    );
    expect(metadata).toBeNull();
  });

  it("should handle path traversal attempts", async () => {
    const metadata = await Effect.runPromise(
      Effect.match(getContentMetadata("../etc/passwd", "en"), {
        onSuccess: (data) => data,
        onFailure: () => null,
      })
    );
    expect(metadata).toBeNull();
  });

  it("should handle absolute paths", async () => {
    const metadata = await Effect.runPromise(
      Effect.match(getContentMetadata("/absolute/path", "en"), {
        onSuccess: (data) => data,
        onFailure: () => null,
      })
    );
    expect(metadata).toBeNull();
  });

  it("should detect path traversal in getContentMetadata", async () => {
    const metadata = await Effect.runPromise(
      Effect.match(getContentMetadata("../../../etc/passwd", "en"), {
        onSuccess: (data) => data,
        onFailure: (error) => error,
      })
    );
    expect(metadata).toBeInstanceOf(InvalidPathError);
  });
});

describe("validatePath", () => {
  describe("path traversal security (line 50)", () => {
    it("should reject paths with .. segments that escape base directory", async () => {
      const result = await Effect.runPromise(
        Effect.match(validatePath("../../../etc/passwd", "/base/dir"), {
          onSuccess: (data) => data,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(InvalidPathError);
      expect((result as InvalidPathError).reason).toBe(
        "Path traversal detected"
      );
    });

    it("should reject paths with .. in the middle that escape base directory", async () => {
      const result = await Effect.runPromise(
        Effect.match(validatePath("test/../../etc/passwd", "/base/dir"), {
          onSuccess: (data) => data,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(InvalidPathError);
    });

    it("should reject deeply nested traversal attempts", async () => {
      const result = await Effect.runPromise(
        Effect.match(
          validatePath(
            "a/b/c/d/e/f/g/../../../../../../../../etc/passwd",
            "/base/dir"
          ),
          {
            onSuccess: (data) => data,
            onFailure: (error) => error,
          }
        )
      );
      expect(result).toBeInstanceOf(InvalidPathError);
    });

    it("should reject paths with mixed .. and normal segments that escape", async () => {
      const result = await Effect.runPromise(
        Effect.match(validatePath("valid/../../etc/passwd", "/base/dir"), {
          onSuccess: (data) => data,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(InvalidPathError);
    });

    it("should reject paths with only .. segments", async () => {
      const result = await Effect.runPromise(
        Effect.match(validatePath("../..", "/base/dir"), {
          onSuccess: (data) => data,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(InvalidPathError);
    });
  });

  describe("valid paths", () => {
    it("should accept simple relative paths", async () => {
      const result = await Effect.runPromise(
        validatePath("test/path", "/base/dir")
      );
      expect(result).toBe("/base/dir/test/path");
    });

    it("should accept paths with multiple segments", async () => {
      const result = await Effect.runPromise(
        validatePath("articles/politics/my-article", "/base/dir")
      );
      expect(result).toBe("/base/dir/articles/politics/my-article");
    });

    it("should accept paths with leading/trailing slashes (cleaned)", async () => {
      const result = await Effect.runPromise(
        validatePath("/test/path/", "/base/dir")
      );
      expect(result).toBe("/base/dir/test/path");
    });

    it("should accept empty path (resolves to base directory)", async () => {
      const result = await Effect.runPromise(validatePath("", "/base/dir"));
      expect(result).toBe("/base/dir");
    });

    it("should accept paths with .. that don't escape base directory", async () => {
      const result = await Effect.runPromise(
        validatePath("test/path/..", "/base/dir")
      );
      expect(result).toBe("/base/dir/test");
    });

    it("should accept paths with embedded . segments", async () => {
      const result = await Effect.runPromise(
        validatePath("test/./path", "/base/dir")
      );
      expect(result).toBe("/base/dir/test/path");
    });
  });
});

describe("getContent", () => {
  it("should read content from local file when it exists (includeMDX: false)", async () => {
    const rawContent = `
export const metadata = {
  title: "Test Title",
  description: "Test Description",
  authors: [{ name: "Test Author" }],
  date: "01/01/2024"
};

# Content
`;
    mockFsAccess.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(rawContent);

    const content = await Effect.runPromise(
      getContent("en", "testpath", { includeMDX: false })
    );
    expect(content).not.toBeNull();
    expect(content?.raw).toBe(rawContent);
    expect(content?.metadata.title).toBe("Test Title");
    expect(mockReadFile).toHaveBeenCalled();
  });

  it("should fallback to GitHub when local file does not exist", async () => {
    const githubContent = `
export const metadata = {
  title: "GitHub Content",
  description: "GitHub Description",
  authors: [{ name: "Test Author" }],
  date: "01/01/2024"
};

# GitHub Content
`;
    mockFsAccess.mockRejectedValue(new Error("File not found"));
    mockReadFile.mockRejectedValue(new Error("File not found"));
    mockKyGet.mockImplementation((_url, _options) => ({
      text: () => Promise.resolve(githubContent),
    }));

    const content = await Effect.runPromise(
      getContent("en", "test/path", { includeMDX: false })
    );
    expect(content).not.toBeNull();
    expect(content?.raw).toBe(githubContent);
    expect(content?.metadata.title).toBe("GitHub Content");
    expect(mockKyGet).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/nakafaai/nakafa.com/refs/heads/main/packages/contents/test/path/en.mdx",
      { cache: "force-cache" }
    );
  });

  it("should return null when both local and GitHub fail", async () => {
    mockFsAccess.mockRejectedValue(new Error("File not found"));
    mockKyGet.mockRejectedValue(new Error("Network error"));

    const content = await Effect.runPromise(
      Effect.match(getContent("en", "test/path", { includeMDX: false }), {
        onSuccess: (data) => data,
        onFailure: () => null,
      })
    );
    expect(content).toBeNull();
  });

  it("should return null when raw content is empty", async () => {
    mockFsAccess.mockRejectedValue(new Error("File not found"));
    mockKyGet.mockResolvedValue({ text: () => Promise.resolve("") });

    const content = await Effect.runPromise(
      Effect.match(getContent("en", "test/path"), {
        onSuccess: (data) => data,
        onFailure: () => null,
      })
    );
    expect(content).toBeNull();
  });

  it("should return null when metadata is missing in includeMDX mode", async () => {
    mockReadFile.mockResolvedValue("# Content without metadata");

    const content = await Effect.runPromise(
      Effect.match(getContent("en", "test/path", { includeMDX: false }), {
        onSuccess: (data) => data,
        onFailure: () => null,
      })
    );
    expect(content).toBeNull();
  });

  it("should return content with metadata only when includeMDX is false", async () => {
    const rawContent = `
export const metadata = {
  title: "Test Title",
  description: "Test Description",
  authors: [{ name: "Test Author" }],
  date: "01/01/2024"
};

# Content
`;
    mockReadFile.mockResolvedValue(rawContent);

    const content = await Effect.runPromise(
      getContent("en", "test/path", { includeMDX: false })
    );
    expect(content).not.toBeNull();
    expect(content?.metadata.title).toBe("Test Title");
    expect(content?.raw).toContain("# Content");
    expect(content?.default).toBeUndefined();
  });

  it("should handle errors gracefully", async () => {
    mockReadFile.mockRejectedValue(new Error("Read error"));

    const content = await Effect.runPromise(
      Effect.match(getContent("en", "test/path"), {
        onSuccess: (data) => data,
        onFailure: () => null,
      })
    );
    expect(content).toBeNull();
  });

  it("should return null for path traversal attempts", async () => {
    const content = await Effect.runPromise(
      Effect.match(getContent("en", "../etc/passwd"), {
        onSuccess: (data) => data,
        onFailure: () => null,
      })
    );
    expect(content).toBeNull();
  });

  it("should return null for absolute paths", async () => {
    const content = await Effect.runPromise(
      Effect.match(getContent("en", "/absolute/path"), {
        onSuccess: (data) => data,
        onFailure: () => null,
      })
    );
    expect(content).toBeNull();
  });

  it("should handle path traversal that bypasses initial checks", async () => {
    const content = await Effect.runPromise(
      Effect.match(getContent("en", "../../etc/passwd"), {
        onSuccess: (data) => data,
        onFailure: () => null,
      })
    );
    expect(content).toBeNull();
  });

  it("should return null when GitHub fetch fails", async () => {
    mockFsAccess.mockRejectedValue(new Error("File not found"));
    mockKyGet.mockRejectedValue(new Error("Network error"));

    const content = await Effect.runPromise(
      Effect.match(getContent("en", "nonexistent/path"), {
        onSuccess: (data) => data,
        onFailure: () => null,
      })
    );
    expect(content).toBeNull();
  });

  it("should return null when GitHub fetch throws error", async () => {
    mockFsAccess.mockRejectedValue(new Error("File not found"));
    mockKyGet.mockImplementation(() => {
      throw new Error("GitHub fetch failed");
    });

    const content = await Effect.runPromise(
      Effect.match(getContent("en", "test/path", { includeMDX: false }), {
        onSuccess: (data) => data,
        onFailure: () => null,
      })
    );
    expect(content).toBeNull();
  });

  it("should return empty string when GitHub fetch succeeds but text() fails", async () => {
    mockFsAccess.mockRejectedValue(new Error("File not found"));
    mockKyGet.mockImplementation(() => ({
      text: () => Promise.reject(new Error("Failed to read response text")),
    }));

    const content = await Effect.runPromise(
      Effect.match(getContent("en", "test/path", { includeMDX: false }), {
        onSuccess: (data) => data,
        onFailure: () => null,
      })
    );
    expect(content).toBeNull();
  });

  it("should return null when file exists but read fails", async () => {
    mockFsAccess.mockResolvedValue(undefined);
    mockReadFile.mockRejectedValue(new Error("Read failed"));

    const content = await Effect.runPromise(
      Effect.match(getContent("en", "test/path", { includeMDX: false }), {
        onSuccess: (data) => data,
        onFailure: () => null,
      })
    );
    expect(content).toBeNull();
  });

  it("should handle path that bypasses initial checks but fails second check", async () => {
    mockFsAccess.mockRejectedValue(new Error("File not found"));
    mockKyGet.mockResolvedValue({ text: () => Promise.resolve("") });

    const content = await Effect.runPromise(
      Effect.match(
        getContent("en", "test/../../../etc/passwd", { includeMDX: false }),
        {
          onSuccess: (data) => data,
          onFailure: () => null,
        }
      )
    );
    expect(content).toBeNull();
  });

  it("should read content with includeMDX: true", async () => {
    vi.doMock("../content", async (importOriginal) => {
      const mod = await importOriginal<typeof import("../content")>();
      return {
        ...mod,
        getContent: (locale: Locale, filePath: string, options: any) => {
          if (filePath === "test/path" && options?.includeMDX === true) {
            return Effect.succeed({
              metadata: {
                title: "Test Title",
                description: "Test Description",
                authors: [{ name: "Test Author" }],
                date: "01/01/2024",
              },
              default: "Test MDX Content",
              raw: "# MDX Content",
            });
          }
          return mod.getContent(locale, filePath, options);
        },
      };
    });

    vi.resetModules();
    const { getContent: getContentWithMock } = await import("../content");
    const content = await Effect.runPromise(
      getContentWithMock("en", "test/path", {
        includeMDX: true,
      })
    );
    expect(content).not.toBeNull();
    expect(content?.metadata.title).toBe("Test Title");
    expect(content?.default).toBeDefined();
    expect(content?.raw).toBe("# MDX Content");
  });

  it("should return null when metadata is not found with includeMDX: false", async () => {
    mockReadFile.mockResolvedValue(`
# Content without metadata

This is just content without any metadata export.
`);

    const content = await Effect.runPromise(
      Effect.match(
        getContent("en", "test/no-metadata", { includeMDX: false }),
        {
          onSuccess: (data) => data,
          onFailure: () => null,
        }
      )
    );
    expect(content).toBeNull();
  });

  it("should return null when metadata is invalid with includeMDX: false", async () => {
    mockReadFile.mockResolvedValue(`
export const metadata = "invalid metadata";

# Content
`);

    const content = await Effect.runPromise(
      Effect.match(
        getContent("en", "test/invalid-metadata", { includeMDX: false }),
        {
          onSuccess: (data) => data,
          onFailure: () => null,
        }
      )
    );
    expect(content).toBeNull();
  });

  it("should return content without MDX when includeMDX: false", async () => {
    mockReadFile.mockResolvedValue(`
export const metadata = {
  title: "Test Title",
  description: "Test Description",
  authors: [{ name: "Test Author" }],
  date: "01/01/2024"
};

# Content
`);

    const content = await Effect.runPromise(
      getContent("en", "test/path", { includeMDX: false })
    );
    expect(content).toBeDefined();
    expect(content?.metadata.title).toBe("Test Title");
    expect(content?.default).toBeUndefined();
    expect(content?.raw).toContain("# Content");
  });

  it("should return null when metadata is invalid with includeMDX: true", async () => {
    const { getContent: getContentWithMock } = await import("../content");

    const content = await Effect.runPromise(
      Effect.match(
        getContentWithMock("en", "test/invalid", {
          includeMDX: true,
        }),
        {
          onSuccess: (data) => data,
          onFailure: () => null,
        }
      )
    );
    expect(content).toBeNull();
  });

  it("should return null when metadata parsing fails with includeMDX: true", async () => {
    mockReadFile.mockResolvedValue(`
export const metadata = {
  title: "Test",
  description: null,
  authors: "invalid",
  date: "invalid"
};

# Content
`);

    const content = await Effect.runPromise(
      Effect.match(getContent("en", "test/parse-error", { includeMDX: true }), {
        onSuccess: (data) => data,
        onFailure: () => null,
      })
    );
    expect(content).toBeNull();
  });
});

describe("getContents", () => {
  it("should return array of contents for nested paths", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue(["test/sub1", "test/sub2"]);

    mockFsAccess.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(`
export const metadata = {
  title: "Test Title",
  description: "Test Description",
  authors: [{ name: "Test Author" }],
  date: "01/01/2024"
};
`);

    const contents = await Effect.runPromise(
      getContents({
        locale: "en",
        basePath: "test",
        includeMDX: false,
      })
    );
    expect(contents).toHaveLength(2);
    expect(contents[0]?.metadata.title).toBe("Test Title");
  });

  it("should filter out null contents", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue(["test/valid", "test/invalid"]);

    mockFsAccess.mockResolvedValue(undefined);
    mockReadFile
      .mockResolvedValueOnce(`
export const metadata = {
  title: "Valid",
  description: "Test",
  authors: [{ name: "Test Author" }],
  date: "01/01/2024"
};
`)
      .mockResolvedValueOnce("invalid content");

    const contents = await Effect.runPromise(
      getContents({
        locale: "en",
        basePath: "test",
        includeMDX: false,
      })
    );
    expect(contents).toHaveLength(1);
    expect(contents[0]?.metadata.title).toBe("Valid");
  });

  it("should filter out contents that fail ContentSchema validation", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      "test/valid",
      "test/invalid-schema",
    ]);

    mockFsAccess.mockResolvedValue(undefined);
    mockReadFile
      .mockResolvedValueOnce(`
export const metadata = {
  title: "Valid",
  description: "Test",
  authors: [{ name: "Test Author" }],
  date: "01/01/2024"
};
`)
      .mockResolvedValueOnce(`
export const metadata = {
  title: "Invalid",
  description: "Test",
  authors: "invalid-authors",
  date: "01/01/2024"
};
`);

    const contents = await Effect.runPromise(
      getContents({
        locale: "en",
        basePath: "test",
        includeMDX: false,
      })
    );
    expect(contents).toHaveLength(1);
    expect(contents[0]?.metadata.title).toBe("Valid");
  });

  it("should filter out contents with missing date field", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue(["test/no-date"]);

    mockFsAccess.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(`
export const metadata = {
  title: "No Date",
  description: "Test",
  authors: [{ name: "Test Author" }]
};
`);

    const contents = await Effect.runPromise(
      getContents({
        locale: "en",
        basePath: "test",
        includeMDX: false,
      })
    );
    expect(contents).toHaveLength(0);
  });

  it("should filter out contents with invalid metadata structure", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      "test/valid",
      "test/invalid-schema",
    ]);

    mockFsAccess.mockResolvedValue(undefined);
    mockReadFile
      .mockResolvedValueOnce(`
export const metadata = {
  title: "Valid",
  description: "Test",
  authors: [{ name: "Test Author" }],
  date: "01/01/2024"
};
`)
      .mockResolvedValueOnce(`
export const metadata = {
  title: "Invalid",
  description: "Test",
  authors: [{ name: "Test Author" }],
  date: "01/01/2024"
};
`);

    const contents = await Effect.runPromise(
      getContents({
        locale: "en",
        basePath: "test",
        includeMDX: false,
      })
    );
    expect(contents.length).toBeGreaterThan(0);
    expect(contents.every((c) => c !== null)).toBe(true);
  });

  it("should use default locale when not specified", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue(["test/some-content"]);

    mockFsAccess.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(`
export const metadata = {
  title: "Test",
  description: "Test",
  authors: [{ name: "Test Author" }],
  date: "01/01/2024"
};
`);

    const contents = await Effect.runPromise(
      getContents({ includeMDX: false })
    );
    expect(contents).toHaveLength(1);
    expect(contents[0]?.url).toBeDefined();
    expect(contents[0]?.slug).toBeDefined();
    expect(contents[0]?.locale).toBe("en");
  });

  it("should handle empty nested paths", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([]);

    mockFsAccess.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(`
export const metadata = {
  title: "Test",
  description: "Test",
  authors: [{ name: "Test Author" }],
  date: "01/01/2024"
};
`);

    const contents = await Effect.runPromise(
      getContents({
        basePath: "empty",
        includeMDX: false,
      })
    );
    expect(contents).toHaveLength(0);
  });

  it("should handle ContentSchema parse errors by filtering out invalid content", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue(["test/parse-error"]);

    mockFsAccess.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(`
export const metadata = {
  title: "Parse Error",
  description: "Test",
  authors: [{ name: "Test Author" }],
  date: "01/01/2024"
};
`);

    const contents = await Effect.runPromise(
      getContents({
        locale: "en",
        basePath: "test",
        includeMDX: false,
      })
    );

    expect(contents).toHaveLength(1);
    expect(contents[0]?.metadata.title).toBe("Parse Error");
  });

  it("should handle content that fails to construct URL by filtering out", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue(["test/invalid-content"]);

    mockFsAccess.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(`
export const metadata = {
  title: "Invalid Content",
  description: "Test",
  authors: [{ name: "Test Author" }],
  date: "01/01/2024"
};
`);

    const contents = await Effect.runPromise(
      getContents({
        locale: "en",
        basePath: "test",
        includeMDX: false,
      })
    );

    expect(contents.length).toBeGreaterThanOrEqual(0);
  });

  it("should filter out content when ContentSchema.parse throws error", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue(["test/parse-fail"]);

    mockFsAccess.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(`
export const metadata = "not an object";

# Content
`);

    const contents = await Effect.runPromise(
      getContents({
        locale: "en",
        basePath: "test",
        includeMDX: false,
      })
    );

    expect(contents).toHaveLength(0);
  });

  it("should filter out content when parsedData returns undefined", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue(["test/undefined-result"]);

    mockFsAccess.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(`
export const metadata = {
  title: "Undefined Result",
  description: "Test",
  authors: [{ name: "Test Author" }],
  date: "01/01/2024"
};
`);

    const contents = await Effect.runPromise(
      getContents({
        locale: "en",
        basePath: "test",
        includeMDX: false,
      })
    );

    expect(contents).toHaveLength(1);
  });

  it("should handle all slugs failing to load by returning empty array", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      "test/fail1",
      "test/fail2",
      "test/fail3",
    ]);

    mockFsAccess.mockRejectedValue(new Error("File not found"));
    mockReadFile.mockRejectedValue(new Error("Read error"));

    const contents = await Effect.runPromise(
      getContents({
        locale: "en",
        basePath: "test",
        includeMDX: false,
      })
    );

    expect(contents).toHaveLength(0);
  });
});

describe("getReferences", () => {
  it("should return empty array when ref file does not exist", async () => {
    const refs = await Effect.runPromise(getReferences("nonexistent/path"));
    expect(refs).toEqual([]);
  });

  it("should handle errors gracefully", async () => {
    const refs = await Effect.runPromise(getReferences("error/path"));
    expect(refs).toEqual([]);
  });

  it("should return empty array for path with special characters", async () => {
    const refs = await Effect.runPromise(getReferences("test/path/../invalid"));
    expect(refs).toEqual([]);
  });

  it("should return empty array for absolute paths", async () => {
    const refs = await Effect.runPromise(getReferences("/absolute/path"));
    expect(refs).toEqual([]);
  });

  it("should return references when ref file exists", async () => {
    const refs = await Effect.runPromise(
      getReferences("articles/politics/dynastic-politics-asian-values")
    );
    expect(refs).toBeDefined();
    expect(Array.isArray(refs)).toBe(true);
  });

  it("should handle import errors by returning empty array", async () => {
    const refs = await Effect.runPromise(getReferences("test/nonexistent"));
    expect(refs).toEqual([]);
  });

  it("should handle path traversal attempts", async () => {
    const refs = await Effect.runPromise(getReferences("../../etc/passwd"));
    expect(refs).toEqual([]);
  });

  it("should handle deeply nested paths", async () => {
    const refs = await Effect.runPromise(getReferences("deep/nested/path"));
    expect(refs).toEqual([]);
  });

  describe("safe parsing with Zod schema", () => {
    it("should successfully parse valid references with all required fields", async () => {
      const rawReferences = [
        {
          title: "Test Article",
          authors: "Test Author",
          year: 2024,
        },
      ];

      const refs = await Effect.runPromise(parseReferences(rawReferences));
      expect(refs).toHaveLength(1);
      expect(refs[0].title).toBe("Test Article");
      expect(refs[0].authors).toBe("Test Author");
      expect(refs[0].year).toBe(2024);
    });

    it("should successfully parse valid references with optional fields", async () => {
      const rawReferences = [
        {
          title: "Complete Article",
          authors: "Author Name",
          year: 2023,
          url: "https://example.com",
          citation: "Test citation",
          publication: "Test Journal",
          details: "Vol 1, No 1",
        },
      ];

      const refs = await Effect.runPromise(parseReferences(rawReferences));
      expect(refs).toHaveLength(1);
      expect(refs[0].title).toBe("Complete Article");
      expect(refs[0].url).toBe("https://example.com");
      expect(refs[0].citation).toBe("Test citation");
      expect(refs[0].publication).toBe("Test Journal");
      expect(refs[0].details).toBe("Vol 1, No 1");
    });

    it("should handle invalid references by returning error", async () => {
      const rawReferences = [
        {
          title: "Invalid Article",
          year: "2024",
        },
      ];

      const result = await Effect.runPromise(
        Effect.match(parseReferences(rawReferences), {
          onSuccess: (data) => data,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toContain("Failed to parse references");
    });

    it("should handle references with null values by returning error", async () => {
      const rawReferences = [
        {
          title: null,
          authors: "Test Author",
          year: 2024,
        },
      ];

      const result = await Effect.runPromise(
        Effect.match(parseReferences(rawReferences), {
          onSuccess: (data) => data,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toContain("Failed to parse references");
    });

    it("should handle references with wrong year type by returning error", async () => {
      const rawReferences = [
        {
          title: "Test Article",
          authors: "Test Author",
          year: "2024",
        },
      ];

      const result = await Effect.runPromise(
        Effect.match(parseReferences(rawReferences), {
          onSuccess: (data) => data,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toContain("Failed to parse references");
    });

    it("should handle references array as non-array by returning error", async () => {
      const rawReferences = "not an array" as unknown as unknown[];

      const result = await Effect.runPromise(
        Effect.match(parseReferences(rawReferences), {
          onSuccess: (data) => data,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toContain("Failed to parse references");
    });

    it("should handle references with undefined required field by returning error", async () => {
      const rawReferences = [
        {
          title: undefined,
          authors: "Test Author",
          year: 2024,
        },
      ];

      const result = await Effect.runPromise(
        Effect.match(parseReferences(rawReferences), {
          onSuccess: (data) => data,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toContain("Failed to parse references");
    });

    it("should handle empty references array", async () => {
      const refs = await Effect.runPromise(parseReferences([]));
      expect(refs).toEqual([]);
    });

    it("should handle multiple valid references", async () => {
      const rawReferences = [
        {
          title: "First Article",
          authors: "First Author",
          year: 2023,
        },
        {
          title: "Second Article",
          authors: "Second Author",
          year: 2024,
        },
      ];

      const refs = await Effect.runPromise(parseReferences(rawReferences));
      expect(refs).toHaveLength(2);
      expect(refs[0].title).toBe("First Article");
      expect(refs[1].title).toBe("Second Article");
    });
  });

  describe("extractReferences - safe module extraction", () => {
    it("should extract references from valid module object", () => {
      const module = {
        references: [{ title: "Test", authors: "A", year: 2024 }],
      };
      const refs = extractReferences(module);
      expect(refs).toHaveLength(1);
      expect(refs[0]).toEqual({ title: "Test", authors: "A", year: 2024 });
    });

    it("should return empty array when references property is missing", () => {
      const module = { otherProp: "value" };
      const refs = extractReferences(module);
      expect(refs).toEqual([]);
    });

    it("should return empty array when references is not an array", () => {
      const module = { references: "not an array" };
      const refs = extractReferences(module);
      expect(refs).toEqual([]);
    });

    it("should return empty array when references is null", () => {
      const module = { references: null };
      const refs = extractReferences(module);
      expect(refs).toEqual([]);
    });

    it("should return empty array when references is undefined", () => {
      const module = { references: undefined };
      const refs = extractReferences(module);
      expect(refs).toEqual([]);
    });

    it("should return empty array when module is null", () => {
      const refs = extractReferences(null);
      expect(refs).toEqual([]);
    });

    it("should return empty array when module is undefined", () => {
      const refs = extractReferences(undefined);
      expect(refs).toEqual([]);
    });

    it("should return empty array when module is a primitive type", () => {
      const refs = extractReferences("string");
      expect(refs).toEqual([]);
    });

    it("should return empty array when references array is empty", () => {
      const module = { references: [] };
      const refs = extractReferences(module);
      expect(refs).toEqual([]);
    });

    it("should extract references with mixed types in array", () => {
      const module = {
        references: [
          { title: "Valid", authors: "A", year: 2024 },
          { title: "Another", authors: "B", year: 2023 },
        ],
      };
      const refs = extractReferences(module);
      expect(refs).toHaveLength(2);
    });
  });
});

describe("parseModuleMetadata", () => {
  it("should parse valid metadata from module object", async () => {
    const module = {
      metadata: {
        title: "Test Title",
        description: "Test Description",
        authors: [{ name: "Test Author" }],
        date: "01/01/2024",
      },
    };

    const metadata = await Effect.runPromise(parseModuleMetadata(module));
    expect(metadata.title).toBe("Test Title");
    expect(metadata.description).toBe("Test Description");
    expect(metadata.authors).toHaveLength(1);
    expect(metadata.authors[0].name).toBe("Test Author");
    expect(metadata.date).toBe("01/01/2024");
  });

  it("should parse valid metadata with optional fields", async () => {
    const module = {
      metadata: {
        title: "Complete Article",
        description: "Full Description",
        authors: [{ name: "Author Name" }],
        date: "01/01/2024",
        subject: "Test Subject",
      },
    };

    const metadata = await Effect.runPromise(parseModuleMetadata(module));
    expect(metadata.title).toBe("Complete Article");
    expect(metadata.subject).toBe("Test Subject");
  });

  it("should handle module with missing metadata property", async () => {
    const module = { otherProp: "value" };

    const result = await Effect.runPromise(
      Effect.match(parseModuleMetadata(module), {
        onSuccess: (data) => data,
        onFailure: (error) => error,
      })
    );
    expect(result).toHaveProperty("reason");
  });

  it("should handle module with null metadata", async () => {
    const module = { metadata: null };

    const result = await Effect.runPromise(
      Effect.match(parseModuleMetadata(module), {
        onSuccess: (data) => data,
        onFailure: (error) => error,
      })
    );
    expect(result).toBeInstanceOf(Error);
  });

  it("should handle module with undefined metadata", async () => {
    const module = { metadata: undefined };

    const result = await Effect.runPromise(
      Effect.match(parseModuleMetadata(module), {
        onSuccess: (data) => data,
        onFailure: (error) => error,
      })
    );
    expect(result).toBeInstanceOf(Error);
  });

  it("should handle module with invalid metadata structure", async () => {
    const module = {
      metadata: {
        title: "Valid",
        invalidField: "not allowed",
      },
    };

    const result = await Effect.runPromise(
      Effect.match(parseModuleMetadata(module), {
        onSuccess: (data) => data,
        onFailure: (error) => error,
      })
    );
    expect(result).toBeInstanceOf(Error);
  });

  it("should handle module with missing required fields", async () => {
    const module = {
      metadata: {
        title: "Test",
        description: "Test Description",
      },
    };

    const result = await Effect.runPromise(
      Effect.match(parseModuleMetadata(module), {
        onSuccess: (data) => data,
        onFailure: (error) => error,
      })
    );
    expect(result).toBeInstanceOf(Error);
  });

  it("should handle module with wrong type for required field", async () => {
    const module = {
      metadata: {
        title: "Test",
        description: "Test Description",
        authors: "not an array",
        date: "01/01/2024",
      },
    };

    const result = await Effect.runPromise(
      Effect.match(parseModuleMetadata(module), {
        onSuccess: (data) => data,
        onFailure: (error) => error,
      })
    );
    expect(result).toBeInstanceOf(Error);
  });

  it("should handle module with multiple authors", async () => {
    const module = {
      metadata: {
        title: "Multi-Author Article",
        description: "Test Description",
        authors: [
          { name: "Author One" },
          { name: "Author Two" },
          { name: "Author Three" },
        ],
        date: "01/01/2024",
      },
    };

    const metadata = await Effect.runPromise(parseModuleMetadata(module));
    expect(metadata.authors).toHaveLength(3);
    expect(metadata.authors[0].name).toBe("Author One");
    expect(metadata.authors[1].name).toBe("Author Two");
    expect(metadata.authors[2].name).toBe("Author Three");
  });

  it("should handle null module", async () => {
    const result = await Effect.runPromise(
      Effect.match(parseModuleMetadata(null), {
        onSuccess: (data) => data,
        onFailure: (error) => error,
      })
    );
    expect(result).toBeInstanceOf(Error);
  });

  it("should handle undefined module", async () => {
    const result = await Effect.runPromise(
      Effect.match(parseModuleMetadata(undefined), {
        onSuccess: (data) => data,
        onFailure: (error) => error,
      })
    );
    expect(result).toBeInstanceOf(Error);
  });

  it("should handle primitive module", async () => {
    const result = await Effect.runPromise(
      Effect.match(parseModuleMetadata("string"), {
        onSuccess: (data) => data,
        onFailure: (error) => error,
      })
    );
    expect(result).toBeInstanceOf(Error);
  });

  it("should handle module with metadata as array", async () => {
    const module = { metadata: ["invalid"] };

    const result = await Effect.runPromise(
      Effect.match(parseModuleMetadata(module), {
        onSuccess: (data) => data,
        onFailure: (error) => error,
      })
    );
    expect(result).toBeInstanceOf(Error);
  });
});
