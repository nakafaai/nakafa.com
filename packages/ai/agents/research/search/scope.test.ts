import { scopeSources } from "@repo/ai/agents/research/search/scope";
import { describe, expect, it } from "vitest";

describe("scopeSources", () => {
  it("prefers first-party product domains when primary sources are requested", () => {
    const sources = scopeSources({
      query: "Next.js 16 release notes cache components",
      task: "Next.js 16 Cache Components",
      sourcePreference: "primary",
      sources: [
        {
          content: "Next.js 16 introduces Cache Components.",
          description: "Official Next.js release notes.",
          title: "Next.js 16",
          url: "https://nextjs.org/blog/next-16",
        },
        {
          content: "Next.js 16 cache components guide.",
          description: "Community explanation.",
          title: "Cache Components Guide",
          url: "https://example.com/nextjs-cache-components",
        },
      ],
    });

    expect(sources.map((source) => source.url)).toEqual([
      "https://nextjs.org/blog/next-16",
    ]);
  });

  it("keeps secondary sources when no official constraint is present", () => {
    const sources = scopeSources({
      query: "Next.js 16 cache components",
      sourcePreference: "any",
      task: "Next.js 16 cache components",
      sources: [
        {
          content: "Next.js 16 introduces Cache Components.",
          description: "Official Next.js release notes.",
          title: "Next.js 16",
          url: "https://nextjs.org/blog/next-16",
        },
        {
          content: "Next.js 16 cache components guide.",
          description: "Community explanation.",
          title: "Cache Components Guide",
          url: "https://example.com/nextjs-cache-components",
        },
      ],
    });

    expect(sources).toHaveLength(2);
  });

  it("does not depend on language-specific source request words", () => {
    const sources = scopeSources({
      query: "React 19 primary docs transitions",
      task: "React 19 transitions",
      sourcePreference: "primary",
      sources: [
        {
          content: "React 19 transition behavior.",
          description: "First-party React documentation.",
          title: "React Reference",
          url: "https://react.dev/reference/react/useTransition",
        },
        {
          content: "React 19 transition behavior.",
          description: "Community tutorial.",
          title: "React Tutorial",
          url: "https://example.com/react-19-transitions",
        },
      ],
    });

    expect(sources.map((source) => source.url)).toEqual([
      "https://react.dev/reference/react/useTransition",
    ]);
  });

  it("does not treat generic words as first-party domain keys", () => {
    const sources = scopeSources({
      query: "Next.js 16 Cache Components",
      task: [
        "# User Request",
        "info pembuat Next.js sendiri",
        "# Constraints",
        "- Gunakan sumber resmi dari Next.js (vercel.com, nextjs.org).",
      ].join("\n"),
      sourcePreference: "primary",
      sources: [
        {
          content: "Next.js 16 introduces Cache Components.",
          description: "Official Next.js release notes.",
          title: "Next.js 16",
          url: "https://nextjs.org/blog/next-16",
        },
        {
          content: "Next.js 16 cache components.",
          description: "Industry report.",
          title: "Next.js 16 release",
          url: "https://www.infoq.com/news/2025/12/nextjs-16-release/",
        },
      ],
    });

    expect(sources.map((source) => source.url)).toEqual([
      "https://nextjs.org/blog/next-16",
    ]);
  });

  it("uses parsed source references for explicit primary domains", () => {
    const sources = scopeSources({
      query: "React 19 transitions",
      task: "tolong cek dari www.react.dev/reference/react/useTransition",
      sourcePreference: "primary",
      sources: [
        {
          content: "React transition behavior.",
          description: "React reference.",
          title: "useTransition",
          url: "https://react.dev/reference/react/useTransition",
        },
        {
          content: "React transition behavior.",
          description: "Community explanation.",
          title: "Tutorial",
          url: "https://example.com/react-transition",
        },
      ],
    });

    expect(sources.map((source) => source.url)).toEqual([
      "https://react.dev/reference/react/useTransition",
    ]);
  });

  it("falls back to query term scoping when the task has no distinctive terms", () => {
    const sources = scopeSources({
      query: "SNBT",
      sourcePreference: "any",
      task: "latihan soal",
      sources: [
        {
          content: "Latihan SNBT kuantitatif.",
          description: "Exercise collection.",
          title: "SNBT",
          url: "https://example.com/snbt",
        },
        {
          content: "Latihan matematika umum.",
          description: "Exercise collection.",
          title: "Matematika",
          url: "https://example.com/math",
        },
      ],
    });

    expect(sources.map((source) => source.url)).toEqual([
      "https://example.com/snbt",
    ]);
  });

  it("keeps all sources when query-only scoping does not match the first source", () => {
    const sources = [
      {
        content: "Latihan matematika umum.",
        description: "Exercise collection.",
        title: "Matematika",
        url: "https://example.com/math",
      },
      {
        content: "Latihan SNBT kuantitatif.",
        description: "Exercise collection.",
        title: "SNBT",
        url: "https://example.com/snbt",
      },
    ];

    expect(
      scopeSources({
        query: "SNBT",
        sourcePreference: "any",
        task: "latihan soal",
        sources,
      })
    ).toEqual(sources);
  });

  it("falls back when primary preference has no usable domain keys", () => {
    const sources = [
      {
        content: "General learning notes.",
        description: "Study guide.",
        title: "Notes",
        url: "https://example.com/notes",
      },
    ];

    expect(
      scopeSources({
        query: "2026",
        sourcePreference: "primary",
        task: "AI",
        sources,
      })
    ).toEqual(sources);
  });

  it("falls back when requested primary domains are not present", () => {
    const sources = [
      {
        content: "Next.js 16 Cache Components overview.",
        description: "Community write-up.",
        title: "Next.js 16 guide",
        url: "https://example.com/nextjs-cache-components",
      },
    ];

    expect(
      scopeSources({
        query: "Next.js 16 Cache Components",
        sourcePreference: "primary",
        task: "Next.js 16 Cache Components",
        sources,
      })
    ).toEqual(sources);
  });

  it("ignores invalid source URLs while matching primary domains", () => {
    const sources = scopeSources({
      query: "React 19 transitions",
      sourcePreference: "primary",
      task: "React 19 transitions",
      sources: [
        {
          content: "React 19 transitions.",
          description: "Malformed source.",
          title: "React 19",
          url: "not a url",
        },
        {
          content: "React 19 transitions.",
          description: "First-party React documentation.",
          title: "React 19",
          url: "https://react.dev/blog/2024/12/05/react-19",
        },
      ],
    });

    expect(sources.map((source) => source.url)).toEqual([
      "https://react.dev/blog/2024/12/05/react-19",
    ]);
  });
});
