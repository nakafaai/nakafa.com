import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { ensureConnectorKeys } from "@repo/backend/confect/vault/keys";
import { blindConnectorText } from "@repo/backend/confect/vault/text";
import { Effect } from "effect";

/** What a blind of a Google account is bound to: the subject of one Google account. */
const GOOGLE_ACCOUNT_BINDING = "nakafa/connectors/google-account/v1";

/**
 * Blinds the subject of a Google account under the connector key. Every owner's
 * connection to one account stores the same 22 characters, and the database cannot
 * turn them back into the subject (ADR 0015).
 */
export const blindGoogleAccount = Effect.fn("connectors.account.blind")(
  function* (subject: string) {
    return yield* blindConnectorText(
      yield* ensureConnectorKeys(),
      GOOGLE_ACCOUNT_BINDING,
      subject
    );
  }
);

/**
 * Counts the active connections that hold the grant of one Google account, across
 * every owner, up to two. The revoke rule needs only to know whether the connection
 * it ends is the last one (ADR 0015), so two stands for two or more. The count is a
 * number and no row, so it never shows one owner's connection to another owner.
 */
export const countActiveGrants = Effect.fn("connectors.account.countGrants")(
  function* (googleAccountKey: string) {
    const connections = yield* (yield* DatabaseReader)
      .table("connectorConnections")
      .index("by_googleAccountKey_and_status", (query) =>
        query.eq("googleAccountKey", googleAccountKey).eq("status", "active")
      )
      .take(2)
      .pipe(Effect.orDie);
    return connections.length;
  }
);
