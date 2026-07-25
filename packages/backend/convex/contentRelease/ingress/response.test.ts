import { MAX_PUBLICATION_RESPONSE_BYTES } from "@nakafa/aksara-contracts/transport/limits";
import {
  encodePublicationResult,
  PublicationResponseDefect,
  publicationFailure,
  publicationSuccess,
  validateResponseBytes,
} from "@repo/backend/convex/contentRelease/ingress/response";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

describe("content publication response encoding", () => {
  it("encodes canonical successes and canonical failure statuses", async () => {
    await expect(
      Effect.runPromise(
        publicationSuccess({
          ok: true,
          operation: "current",
          value: {
            active: null,
            candidate: null,
            recovery: null,
          },
        })
      )
    ).resolves.toEqual({
      body: '{"ok":true,"operation":"current","value":{"active":null,"candidate":null,"recovery":null}}',
      status: 200,
    });
    await expect(
      Effect.runPromise(
        publicationFailure({
          code: "CONTENT_RELEASE_UNAUTHORIZED",
          kind: "unauthorized",
        })
      )
    ).resolves.toEqual({
      body: '{"failure":{"code":"CONTENT_RELEASE_UNAUTHORIZED","kind":"unauthorized"},"ok":false}',
      status: 401,
    });
  });

  it("defects on impossible response contracts and oversized bodies", async () => {
    const invalid = await Effect.runPromiseExit(
      encodePublicationResult({ ok: true })
    );
    const oversized = await Effect.runPromiseExit(
      validateResponseBytes("x".repeat(MAX_PUBLICATION_RESPONSE_BYTES + 1))
    );

    expect(Exit.isFailure(invalid)).toBe(true);
    if (Exit.isFailure(invalid)) {
      expect(Option.getOrUndefined(Cause.dieOption(invalid.cause))).toEqual(
        new PublicationResponseDefect({ reason: "contract" })
      );
    }
    expect(Exit.isFailure(oversized)).toBe(true);
    if (Exit.isFailure(oversized)) {
      expect(Option.getOrUndefined(Cause.dieOption(oversized.cause))).toEqual(
        new PublicationResponseDefect({ reason: "size" })
      );
    }
  });
});
