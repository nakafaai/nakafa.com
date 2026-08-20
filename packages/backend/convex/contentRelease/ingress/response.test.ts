import { MAX_PUBLICATION_RESPONSE_BYTES } from "@nakafa/aksara-contracts/transport/limits";
import {
  encodePublicationResult,
  PublicationResponseDefect,
  publicationFailure,
  publicationSuccess,
  validateResponseBytes,
} from "@repo/backend/convex/contentRelease/ingress/response";
import { describe, expect, it } from "@repo/testing/effect";
import { Cause, Effect, Exit, Result } from "effect";

describe("content publication response encoding", () => {
  it.live("encodes canonical successes and canonical failure statuses", () =>
    Effect.gen(function* () {
      expect(
        yield* publicationSuccess({
          ok: true,
          operation: "current",
          value: {
            active: null,
            candidate: null,
            recovery: null,
          },
        })
      ).toEqual({
        body: '{"ok":true,"operation":"current","value":{"active":null,"candidate":null,"recovery":null}}',
        status: 200,
      });
      expect(
        yield* publicationFailure({
          code: "CONTENT_RELEASE_UNAUTHORIZED",
          kind: "unauthorized",
        })
      ).toEqual({
        body: '{"failure":{"code":"CONTENT_RELEASE_UNAUTHORIZED","kind":"unauthorized"},"ok":false}',
        status: 401,
      });
    })
  );

  it.live("defects on impossible response contracts and oversized bodies", () =>
    Effect.gen(function* () {
      const invalid = yield* Effect.exit(encodePublicationResult({ ok: true }));
      const oversized = yield* Effect.exit(
        validateResponseBytes("x".repeat(MAX_PUBLICATION_RESPONSE_BYTES + 1))
      );

      expect(Exit.isFailure(invalid)).toBe(true);
      if (Exit.isFailure(invalid)) {
        expect(Cause.findDefect(invalid.cause)).toEqual(
          Result.succeed(new PublicationResponseDefect({ reason: "contract" }))
        );
      }
      expect(Exit.isFailure(oversized)).toBe(true);
      if (Exit.isFailure(oversized)) {
        expect(Cause.findDefect(oversized.cause)).toEqual(
          Result.succeed(new PublicationResponseDefect({ reason: "size" }))
        );
      }
    })
  );
});
