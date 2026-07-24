import {
  ContentTransportError,
  PublicContentMissingError,
} from "@repo/backend/client/content/errors";
import { readPublicContent } from "@repo/backend/client/content/read";
import {
  readMdxMarkdown,
  readNakafaMarkdown,
} from "@repo/backend/client/nakafa/markdown";
import { readQuranMarkdown } from "@repo/backend/client/nakafa/quran";
import { resolveNakafaContentRef } from "@repo/backend/client/nakafa/ref";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { Effect, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const contentMocks = vi.hoisted(() => ({
  projectMdxForAgentMarkdown: vi.fn(),
  readPublicContent: vi.fn(),
  readQuranMarkdown: vi.fn(),
  resolveNakafaContentRef: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/backend/client/content/read", () => ({
  readPublicContent: contentMocks.readPublicContent,
}));
vi.mock("@repo/backend/client/nakafa/quran", () => ({
  readQuranMarkdown: contentMocks.readQuranMarkdown,
}));
vi.mock("@repo/backend/client/nakafa/ref", () => ({
  resolveNakafaContentRef: contentMocks.resolveNakafaContentRef,
}));
vi.mock("@repo/contents/_types/llms/mdx", () => ({
  projectMdxForAgentMarkdown: contentMocks.projectMdxForAgentMarkdown,
}));

const contentTarget = {
  siteUrl: "https://example.convex.site",
  token: "runtime-token",
};
const articleRef = readNakafaContentRefFixture(
  "en",
  "articles/politics/example",
  "articles"
);
const materialRef = readNakafaContentRefFixture(
  "id",
  "material/lesson/mathematics/example-topic/example-section",
  "material"
);
const quranRef = readNakafaContentRefFixture("en", "quran/1", "quran");
const tryoutRef = readNakafaContentRefFixture(
  "id",
  "try-out/indonesia/snbt/2027/set-1/penalaran-umum",
  "tryout"
);

beforeEach(() => {
  vi.clearAllMocks();
  contentMocks.projectMdxForAgentMarkdown.mockReturnValue(
    Effect.succeed("Projected signed body.")
  );
});

describe("Nakafa signed markdown", () => {
  it("reads an article while preserving its canonical public reference", async () => {
    contentMocks.readPublicContent.mockReturnValue(
      Effect.succeed(makeFound("article", "Signed article", "Description."))
    );

    const result = await Effect.runPromise(
      readMdxMarkdown(contentTarget, articleRef)
    );
    const markdown = Option.getOrThrow(result);

    expect(markdown).toMatchObject({
      route: articleRef.route,
      url: articleRef.url,
      markdown_url: articleRef.markdown_url,
      description: "Description.",
      title: "Signed article",
      text: "# Signed article\n\nProjected signed body.",
    });
    expect(readPublicContent).toHaveBeenCalledWith(contentTarget, {
      locale: "en",
      publicPath: articleRef.route,
    });
  });

  it("uses a material subject when signed metadata has no description", async () => {
    contentMocks.readPublicContent.mockReturnValue(
      Effect.succeed(makeFound("subject-lesson", "Konsep Fungsi", undefined))
    );

    const result = await Effect.runPromise(
      readMdxMarkdown(contentTarget, materialRef)
    );

    expect(Option.getOrThrow(result)).toMatchObject({
      description: "Mathematics",
      route: materialRef.route,
      title: "Konsep Fungsi",
    });
  });

  it("uses an empty description when optional signed metadata is absent", async () => {
    contentMocks.readPublicContent.mockReturnValue(
      Effect.succeed(makeFound("article", "Signed article", undefined, false))
    );

    const result = await Effect.runPromise(
      readMdxMarkdown(contentTarget, articleRef)
    );

    expect(Option.getOrThrow(result).description).toBe("");
  });

  it("returns none only for a verified missing public artifact", async () => {
    contentMocks.readPublicContent.mockReturnValue(
      Effect.fail(
        new PublicContentMissingError({
          locale: articleRef.locale,
          publicPath: articleRef.route,
        })
      )
    );

    const result = await Effect.runPromise(
      readMdxMarkdown(contentTarget, articleRef)
    );

    expect(Option.isNone(result)).toBe(true);
  });

  it("does not expose non-public tryout bodies through the content seam", async () => {
    const result = await Effect.runPromise(
      readMdxMarkdown(contentTarget, tryoutRef)
    );

    expect(Option.isNone(result)).toBe(true);
    expect(readPublicContent).not.toHaveBeenCalled();
  });

  it("rejects a signed projection from another route family", async () => {
    contentMocks.readPublicContent.mockReturnValue(
      Effect.succeed(makeFound("subject-lesson", "Wrong family", undefined))
    );

    await expect(
      Effect.runPromise(
        readMdxMarkdown(contentTarget, articleRef).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "NakafaAgentDataReadError",
      cause: "Signed projection family does not match the route catalog.",
    });
  });

  it("sanitizes signed transport and markdown projection failures", async () => {
    contentMocks.readPublicContent.mockReturnValueOnce(
      Effect.fail(new ContentTransportError({ reason: "fetch" }))
    );

    await expect(
      Effect.runPromise(
        readMdxMarkdown(contentTarget, articleRef).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "NakafaAgentDataReadError" });

    contentMocks.readPublicContent.mockReturnValueOnce(
      Effect.succeed(makeFound("article", "Signed article", "Description."))
    );
    contentMocks.projectMdxForAgentMarkdown.mockReturnValueOnce(
      Effect.fail(new Error("unsafe MDX"))
    );

    await expect(
      Effect.runPromise(
        readMdxMarkdown(contentTarget, articleRef).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "NakafaAgentDataReadError" });
  });

  it("resolves input before delegating Quran and MDX reads", async () => {
    contentMocks.resolveNakafaContentRef
      .mockReturnValueOnce(Effect.succeed(Option.none()))
      .mockReturnValueOnce(Effect.succeed(Option.some(quranRef)))
      .mockReturnValueOnce(Effect.succeed(Option.some(articleRef)));
    const quranMarkdown = {
      ...quranRef,
      description: "Opening",
      text: "# Al-Fatihah",
      title: "Al-Fatihah",
    };
    contentMocks.readQuranMarkdown.mockReturnValue(
      Effect.succeed(Option.some(quranMarkdown))
    );
    contentMocks.readPublicContent.mockReturnValue(
      Effect.succeed(makeFound("article", "Signed article", "Description."))
    );

    await expect(
      Effect.runPromise(
        readNakafaMarkdown("https://convex.cloud", contentTarget, "missing")
      )
    ).resolves.toEqual(Option.none());
    await expect(
      Effect.runPromise(
        readNakafaMarkdown("https://convex.cloud", contentTarget, "quran")
      )
    ).resolves.toEqual(Option.some(quranMarkdown));
    await expect(
      Effect.runPromise(
        readNakafaMarkdown("https://convex.cloud", contentTarget, "article")
      )
    ).resolves.toMatchObject({ _tag: "Some" });
    expect(readQuranMarkdown).toHaveBeenCalledWith(
      "https://convex.cloud",
      quranRef
    );
    expect(resolveNakafaContentRef).toHaveBeenCalledTimes(3);
  });
});

/** Builds the signed fields consumed by the agent markdown projection. */
function makeFound(
  kind: "article" | "subject-lesson",
  title: string,
  description: string | undefined,
  includeSubject = true
) {
  return {
    artifact: { payload: { rawMdx: "# Authored source" } },
    projection: {
      kind,
      metadata: {
        description,
        title,
        ...(includeSubject ? { subject: "Mathematics" } : {}),
      },
    },
  };
}
