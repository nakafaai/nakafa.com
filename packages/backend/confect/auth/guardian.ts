import { readSchoolSlug } from "@repo/backend/confect/auth/host";
import { passwordSignInDisabledError } from "@repo/backend/confect/auth/routes";
import type {
  CodeRedeem,
  RedeemAnswer,
} from "@repo/backend/confect/guardians/schema";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { BetterAuthOptions } from "better-auth/minimal";
import {
  type GenericActionCtx,
  type GenericDataModel,
  makeFunctionReference,
} from "convex/server";
import { Effect, Option, Predicate, Schema, String as Str } from "effect";

/** The path of the guardian's code sign-in, which a school host alone serves (ADR 0009). */
export const GUARDIAN_SIGN_IN_PATH = "/school/guardian/sign-in";

/** The two fields the sign-in reads from the body. */
const SignInFields = Schema.Struct({ code: Schema.String, email: Schema.String });

/** The action method that the endpoint calls: the internal redeem of the code. */
type ActionCtx = Pick<GenericActionCtx<GenericDataModel>, "runMutation">;

/**
 * The internal mutation `guardians/codes:redeem`, named with its wire types, because
 * the typed Confect ref resolves to `never` in the auth module graph, as the username
 * sign-in's query does (`auth/login`). convex-test runs it by this name.
 */
const redeem = makeFunctionReference<
  "mutation",
  typeof CodeRedeem.Type,
  typeof RedeemAnswer.Type
>("guardians/codes:redeem");

/**
 * The refusal of a code that does not sign the guardian in. A wrong code, an
 * expired one, an address with no link, and a used-up limit read the same, so a
 * visitor never learns which of them held.
 */
const invalidCodeError = () =>
  APIError.from("UNAUTHORIZED", {
    code: "INVALID_GUARDIAN_CODE",
    message: "The code is not right or has expired.",
  });

/** The part of the endpoint context this module reads. */
type SignInContext = Parameters<typeof setSessionCookie>[0] & {
  readonly body: unknown;
  readonly request: Request | undefined;
};

/**
 * Signs a guardian in with the email code on the school host that the browser
 * names (ADR 0009). Any other host and a server call are refused as not found. The
 * redeem decides the code and the account in one transaction, and the endpoint
 * then makes the Better Auth session, so a guardian signs in with the same session
 * as every other account.
 */
const signIn = Effect.fn("auth.guardian.signIn")(function* (
  ctx: ActionCtx,
  endpoint: SignInContext
) {
  const slug = Option.flatMap(Option.fromNullishOr(endpoint.request), (request) =>
    readSchoolSlug(request, new URL(endpoint.context.baseURL).hostname)
  );
  if (Option.isNone(slug)) {
    return yield* Effect.fail(passwordSignInDisabledError());
  }
  const fields = yield* Schema.decodeUnknownEffect(SignInFields)(
    endpoint.body
  ).pipe(Effect.mapError(invalidCodeError));
  const answer = yield* Effect.tryPromise(() =>
    ctx.runMutation(redeem, {
      code: Str.trim(fields.code),
      email: Str.toLowerCase(Str.trim(fields.email)),
      slug: slug.value,
    })
  ).pipe(Effect.orDie);
  if (answer.outcome === "refused") {
    return yield* Effect.fail(invalidCodeError());
  }
  const { internalAdapter } = endpoint.context;
  const session = yield* Effect.promise(() =>
    internalAdapter.createSession(answer.authId)
  );
  const user = yield* Effect.promise(() =>
    internalAdapter.findUserById(answer.authId)
  ).pipe(
    Effect.filterOrElse(Predicate.isNotNull, () =>
      Effect.die("A redeemed guardian code names no account.")
    )
  );
  yield* Effect.promise(() => setSessionCookie(endpoint, { session, user }));
  return { ok: true };
});

/**
 * Better Auth's guardian code sign-in, served on a school host alone (ADR 0009,
 * ADR 0034). The router adds this plugin (`confect/http`), because only a request
 * names the host that it serves.
 */
export function guardianCodeSignIn(
  ctx: ActionCtx
): NonNullable<BetterAuthOptions["plugins"]>[number] {
  return {
    id: "guardian-code-sign-in",
    endpoints: {
      guardianCodeSignIn: createAuthEndpoint(
        GUARDIAN_SIGN_IN_PATH,
        { method: "POST" },
        (endpoint) => Effect.runPromise(signIn(ctx, endpoint))
      ),
    },
  } satisfies NonNullable<BetterAuthOptions["plugins"]>[number];
}
