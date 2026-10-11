import { describe, expect, it } from "@effect/vitest";
import { withTurnContext } from "@repo/backend/confect/nina/prompt/user";
import {
  getSourceReferences,
  getSourceReferencesFromMessages,
} from "@repo/backend/confect/nina/research/source";
import type { ModelMessage } from "ai";
import { Array as Arr } from "effect";

const sourceMessages = [
  {
    content: "Sebelumnya tanpa sumber.",
    role: "user",
  },
  {
    content: "Baik, aku bisa jawab langsung.",
    role: "assistant",
  },
  {
    content: "Baca ai-sdk.dev/docs dan docs.convex.dev/database dulu.",
    role: "user",
  },
] satisfies ModelMessage[];

const sourcePartMessages = [
  {
    content: [
      {
        data: "ignored",
        mediaType: "text/plain",
        type: "file",
      },
      {
        text: "Bandingkan dengan https://docs.convex.dev/database.",
        type: "text",
      },
    ],
    role: "user",
  },
] satisfies ModelMessage[];

const assistantOnlyMessages = [
  {
    content: "Aku bisa cek docs.convex.dev kalau dibutuhkan.",
    role: "assistant",
  },
] satisfies ModelMessage[];
const staleSourceMessages = [
  {
    content: "Baca https://ai-sdk.dev/docs dulu.",
    role: "user",
  },
  {
    content: "Sudah.",
    role: "assistant",
  },
  {
    content: "Sekarang hitung 2 + 2.",
    role: "user",
  },
] satisfies ModelMessage[];

describe("lib/source", () => {
  it("extracts full URLs, bare domains, and markdown-wrapped URLs", () => {
    expect(
      Arr.map(
        getSourceReferences(
          "Baca ai-sdk.dev/docs, [Convex](HTTPS://docs.convex.dev/database), [Example](http://example.com/research), dan www.google.com."
        ),
        (source) => source.href
      )
    ).toEqual([
      "https://ai-sdk.dev/docs",
      "https://docs.convex.dev/database",
      "http://example.com/research",
      "https://www.google.com/",
    ]);
  });

  it("deduplicates repeated source references in order", () => {
    expect(
      Arr.map(
        getSourceReferences(
          "Baca https://ai-sdk.dev/docs lalu ai-sdk.dev/docs lagi."
        ),
        (source) => source.href
      )
    ).toEqual(["https://ai-sdk.dev/docs"]);
  });

  it("extracts multiple sources separated by punctuation", () => {
    expect(
      Arr.map(
        getSourceReferences(
          "Bandingkan ai-sdk.dev/docs,docs.convex.dev/understanding;https://effect.website/docs."
        ),
        (source) => source.href
      )
    ).toEqual([
      "https://ai-sdk.dev/docs",
      "https://docs.convex.dev/understanding",
      "https://effect.website/docs",
    ]);
  });

  it("keeps separator characters that belong to one URL", () => {
    expect(
      Arr.map(
        getSourceReferences("Baca https://example.com/search?q=a,b."),
        (source) => source.href
      )
    ).toEqual(["https://example.com/search?q=a,b"]);
  });

  it("preserves balanced parentheses that belong to one URL", () => {
    expect(
      Arr.map(
        getSourceReferences(
          "Baca [Function](https://en.wikipedia.org/wiki/Function_(mathematics))."
        ),
        (source) => source.href
      )
    ).toEqual(["https://en.wikipedia.org/wiki/Function_(mathematics)"]);
  });

  it("preserves at signs that belong to URL path segments", () => {
    expect(
      Arr.map(
        getSourceReferences(
          "Baca https://www.npmjs.com/package/@modelcontextprotocol/sdk."
        ),
        (source) => source.href
      )
    ).toEqual(["https://www.npmjs.com/package/@modelcontextprotocol/sdk"]);
  });

  it("ignores decimals, emails, userinfo URLs, and localhost references", () => {
    expect(getSourceReferences("Hitung 3.14 + 2.")).toEqual([]);
    expect(getSourceReferences("Kirim ke nina@example.com.")).toEqual([]);
    expect(getSourceReferences("Buka https://user@example.com.")).toEqual([]);
    expect(getSourceReferences("Aku sedang di localhost:3000.")).toEqual([]);
    expect(
      getSourceReferences("Token rusak not%url dan suffix co.uk.")
    ).toEqual([]);
  });

  it("reads only the latest user request", () => {
    expect(
      Arr.map(
        getSourceReferencesFromMessages(sourceMessages),
        (source) => source.href
      )
    ).toEqual(["https://ai-sdk.dev/docs", "https://docs.convex.dev/database"]);
    expect(getSourceReferencesFromMessages(sourcePartMessages)).toHaveLength(1);
    expect(getSourceReferencesFromMessages(assistantOnlyMessages)).toEqual([]);
    expect(getSourceReferencesFromMessages(staleSourceMessages)).toEqual([]);
  });

  it("does not take the page of the runtime facts for a source the learner named", () => {
    const message = withTurnContext(
      { role: "user", content: "Baca https://ai-sdk.dev/docs" },
      "# Runtime Context\n\nCurrent page:\n- url: https://nakafa.com/en/home"
    );
    expect(
      Arr.map(
        getSourceReferencesFromMessages([message]),
        (source) => source.href
      )
    ).toEqual(["https://ai-sdk.dev/docs"]);
    expect(
      getSourceReferencesFromMessages([
        withTurnContext(
          { role: "user", content: "Jelaskan limit" },
          "Current page:\n- url: https://nakafa.com/en/home"
        ),
      ])
    ).toEqual([]);
  });
});
