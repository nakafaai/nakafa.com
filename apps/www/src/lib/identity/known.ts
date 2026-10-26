import { photoOf } from "@repo/backend/confect/users/picture";
import { userPlanValidator } from "@repo/backend/confect/users/schema";
import { MascotCode } from "@repo/mascot/code";
import { Effect, Option, Schema } from "effect";
import { reportClientException } from "@/lib/analytics/client";
import { KNOWN_ACCOUNT_KEY } from "@/lib/auth/keys";
import type { AccountRecord } from "@/lib/identity/viewer";

/**
 * The account row the sidebar last showed for one session: its name, the
 * picture that draws it, and its plan, which is what the closed row shows. It
 * holds nothing the row does not show, the email included. The key starts with
 * the prefix of account state, so signing out removes it with the rest.
 */
export const KnownAccount = Schema.Struct({
  mascot: MascotCode,
  name: Schema.String,
  photo: Schema.optional(Schema.String),
  plan: userPlanValidator,
  sessionId: Schema.String,
});

const KnownAccountText = Schema.fromJsonString(KnownAccount);

const decodeKnownAccountText = Schema.decodeUnknownOption(KnownAccountText);

const encodeKnownAccountText = Schema.encodeEffect(KnownAccountText);

type AccountStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * Reads the stored row as its text, or null when the browser holds none. A
 * storage that cannot be read answers null too, and the failure is reported
 * with its cause. The text is what a reader compares between renders, so the
 * same stored row reads as the same value.
 */
export const loadKnownAccountText = Effect.fn("www.identity.loadKnownAccount")(
  function* (storage?: AccountStorage) {
    return yield* Effect.try(() =>
      (storage ?? window.localStorage).getItem(KNOWN_ACCOUNT_KEY)
    ).pipe(
      Effect.catch((cause) =>
        reportClientException(cause, {
          operation: "load",
          source: "identity.knownAccount",
        }).pipe(Effect.as(null))
      )
    );
  }
);

/**
 * The stored row of `sessionId`, or none. A row of another session, a row in a
 * shape this page no longer reads, and no session at all answer none, so the
 * sidebar never draws an account the session does not hold.
 */
export function readKnownAccount(
  text: string | null,
  sessionId: string | null
) {
  return Option.fromNullishOr(text).pipe(
    Option.flatMap(decodeKnownAccountText),
    Option.filter((account) => account.sessionId === sessionId)
  );
}

/**
 * Keeps the row the sidebar shows for a session's account, so the next page
 * draws it before the live account answers. A write that fails is reported
 * with its cause.
 */
export const saveKnownAccount = Effect.fn("www.identity.saveKnownAccount")(
  function* (
    sessionId: string,
    account: AccountRecord,
    storage?: AccountStorage
  ) {
    const text = yield* encodeKnownAccountText(
      KnownAccount.make({
        mascot: account.appUser.mascot,
        name: account.authUser.name,
        photo: photoOf(account.appUser),
        plan: account.appUser.plan,
        sessionId,
      })
    );
    yield* Effect.try(() =>
      (storage ?? window.localStorage).setItem(KNOWN_ACCOUNT_KEY, text)
    );
  },
  Effect.catch((cause) =>
    reportClientException(cause, {
      operation: "save",
      source: "identity.knownAccount",
    })
  )
);
