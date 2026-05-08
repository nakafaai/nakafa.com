import { getSubjects } from "@repo/ai/agents/content/tools/subjects";
import type { MyUIMessage } from "@repo/ai/types/message";
import { getSubjectContents } from "@repo/contents/_lib/subject/content";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/contents/_lib/subject/content", () => ({
  getSubjectContents: vi.fn(),
}));

/**
 * Creates a test writer that records AI SDK UI message stream parts.
 */
function createWriter() {
  const parts: Parameters<UIMessageStreamWriter<MyUIMessage>["write"]>[0][] =
    [];
  const writer = {
    onError: undefined,
    merge(stream) {
      stream.getReader().releaseLock();
    },
    write(part) {
      parts.push(part);
    },
  } satisfies UIMessageStreamWriter<MyUIMessage>;

  return { parts, writer };
}

describe("content/subjects", () => {
  it("fetches subjects by full path through the contents package", async () => {
    vi.mocked(getSubjectContents).mockReturnValue(
      Effect.succeed([
        {
          metadata: {
            title: "Functions",
            authors: [{ name: "Nakafa" }],
            date: "05/08/2026",
          },
          raw: "",
          url: "https://nakafa.com/id/subject/high-school/11/mathematics/functions",
          slug: "subject/high-school/11/mathematics/functions",
          locale: "id",
        },
      ])
    );
    const { parts, writer } = createWriter();

    const output = await Effect.runPromise(
      getSubjects({
        input: {
          locale: "id",
          category: "high-school",
          grade: "11",
          material: "mathematics",
        },
        toolCallId: "tool-1",
        writer,
      })
    );

    expect(output).toContain("Functions");
    expect(parts.at(-1)).toMatchObject({
      data: {
        baseUrl: "/id/subject/high-school/11/mathematics",
        status: "done",
        subjects: [
          {
            title: "Functions",
            url: "https://nakafa.com/id/subject/high-school/11/mathematics/functions",
            slug: "subject/high-school/11/mathematics/functions",
            locale: "id",
          },
        ],
      },
    });
    expect(getSubjectContents).toHaveBeenCalledWith({
      locale: "id",
      basePath: "subject/high-school/11/mathematics",
      includeMDX: false,
    });
  });
});
