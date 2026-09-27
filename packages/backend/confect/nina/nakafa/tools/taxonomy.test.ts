import { afterEach, describe, expect, it } from "@effect/vitest";
import { getNakafaTaxonomy } from "@repo/backend/agent/taxonomy";
import { taxonomy } from "@repo/backend/confect/nina/nakafa/tools/taxonomy";
import {
  recordProgress,
  runSpecialist,
} from "@repo/backend/test/nina/specialist";
import { NakafaAgentDataReadError } from "@repo/contents/agent/errors";
import { Effect } from "effect";

vi.mock("@repo/backend/agent/taxonomy", () => ({ getNakafaTaxonomy: vi.fn() }));
afterEach(() => vi.restoreAllMocks());

describe("Nina taxonomy evidence", () => {
  it("uses the turn locale and publishes the bounded signed inventory", async () => {
    vi.mocked(getNakafaTaxonomy).mockReturnValue(
      Effect.succeed({
        articles: { categories: ["science"] },
        content_counts: [{ count: 12, locale: "id" }],
        default_locale: "en",
        endpoints: {
          direct: "https://mcp.nakafa.com/mcp",
          recommended: "https://mcp.nakafa.com/mcp",
          root_note: "Information",
        },
        locale: "id",
        locales: ["en", "id", "de"],
        quran: { surah_count: 114 },
        sections: ["articles"],
        tryout: { countries: [], exams: [] },
        tools: ["nakafa_search_content"],
      })
    );
    const { artifacts, publish } = recordProgress();
    const text = await runSpecialist(() =>
      taxonomy({
        input: { locale: "en" },
        locale: "id",
        publish,
        toolCallId: "taxonomy",
      })
    );
    expect(getNakafaTaxonomy).toHaveBeenCalledWith("id");
    expect(text).toContain("science");
    expect(artifacts).toMatchObject([
      { data: { status: "loading", input: { locale: "id" } } },
      {
        data: {
          status: "done",
          result: {
            sections: ["articles"],
            content_counts: [{ count: 12, locale: "id" }],
          },
        },
      },
    ]);
  });
  it("does not turn a publication failure into an empty inventory", async () => {
    vi.mocked(getNakafaTaxonomy).mockReturnValue(
      Effect.fail(
        new NakafaAgentDataReadError({
          message: "Publication verification failed.",
        })
      )
    );
    const { artifacts, publish } = recordProgress();
    const error = await runSpecialist(() =>
      taxonomy({
        input: { locale: "en" },
        locale: "id",
        publish,
        toolCallId: "taxonomy",
      }).pipe(
        Effect.flip,
        Effect.map(({ _tag, message }) => ({ _tag, message }))
      )
    );
    expect(error).toEqual({
      _tag: "NakafaAgentDataReadError",
      message: "Publication verification failed.",
    });
    expect(artifacts).toHaveLength(1);
  });
});
