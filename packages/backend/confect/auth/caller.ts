import { getAuthUserId } from "@convex-dev/auth/server";
import { Auth, DatabaseReader, DocumentIds } from "@repo/backend/confect/_generated/services";
import { AuthReadError } from "@repo/backend/confect/auth/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { GenericQueryCtx, GenericDataModel } from "convex/server";
import { Config, Effect, Option } from "effect";

/** The context methods that resolving a caller needs, which queries, mutations and actions all have. */
type CallerCtx = Pick<GenericQueryCtx<GenericDataModel>, "auth" | "runQuery">;

const authReadFailure = () =>
  new AuthReadError({
    code: "AUTH_READ_FAILED",
    message: "Unable to read authentication state.",
  });

/**
 * The user of a Convex Auth session: Convex verified the token, whose subject
 * is the session, and the session row says whose it is for as long as it lives,
 * so a signed-out session resolves to nobody at once.
 * https://docs.convex.dev/auth/convex-auth/best-practices
 */
const readSessionUser = Effect.fn("auth.caller.session")(function* (
  ctx: CallerCtx
) {
  const userId = yield* Effect.tryPromise({
    try: () => getAuthUserId(ctx),
    catch: authReadFailure,
  });
  return Option.fromNullOr(userId);
});

/**
 * The user of an agent's grant: the token names the grant, and a deleted grant
 * resolves to nobody at once (ADR 0029).
 */
const readGrantUser = Effect.fn("auth.caller.grant")(function* (
  subject: string
) {
  const grantId = yield* (yield* DocumentIds).parse("agentGrants", subject);
  if (Option.isNone(grantId)) {
    return Option.none<Id<"users">>();
  }
  const grant = yield* (yield* DatabaseReader)
    .table("agentGrants")
    .get(grantId.value)
    .pipe(
      Effect.option,
      Effect.catchDefect(() => Effect.fail(authReadFailure()))
    );
  return Option.map(grant, ({ userId }) => userId);
});

/**
 * The user that the caller's token names, if any. The app itself signs only
 * agent tokens, so a token whose issuer is the deployment's own address names a
 * grant, and every other verified token is a Convex Auth session.
 */
const readCallerUser = Effect.fn("auth.caller.user")(function* (
  ctx: CallerCtx
) {
  const identity = yield* (yield* Auth).getUserIdentity.pipe(
    Effect.asSome,
    Effect.catchTag("NoUserIdentityFoundError", () => Effect.succeedNone)
  );
  if (Option.isNone(identity)) {
    return Option.none<Id<"users">>();
  }
  const appIssuer = yield* Config.string("CONVEX_CLOUD_URL").pipe(
    Effect.mapError(authReadFailure)
  );
  return identity.value.issuer === appIssuer
    ? yield* readGrantUser(identity.value.subject)
    : yield* readSessionUser(ctx);
});

/**
 * The caller's user id and account row. A user id whose row is gone is a
 * signed-in caller whose account is unavailable (`auth/session`).
 */
export const readCaller = Effect.fn("auth.caller.read")(function* (
  ctx: CallerCtx
) {
  const userId = yield* readCallerUser(ctx);
  if (Option.isNone(userId)) {
    return { userId: undefined, appUser: null };
  }
  const appUser = yield* (yield* DatabaseReader)
    .table("users")
    .get(userId.value)
    .pipe(
      Effect.option,
      Effect.catchDefect(() => Effect.fail(authReadFailure()))
    );
  return { userId: userId.value, appUser: Option.getOrNull(appUser) };
});
