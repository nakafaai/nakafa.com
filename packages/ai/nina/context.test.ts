import {
  type NinaLearningSessionInput,
  openNinaLearningSession,
} from "@repo/ai/nina/context";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

const learning = {
  assetId: "asset:id:material:mathematics:vector:addition",
  contentId: "asset:id:material:mathematics:vector:addition",
  locale: "en",
  materialKey: "mathematics",
  section: "subject-lesson",
  slug: "subjects/mathematics/vector/addition",
  sourcePath: "material/lesson/mathematics/vector/addition",
  title: "Vector Addition",
  url: "https://nakafa.com/en/subjects/mathematics/vector/addition",
  verified: true,
} satisfies NinaLearningSessionInput["learning"];

describe("nina/context", () => {
  it("opens a verified page session with a durable snapshot and page-fetch policy", async () => {
    const session = await Effect.runPromise(
      openNinaLearningSession({
        capturedAt: "2026-05-09T00:00:00.000Z",
        learning,
        placement: {
          mode: "placement",
          nodeKey: "curriculum:vector:addition",
          parentHref: "/en/curriculum/mathematics/vector",
          parentTitle: "Vector",
          programKey: "cambridge-lower-secondary",
        },
        source: "current-page",
      } satisfies NinaLearningSessionInput)
    );

    expect(session.context.snapshot).toMatchObject({
      capturedAt: "2026-05-09T00:00:00.000Z",
      learning,
      source: "current-page",
      tools: {
        allowPageFetch: true,
        evidenceScope: "verified-page",
      },
    });
    expect(session.context.transition).toEqual({
      reason: "page-context",
      toContextKey:
        "placement:cambridge-lower-secondary:curriculum:vector:addition:subjects/mathematics/vector/addition",
    });
  });

  it("keeps invalid session input in the Effect failure channel", async () => {
    const exit = await Effect.runPromiseExit(
      openNinaLearningSession({
        capturedAt: "2026-05-09T00:00:00.000Z",
        learning: {
          ...learning,
          locale: "fr",
        },
        source: "current-page",
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("opens an unverified canonical session without current-page fetch permission", async () => {
    const session = await Effect.runPromise(
      openNinaLearningSession({
        capturedAt: "2026-05-09T00:00:00.000Z",
        learning: {
          ...learning,
          verified: false,
        },
        source: "pinned-chat",
      } satisfies NinaLearningSessionInput)
    );

    expect(session.context.snapshot.tools).toMatchObject({
      allowPageFetch: false,
      evidenceScope: "general-learning",
    });
    expect(session.context.transition).toEqual({
      reason: "same-context",
      toContextKey: "canonical:subjects/mathematics/vector/addition",
    });
  });
});
