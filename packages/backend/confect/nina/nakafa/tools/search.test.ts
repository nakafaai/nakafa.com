import { afterEach, describe, expect, it } from "@effect/vitest";
import { searchNakafaContent } from "@repo/backend/agent/search";
import { search } from "@repo/backend/confect/nina/nakafa/tools/search";
import {
  recordProgress,
  runSpecialist,
} from "@repo/backend/test/nina/specialist";
import { NakafaAgentDataReadError } from "@repo/contents/agent/errors";
import { readNakafaContentRefFixture } from "@repo/contents/agent/fixture";
import { Effect } from "effect";

vi.mock("@repo/backend/agent/search", () => ({ searchNakafaContent: vi.fn() }));
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
      vi.mocked(searchNakafaContent).mockReturnValue(Effect.succeed(expected));
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
      expect(searchNakafaContent).toHaveBeenCalledWith({
        ...input,
        locale: "id",
      });
      expect(output.result).toEqual(expected);
      expect(output.text).toContain(item.title);
      expect(artifacts).toMatchObject([
        {
          id: "search-1",
          data: { status: "loading", input: { locale: "id" } },
        },
        { id: "search-1", data: { status: "done", result: expected } },
      ]);
    }
  );
  it("keeps failed retrieval distinct from an empty search", async () => {
    vi.mocked(searchNakafaContent).mockReturnValue(
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
    expect(artifacts.at(-1)).toMatchObject({
      data: { status: "error", error: output.text },
    });
  });
});
