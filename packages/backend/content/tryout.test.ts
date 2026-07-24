import {
  decodeTryoutContentRequest,
  decodeTryoutContentResponse,
  MAX_TRYOUT_CONTENT_PLACEMENTS,
} from "@repo/backend/content/tryout";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const request = {
  countryKey: "indonesia",
  examKey: "snbt",
  locale: "id",
  sectionKey: "penalaran-matematika",
  setKey: "set-1",
  trackKey: "2027",
} as const;

/** Executes one strict contract decoder at the test boundary. */
function decodeRequest(input: unknown) {
  return Effect.runPromise(decodeTryoutContentRequest(input));
}

/** Exposes one strict response decoder failure at the test boundary. */
function rejectResponse(input: unknown) {
  return Effect.runPromise(
    decodeTryoutContentResponse(input).pipe(Effect.flip)
  );
}

describe("try-out content contract", () => {
  it("decodes the exact stable route identity", async () => {
    await expect(decodeRequest(request)).resolves.toEqual(request);
  });

  it("rejects excess route fields and unsupported locales", async () => {
    await expect(
      decodeRequest({ ...request, extra: true })
    ).rejects.toBeDefined();
    await expect(
      decodeRequest({ ...request, locale: "de" })
    ).rejects.toBeDefined();
  });

  it("accepts sanitized absence and failure responses", async () => {
    await expect(
      Effect.runPromise(decodeTryoutContentResponse({ kind: "unavailable" }))
    ).resolves.toEqual({ kind: "unavailable" });
    await expect(
      Effect.runPromise(
        decodeTryoutContentResponse({
          code: "TRYOUT_CONTENT_UNAUTHORIZED",
          kind: "failure",
        })
      )
    ).resolves.toMatchObject({ kind: "failure" });
  });

  it("rejects excess response fields and placement overflow", async () => {
    await expect(
      rejectResponse({ extra: true, kind: "unavailable" })
    ).resolves.toBeDefined();
    await expect(
      rejectResponse({
        artifacts: Array.from(
          { length: MAX_TRYOUT_CONTENT_PLACEMENTS + 1 },
          (_, index) => ({
            placementId: `placement-${index}`,
            questionArtifact: {},
          })
        ),
        kind: "found",
      })
    ).resolves.toBeDefined();
  });
});
