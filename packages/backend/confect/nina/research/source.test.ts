import { describe, expect, it } from "@effect/vitest";
import { withTurnContext } from "@repo/backend/confect/nina/prompt/user";
import {
  getNakafaReferencesFromMessages,
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

const nakafaLesson =
  "https://nakafa.com/en/subject/high-school/10/mathematics/exponential/basic-concept";
const nakafaQuran = "https://www.nakafa.com/id/quran/1";
/** The address Nakafa reads for `nakafaQuran`: the production origin. */
const nakafaQuranAddress = "https://nakafa.com/id/quran/1";
const nakafaMessages = [
  { content: `Jelaskan ${nakafaLesson} dan ${nakafaQuran}.`, role: "user" },
] satisfies ModelMessage[];
const staleNakafaMessages = [
  { content: `Jelaskan ${nakafaLesson}.`, role: "user" },
  { content: "Sudah.", role: "assistant" },
  { content: "Sekarang hitung 2 + 2.", role: "user" },
] satisfies ModelMessage[];

/** The addresses of references, in the order found. */
const hrefs = (references: ReturnType<typeof getSourceReferences>) =>
  Arr.map(references, (reference) => reference.href);

/** The addresses Nakafa reads for the links to its own site in one message of a learner. */
const nakafaAddresses = (text: string) =>
  hrefs(getNakafaReferencesFromMessages([{ content: text, role: "user" }]));

describe("lib/source", () => {
  it("keeps links to Nakafa's own site out of the outside sources, and finds them apart", () => {
    const text = `Bandingkan ${nakafaLesson}, ${nakafaQuran}, ai-sdk.dev/docs dan api.nakafa.com/docs.`;

    expect(hrefs(getSourceReferences(text))).toEqual([
      "https://ai-sdk.dev/docs",
      "https://api.nakafa.com/docs",
    ]);
    expect(nakafaAddresses(text)).toEqual([nakafaLesson, nakafaQuranAddress]);
  });

  it("reads every spelling of a link to Nakafa's own site as one address on the production origin", () => {
    expect(
      nakafaAddresses(
        "http://nakafa.com/en/articles/a https://www.nakafa.com/en/articles/a?x=1#top HTTP://NAKAFA.COM:8080/en/articles/a nakafa.com/en/articles/a https://nakafa.com//evil.com/path"
      )
    ).toEqual([
      "https://nakafa.com/en/articles/a",
      "https://nakafa.com/en/articles/a?x=1#top",
      "https://nakafa.com//evil.com/path",
    ]);
  });

  it("reads the Nakafa links of the latest user request only", () => {
    expect(hrefs(getNakafaReferencesFromMessages(nakafaMessages))).toEqual([
      nakafaLesson,
      nakafaQuranAddress,
    ]);
    expect(getSourceReferencesFromMessages(nakafaMessages)).toEqual([]);
    expect(getNakafaReferencesFromMessages(assistantOnlyMessages)).toEqual([]);
    expect(getNakafaReferencesFromMessages(staleNakafaMessages)).toEqual([]);
  });

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
    // That page is a Nakafa address, and the learner did not send it either.
    expect(getNakafaReferencesFromMessages([message])).toEqual([]);
    expect(
      Arr.map(
        getNakafaReferencesFromMessages([
          withTurnContext(
            {
              role: "user",
              content: "Baca https://nakafa.com/id/materi/matematika",
            },
            "Current page:\n- url: https://nakafa.com/en/home"
          ),
        ]),
        (link) => link.href
      )
    ).toEqual(["https://nakafa.com/id/materi/matematika"]);
  });
});
