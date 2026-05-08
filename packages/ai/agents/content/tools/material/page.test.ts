import { fetchPage } from "@repo/ai/agents/content/tools/material/page";
import type { MyUIMessage } from "@repo/ai/types/message";
import { getContent } from "@repo/contents/_lib/content";
import { InvalidPathError } from "@repo/contents/_shared/error";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/contents/_lib/content", () => ({
  getContent: vi.fn(),
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

describe("material/page", () => {
  it("fetches page content through the contents package", async () => {
    vi.mocked(getContent).mockReturnValue(
      Effect.succeed({
        metadata: {
          title: "Rational Function",
          authors: [{ name: "Nakafa" }],
          date: "05/08/2026",
          description: "Rational function lesson.",
        },
        raw: "Raw lesson",
      })
    );
    const { parts, writer } = createWriter();

    const output = await Effect.runPromise(
      fetchPage({
        cleanedSlug:
          "subject/high-school/11/mathematics/function-modeling/rational-function",
        contentInput: {
          locale: "id",
          slug: "subject/high-school/11/mathematics/function-modeling/rational-function",
        },
        toolCallId: "tool-1",
        url: "https://nakafa.com/id/subject/high-school/11/mathematics/function-modeling/rational-function",
        writer,
      })
    );

    expect(output).toContain("Raw lesson");
    expect(parts.at(-1)).toMatchObject({
      data: {
        title: "Rational Function",
        description: "Rational function lesson.",
        status: "done",
      },
    });
    expect(getContent).toHaveBeenCalledWith(
      "id",
      "subject/high-school/11/mathematics/function-modeling/rational-function",
      { includeMDX: false }
    );
  });

  it("uses an empty description when content metadata has no description", async () => {
    vi.mocked(getContent).mockReturnValue(
      Effect.succeed({
        metadata: {
          title: "Rational Function",
          authors: [{ name: "Nakafa" }],
          date: "05/08/2026",
        },
        raw: "Raw lesson",
      })
    );
    const { parts, writer } = createWriter();

    await Effect.runPromise(
      fetchPage({
        cleanedSlug:
          "subject/high-school/11/mathematics/function-modeling/rational-function",
        contentInput: {
          locale: "id",
          slug: "subject/high-school/11/mathematics/function-modeling/rational-function",
        },
        toolCallId: "tool-1",
        url: "https://nakafa.com/id/subject/high-school/11/mathematics/function-modeling/rational-function",
        writer,
      })
    );

    expect(parts.at(-1)).toMatchObject({
      data: {
        description: "",
        status: "done",
      },
    });
  });

  it("writes an error part when page content is missing", async () => {
    vi.mocked(getContent).mockReturnValue(
      Effect.fail(
        new InvalidPathError({
          path: "subject/missing",
          reason: "missing",
        })
      )
    );
    const { parts, writer } = createWriter();

    const output = await Effect.runPromise(
      fetchPage({
        cleanedSlug: "subject/missing",
        contentInput: { locale: "id", slug: "subject/missing" },
        toolCallId: "tool-1",
        url: "https://nakafa.com/id/subject/missing",
        writer,
      })
    );

    expect(output).toContain("Content not found");
    expect(parts.at(-1)).toMatchObject({
      data: {
        status: "error",
        error:
          "Content not found. Maybe not available or still in development.",
      },
    });
  });
});
