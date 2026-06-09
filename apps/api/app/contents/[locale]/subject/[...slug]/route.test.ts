import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as route from "./route";

const runtimeMocks = vi.hoisted(() => ({
  getSubjectApiContentPage: vi.fn(),
}));

vi.mock("@/lib/content/runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/content/runtime")>();

  return {
    ...actual,
    getSubjectApiContentPage: runtimeMocks.getSubjectApiContentPage,
  };
});

const subjectRow = {
  description: "Logarithm lesson.",
  locale: "id",
  route:
    "subject/high-school/10/mathematics/exponential-logarithm/logarithm-definition",
  slug: "logarithm-definition",
  title: "Definisi Logaritma",
};

describe("subject content API route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the legacy array shape when pagination is not requested", async () => {
    runtimeMocks.getSubjectApiContentPage.mockReturnValue(
      Effect.succeed({
        continueCursor: "",
        isDone: true,
        page: [subjectRow],
      })
    );

    const response = await route.GET(
      new Request(
        "http://localhost/contents/id/subject/high-school/10/mathematics"
      ),
      {
        params: Promise.resolve({
          locale: "id",
          slug: ["high-school", "10", "mathematics"],
        }),
      }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([subjectRow]);
    expect(runtimeMocks.getSubjectApiContentPage).toHaveBeenCalledWith({
      cursor: null,
      limit: 100,
      locale: "id",
      prefix: "subject/high-school/10/mathematics",
    });
  });

  it("rejects oversized default responses instead of silently truncating", async () => {
    runtimeMocks.getSubjectApiContentPage.mockReturnValue(
      Effect.succeed({
        continueCursor: "next-cursor",
        isDone: false,
        page: [subjectRow],
      })
    );

    const response = await route.GET(
      new Request(
        "http://localhost/contents/id/subject/high-school/10/mathematics"
      ),
      {
        params: Promise.resolve({
          locale: "id",
          slug: ["high-school", "10", "mathematics"],
        }),
      }
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error:
        "Content list exceeds the legacy response limit. Use cursor/limit pagination.",
    });
  });
});
