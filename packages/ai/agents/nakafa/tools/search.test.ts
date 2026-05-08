import { search } from "@repo/ai/agents/nakafa/tools/search";
import { createWriter } from "@repo/ai/agents/nakafa/tools/test";
import { Nakafa } from "@repo/contents/_lib/agent/service";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("nakafa search tool", () => {
  it("writes loading and done parts for search results", async () => {
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      search({
        input: {
          limit: 1,
          locale: "en",
          offset: 0,
          query: "quran",
          section: "quran",
        },
        toolCallId: "search-1",
        writer,
      }).pipe(Effect.provide(Nakafa.Default))
    );

    expect(output).toContain("# Nakafa Search");
    expect(parts).toEqual([
      expect.objectContaining({
        type: "data-nakafa",
        data: expect.objectContaining({ kind: "search", status: "loading" }),
      }),
      expect.objectContaining({
        type: "data-nakafa",
        data: expect.objectContaining({
          kind: "search",
          status: "done",
          result: expect.objectContaining({ count: 1 }),
        }),
      }),
    ]);
  });

  it("writes an error part for invalid search input", async () => {
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      search({
        input: {
          limit: 99,
          locale: "en",
          offset: 0,
        },
        toolCallId: "search-2",
        writer,
      }).pipe(Effect.provide(Nakafa.Default))
    );

    expect(output).toBe("Invalid Nakafa content search options.");
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "search", status: "error" }),
      })
    );
  });

  it("formats empty search results without a next offset", async () => {
    const { writer } = createWriter();
    const output = await Effect.runPromise(
      search({
        input: {
          limit: 1,
          locale: "en",
          offset: 0,
          query: "no matching nakafa content",
        },
        toolCallId: "search-3",
        writer,
      }).pipe(Effect.provide(Nakafa.Default))
    );

    expect(output).toContain("- Next offset: none");
  });
});
