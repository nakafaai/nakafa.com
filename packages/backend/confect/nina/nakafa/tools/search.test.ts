import { afterEach, describe, expect, it } from "@effect/vitest";
import { findContent } from "@repo/backend/confect/nina/nakafa/find";
import { search } from "@repo/backend/confect/nina/nakafa/tools/search";
import {
  recordProgress,
  runSpecialist,
} from "@repo/backend/test/nina/specialist";
import { NakafaAgentDataReadError } from "@repo/contents/agent/errors";
import { readNakafaContentRefFixture } from "@repo/contents/test/fixture";
import { Array as Arr, Effect, MutableList, Option } from "effect";

vi.mock("@repo/backend/confect/nina/nakafa/find", () => ({
  findContent: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());

describe("Nina content search", () => {
  it.each([false, true])(
    "preserves pagination and optional filters %s under the turn locale",
    async (filtered) => {
      const item = {
        ...readNakafaContentRefFixture(
          "id",
          "articles/science/limits",
          "articles"
        ),
        title: "Batas fungsi",
        description: "Limit",
        excerpt: "Penjelasan limit.",
      };
      const expected = {
        count: 1,
        items: [item],
        limit: 10,
        offset: 20,
        has_more: true,
      };
      vi.mocked(findContent).mockReturnValue(
        Effect.succeed({ result: expected, text: `Found ${item.title}.` })
      );
      const input = {
        locale: "en" as const,
        limit: 10,
        offset: 20,
        ...(filtered
          ? { queries: ["limit"], section: "articles" as const }
          : {}),
      };
      const { artifacts, publish } = recordProgress();
      const output = await runSpecialist(() =>
        search({ input, locale: "id", publish, toolCallId: "search" })
      );
      expect(findContent).toHaveBeenCalledWith({ ...input, locale: "id" });
      expect(output.result).toEqual(expected);
      expect(output.text).toContain(item.title);
      expect(MutableList.toArray(artifacts)).toMatchObject([
        {
          id: "search-1",
          data: { status: "loading", input: { locale: "id" } },
        },
        { id: "search-1", data: { status: "done", result: expected } },
      ]);
    }
  );
  it("keeps failed retrieval distinct from an empty search", async () => {
    vi.mocked(findContent).mockReturnValue(
      Effect.fail(
        new NakafaAgentDataReadError({ message: "Search verification failed." })
      )
    );
    const { artifacts, publish } = recordProgress();
    const output = await runSpecialist(() =>
      search({
        input: { locale: "en", limit: 10, offset: 0 },
        locale: "en",
        publish,
        toolCallId: "search",
      })
    );
    expect(output).toEqual({
      result: null,
      text: "Search verification failed.",
    });
    expect(
      Option.getOrThrow(Arr.last(MutableList.toArray(artifacts)))
    ).toMatchObject({
      data: { status: "error", error: output.text },
    });
  });
});
