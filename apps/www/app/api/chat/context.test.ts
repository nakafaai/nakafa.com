// @vitest-environment node
import type { NinaContextSnapshot } from "@repo/ai/nina/memory/pack";
import { LearningProgramKeySchema } from "@repo/contents/_types/program/schema";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { resolveNinaLearningSession } from "@/app/api/chat/context";

const pinnedContext = {
  capturedAt: "2026-06-21T00:00:00.000Z",
  learning: {
    assetId: "asset:id:material:chemistry:basic-laws:applications",
    locale: "en",
    slug: "subjects/chemistry/basic-chemistry-laws/chemistry-law-applications",
    title: "Law Applications",
    url: "https://nakafa.com/en/subjects/chemistry/basic-chemistry-laws/chemistry-law-applications",
    verified: true,
  },
  source: "current-page",
  tools: {
    allowDeepResearch: true,
    allowMath: true,
    allowNakafa: true,
    allowPageFetch: true,
    evidenceScope: "verified-page",
  },
} satisfies NinaContextSnapshot;

const pinnedPlacementContext = {
  ...pinnedContext,
  placement: {
    mode: "placement",
    nodeKey: "class-10-chemistry-basic-chemistry-laws",
    parentHref:
      "/en/curriculum/merdeka/class-10/chemistry#basic-laws-of-chemistry",
    parentTitle: "Basic Laws of Chemistry",
    programKey: LearningProgramKeySchema.make("merdeka"),
  },
} satisfies NinaContextSnapshot;

describe("app/api/chat/context", () => {
  it("opens an unverified off-page turn as canonical when no pinned context exists", async () => {
    const session = await Effect.runPromise(
      resolveNinaLearningSession({
        capturedAt: "2026-06-22T00:00:00.000Z",
        locale: "en",
        rawContext: "not-a-client-context",
        slug: "/chat",
        url: "https://nakafa.com/en/chat",
        verified: false,
      })
    );

    expect(session.context.snapshot).toMatchObject({
      learning: {
        locale: "en",
        slug: "chat",
        url: "https://nakafa.com/en/chat",
        verified: false,
      },
      source: "current-page",
      tools: {
        allowPageFetch: false,
        evidenceScope: "general-learning",
      },
    });
    expect(session.context.transition).toEqual({
      reason: "page-context",
      toContextKey: "canonical:chat",
    });
  });

  it("reuses stored Nina context when an existing chat continues off a verified learning page", async () => {
    const session = await Effect.runPromise(
      resolveNinaLearningSession({
        capturedAt: "2026-06-22T00:00:00.000Z",
        locale: "en",
        pinnedContext,
        rawContext: {},
        slug: "/chat/chat_existing",
        url: "https://nakafa.com/en/chat/chat_existing",
        verified: false,
      })
    );

    expect(session.context.snapshot).toMatchObject({
      capturedAt: "2026-06-22T00:00:00.000Z",
      learning: pinnedContext.learning,
      source: "pinned-chat",
      tools: {
        allowPageFetch: true,
        evidenceScope: "verified-page",
      },
    });
    expect(session.context.transition).toEqual({
      reason: "same-context",
      toContextKey:
        "canonical:subjects/chemistry/basic-chemistry-laws/chemistry-law-applications",
    });
  });

  it("preserves pinned placement when replaying an existing chat off-page", async () => {
    const session = await Effect.runPromise(
      resolveNinaLearningSession({
        capturedAt: "2026-06-22T00:00:00.000Z",
        locale: "en",
        pinnedContext: pinnedPlacementContext,
        rawContext: {},
        slug: "/chat/chat_existing",
        url: "https://nakafa.com/en/chat/chat_existing",
        verified: false,
      })
    );

    expect(session.context.snapshot).toMatchObject({
      capturedAt: "2026-06-22T00:00:00.000Z",
      learning: pinnedContext.learning,
      placement: pinnedPlacementContext.placement,
      source: "pinned-chat",
    });
    expect(session.context.transition).toEqual({
      reason: "same-context",
      toContextKey:
        "placement:merdeka:class-10-chemistry-basic-chemistry-laws:subjects/chemistry/basic-chemistry-laws/chemistry-law-applications",
    });
  });

  it("keeps verified material placement when the browser context hint validates", async () => {
    const session = await Effect.runPromise(
      resolveNinaLearningSession({
        capturedAt: "2026-06-22T00:00:00.000Z",
        locale: "en",
        rawContext: {
          materialContextHint:
            "merdeka~class-10-chemistry-basic-chemistry-laws",
        },
        slug: "/subjects/chemistry/basic-chemistry-laws/chemistry-law-applications",
        url: "https://nakafa.com/en/subjects/chemistry/basic-chemistry-laws/chemistry-law-applications",
        verified: true,
      })
    );

    expect(session.context.snapshot).toMatchObject({
      learning: {
        materialKey: "lesson.chemistry.basic-chemistry-laws",
        section: "subject-lesson",
        sourcePath:
          "material/lesson/chemistry/basic-chemistry-laws/chemistry-law-applications",
        title: "Law Applications",
        verified: true,
      },
      placement: {
        mode: "placement",
        nodeKey: "class-10-chemistry-basic-chemistry-laws",
        parentHref:
          "/en/curriculum/merdeka/class-10/chemistry#basic-laws-of-chemistry",
        parentTitle: "Basic Laws of Chemistry",
        programKey: "merdeka",
      },
      source: "current-page",
      tools: {
        allowPageFetch: true,
        evidenceScope: "verified-page",
      },
    });
    expect(session.context.transition).toEqual({
      reason: "page-context",
      toContextKey:
        "placement:merdeka:class-10-chemistry-basic-chemistry-laws:subjects/chemistry/basic-chemistry-laws/chemistry-law-applications",
    });
  });

  it("drops a stale material context hint instead of inventing placement", async () => {
    const session = await Effect.runPromise(
      resolveNinaLearningSession({
        capturedAt: "2026-06-22T00:00:00.000Z",
        locale: "en",
        rawContext: {
          materialContextHint: "merdeka~stale-node",
        },
        slug: "/subjects/chemistry/basic-chemistry-laws/chemistry-law-applications",
        url: "https://nakafa.com/en/subjects/chemistry/basic-chemistry-laws/chemistry-law-applications",
        verified: true,
      })
    );

    expect(session.context.snapshot.placement).toBeUndefined();
    expect(session.context.transition).toEqual({
      reason: "page-context",
      toContextKey:
        "canonical:subjects/chemistry/basic-chemistry-laws/chemistry-law-applications",
    });
  });
});
