import type { ModelMessage } from "ai";
import { describe, expect, it } from "vitest";
import { getSourceReferences, getSourceReferencesFromMessages } from "./source";

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
      getSourceReferences(
        "Baca ai-sdk.dev/docs, [Convex](HTTPS://docs.convex.dev/database), [Example](http://example.com/research), dan www.google.com."
      ).map((source) => source.href)
    ).toEqual([
      "https://ai-sdk.dev/docs",
      "https://docs.convex.dev/database",
      "http://example.com/research",
      "https://www.google.com/",
    ]);
  });

  it("deduplicates repeated source references in order", () => {
    expect(
      getSourceReferences(
        "Baca https://ai-sdk.dev/docs lalu ai-sdk.dev/docs lagi."
      ).map((source) => source.href)
    ).toEqual(["https://ai-sdk.dev/docs"]);
  });

  it("extracts multiple sources separated by punctuation", () => {
    expect(
      getSourceReferences(
        "Bandingkan ai-sdk.dev/docs,docs.convex.dev/understanding;https://effect.website/docs."
      ).map((source) => source.href)
    ).toEqual([
      "https://ai-sdk.dev/docs",
      "https://docs.convex.dev/understanding",
      "https://effect.website/docs",
    ]);
  });

  it("keeps separator characters that belong to one URL", () => {
    expect(
      getSourceReferences("Baca https://example.com/search?q=a,b.").map(
        (source) => source.href
      )
    ).toEqual(["https://example.com/search?q=a,b"]);
  });

  it("ignores decimals, emails, and localhost references", () => {
    expect(getSourceReferences("Hitung 3.14 + 2.")).toEqual([]);
    expect(getSourceReferences("Kirim ke nina@example.com.")).toEqual([]);
    expect(getSourceReferences("Aku sedang di localhost:3000.")).toEqual([]);
    expect(
      getSourceReferences("Token rusak not%url dan suffix co.uk.")
    ).toEqual([]);
  });

  it("reads only the latest user request", () => {
    expect(
      getSourceReferencesFromMessages(sourceMessages).map(
        (source) => source.href
      )
    ).toEqual(["https://ai-sdk.dev/docs", "https://docs.convex.dev/database"]);
    expect(getSourceReferencesFromMessages(sourcePartMessages)).toHaveLength(1);
    expect(getSourceReferencesFromMessages(assistantOnlyMessages)).toEqual([]);
    expect(getSourceReferencesFromMessages(staleSourceMessages)).toEqual([]);
  });
});
