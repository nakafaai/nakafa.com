import { afterEach, describe, expect, it, vi } from "vitest";

const { mockGetScopedContent, mockGetScopedContents } = vi.hoisted(() => ({
  mockGetScopedContent: vi.fn(),
  mockGetScopedContents: vi.fn(),
}));

vi.mock("@repo/contents/_lib/scoped", () => ({
  getScopedContent: mockGetScopedContent,
  getScopedContents: mockGetScopedContents,
}));

import {
  getSubjectContent,
  getSubjectContents,
} from "@repo/contents/_lib/subject/content";

describe("getSubjectContent", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("delegates subject content loading with explicit options", () => {
    getSubjectContent(
      "en",
      "subject/high-school/10/mathematics/algebra/basic-concept",
      { includeMDX: false }
    );

    expect(mockGetScopedContent).toHaveBeenCalledWith(
      "subject",
      expect.any(Function),
      "en",
      "subject/high-school/10/mathematics/algebra/basic-concept",
      { includeMDX: false }
    );
  });

  it("delegates subject content loading with default options", () => {
    getSubjectContent(
      "en",
      "subject/high-school/10/mathematics/algebra/basic-concept"
    );

    expect(mockGetScopedContent).toHaveBeenCalledWith(
      "subject",
      expect.any(Function),
      "en",
      "subject/high-school/10/mathematics/algebra/basic-concept",
      {}
    );
  });
});

describe("getSubjectContents", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("delegates subject list loading with explicit options", () => {
    getSubjectContents({
      basePath: "subject/high-school",
      includeMDX: false,
      locale: "en",
    });

    expect(mockGetScopedContents).toHaveBeenCalledWith(
      "subject",
      expect.any(Function),
      {
        basePath: "subject/high-school",
        includeMDX: false,
        locale: "en",
      }
    );
  });

  it("delegates subject list loading with default options", () => {
    getSubjectContents();

    expect(mockGetScopedContents).toHaveBeenCalledWith(
      "subject",
      expect.any(Function),
      {}
    );
  });
});
