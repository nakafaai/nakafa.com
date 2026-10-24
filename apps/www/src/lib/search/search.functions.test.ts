// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { searchHandler } from "@/lib/search/search.functions";

const mocks = vi.hoisted(() => ({
  readSearchHandler: vi.fn(),
}));

vi.mock("@/lib/search/search.server", () => ({
  readSearchHandler: mocks.readSearchHandler,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("content search function", () => {
  it("hands the request to the search read and answers with the results it returns", async () => {
    const results = [{ title: "Integral" }];
    mocks.readSearchHandler.mockResolvedValueOnce(results);

    const answer = await searchHandler({
      data: { locale: "en", query: "integral" },
    });

    expect(mocks.readSearchHandler).toHaveBeenCalledWith({
      data: { locale: "en", query: "integral" },
    });
    expect(answer).toStrictEqual(results);
  });
});
