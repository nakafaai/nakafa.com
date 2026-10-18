import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { connect } from "@repo/backend/confect/connectors/connection";
import { openRefreshToken } from "@repo/backend/confect/connectors/secret";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import {
  createTenantKey,
  ensureLearnerKeys,
} from "@repo/backend/confect/vault/keys";
import { learner, scenario, school } from "@repo/backend/test/owner";
import { Effect, Option } from "effect";

const TOKEN = "1//google-refresh-token-for-the-test";

/** One Drive connection that holds the refresh token given. */
const drive = (refreshToken: string) => ({
  connector: "drive" as const,
  googleAccountKey: null,
  refreshToken,
  scopes: ["drive.file"],
});

/** The sealed token row of one connection, which holds exactly one. */
const secretOf = Effect.fn("test.connectors.secret.of")(function* (
  connectionId: GenericId.GenericId<"connectorConnections">
) {
  const row = yield* (yield* DatabaseReader)
    .table("connectorSecrets")
    .index("by_connectionId", (query) => query.eq("connectionId", connectionId))
    .first()
    .pipe(Effect.orDie);
  return Option.getOrThrow(row);
});

describe("connectors/secret", () => {
  it.effect(
    "seals a learner's refresh token under the learner's key and opens it for that learner",
    () =>
      scenario(
        Effect.gen(function* () {
          const userId = yield* learner("owner");
          const connectionId = yield* connect(
            { id: userId, kind: "user" },
            { kind: "personal", userId },
            drive(TOKEN)
          );
          const { refreshToken } = yield* secretOf(connectionId);
          expect(
            yield* openRefreshToken(
              { kind: "personal", userId },
              connectionId,
              refreshToken
            )
          ).toBe(TOKEN);
        })
      )
  );

  it.effect(
    "seals a school's refresh token under the school's key and opens it for that school",
    () =>
      scenario(
        Effect.gen(function* () {
          const tenantId = yield* school("nf");
          yield* createTenantKey(tenantId);
          const connectionId = yield* connect(
            systemActor,
            { kind: "tenant", tenantId },
            drive(TOKEN)
          );
          const { refreshToken } = yield* secretOf(connectionId);
          expect(
            yield* openRefreshToken(
              { kind: "tenant", tenantId },
              connectionId,
              refreshToken
            )
          ).toBe(TOKEN);
        })
      )
  );

  it.effect(
    "opens a token only for its own connection, and fails as a cipher error for another connection or owner",
    () =>
      scenario(
        Effect.gen(function* () {
          const userId = yield* learner("owner");
          const otherUserId = yield* learner("other");
          yield* ensureLearnerKeys(otherUserId);
          const first = yield* connect(
            { id: userId, kind: "user" },
            { kind: "personal", userId },
            drive(TOKEN)
          );
          const second = yield* connect(
            { id: userId, kind: "user" },
            { kind: "personal", userId },
            drive("second-token")
          );
          const { refreshToken } = yield* secretOf(first);
          const otherConnection = yield* Effect.flip(
            openRefreshToken({ kind: "personal", userId }, second, refreshToken)
          );
          const otherOwner = yield* Effect.flip(
            openRefreshToken(
              { kind: "personal", userId: otherUserId },
              first,
              refreshToken
            )
          );
          expect([otherConnection.reason, otherOwner.reason]).toEqual([
            "cipher",
            "cipher",
          ]);
        })
      )
  );

  it.effect(
    "fails as a cipher error when a school's token opens under another school's key",
    () =>
      scenario(
        Effect.gen(function* () {
          const tenantId = yield* school("nf");
          yield* createTenantKey(tenantId);
          const other = yield* school("other");
          yield* createTenantKey(other);
          const connectionId = yield* connect(
            systemActor,
            { kind: "tenant", tenantId },
            drive(TOKEN)
          );
          const { refreshToken } = yield* secretOf(connectionId);
          const refused = yield* Effect.flip(
            openRefreshToken(
              { kind: "tenant", tenantId: other },
              connectionId,
              refreshToken
            )
          );
          expect(refused.reason).toBe("cipher");
        })
      )
  );

  it.effect(
    "stores the refresh token sealed, so its row holds none of the token's bytes",
    () =>
      scenario(
        Effect.gen(function* () {
          const userId = yield* learner("owner");
          const connectionId = yield* connect(
            { id: userId, kind: "user" },
            { kind: "personal", userId },
            drive(TOKEN)
          );
          const { refreshToken } = yield* secretOf(connectionId);
          // Latin-1 keeps one character for each byte, so the search is byte-exact.
          const bytes = new TextDecoder("latin1").decode(refreshToken);
          expect(refreshToken.byteLength).toBeGreaterThan(TOKEN.length);
          expect(bytes).not.toContain(TOKEN);
        })
      )
  );
});
