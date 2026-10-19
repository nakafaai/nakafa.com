import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "@repo/backend/confect/_generated/components";
import { readSchoolSlug } from "@repo/backend/confect/auth/host";
import { passwordSignInDisabledError } from "@repo/backend/confect/auth/routes";
import type { LoginUsername } from "@repo/backend/confect/identity/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import {
  APIError,
  createAuthMiddleware,
  type DispatchContext,
  isAPIError,
} from "better-auth/api";
import type { BetterAuthOptions } from "better-auth/minimal";
import { USERNAME_ERROR_CODES } from "better-auth/plugins";
import {
  type GenericActionCtx,
  type GenericDataModel,
  makeFunctionReference,
} from "convex/server";
import { Effect, Match, Option, Predicate, Schema } from "effect";

/** The path of Better Auth's password sign-in by username, which the school host alone serves. */
const USERNAME_SIGN_IN_PATH = "/sign-in/username";

/** The two fields the password check reads from the body. */
const SignInFields = Schema.Struct({
  password: Schema.String,
  username: Schema.String,
});

/**
 * The part of the hook context that this module reads: the body, the request, and the auth
 * context with the password hash. Better Auth exports no hook context type, so this derives
 * from `DispatchContext`, the input that its hook pipeline passes to every hook. The request is
 * widened to `undefined`, because a server call that runs the hook carries no request.
 */
type SignInHook = Pick<DispatchContext, "body" | "context"> & {
  readonly request: Request | undefined;
};

/** The action methods that the hook calls: a query of the school's identity, and the attempt limit. */
type ActionCtx = Pick<
  GenericActionCtx<GenericDataModel>,
  "meta" | "runAction" | "runMutation" | "runQuery"
>;

/**
 * The attempts one school login may take: ten at once, then ten more every fifteen minutes
 * (ADR 0009). The count belongs to the account that the login names, and it is taken before
 * the password is checked, so parallel guesses cannot all pass a limit that none of them has
 * reached. A successful sign-in clears the count, so a success never counts against the login.
 */
const attempts = new RateLimiter(components.agentRateLimiter, {
  schoolLoginAttempt: {
    capacity: 10,
    kind: "token bucket",
    period: 15 * MINUTE,
    rate: 10,
  },
});

/**
 * The refusal of a sign-in whose school login name or password is not right, or whose login
 * has taken its attempts. Better Auth gives the same answer for every cause, so a visitor never
 * learns whether a login name exists on the school or whether its attempts ran out.
 */
const invalidCredentialsError = () =>
  APIError.from(
    "UNAUTHORIZED",
    USERNAME_ERROR_CODES.INVALID_USERNAME_OR_PASSWORD
  );

/**
 * The internal query `identity/logins:usernameOf`, which answers the Better Auth username of
 * one school login, or none (ADR 0009). The reference names the function with its wire
 * types, because the typed Confect ref of the same query resolves to `never` in the auth
 * module graph that this hook sits in. convex-test runs the query by this name.
 */
const usernameOf = makeFunctionReference<
  "query",
  { readonly loginName: string; readonly slug: string },
  typeof LoginUsername.Type
>("identity/logins:usernameOf");

/**
 * The Better Auth username of one school login of the school, read through the internal
 * query, so the school's own rules decide which logins sign in.
 */
const readLoginUsername = Effect.fn("auth.login.username")(
  (ctx: ActionCtx, slug: TenantSlug, loginName: string) =>
    Effect.tryPromise(() => ctx.runQuery(usernameOf, { loginName, slug })).pipe(
      Effect.orDie
    )
);

/**
 * Takes one sign-in attempt of an account from its limit, before the password is checked, and
 * says whether the attempt may go on. The key is the Better Auth username of the account, which
 * each school login names one to one.
 */
const admitAttempt = Effect.fn("auth.login.admit")(function* (
  ctx: ActionCtx,
  username: string
) {
  const quota = yield* Effect.tryPromise(() =>
    attempts.limit(ctx, "schoolLoginAttempt", { key: username })
  ).pipe(Effect.orDie);
  return quota.ok;
});

/**
 * Refuses a sign-in that the school's rules do not admit. It first pays the hash that a real
 * password check costs, so a refusal takes as long as a wrong password does.
 */
const refuseAfterHash = (hook: SignInHook, password: string) =>
  Effect.promise(() => hook.context.password.hash(password)).pipe(
    Effect.andThen(Effect.fail(invalidCredentialsError()))
  );

/**
 * Serves the school's username sign-in for one request, or refuses it (ADR 0009). The
 * school is the one that the browser host names, so a request from any other host is
 * refused as not found, before a password is read. The login name then becomes the Better
 * Auth username of its own account, so the endpoint checks the password of that account
 * alone. A name that is not a login of this school is refused with the same error as a
 * wrong password, and it is never passed on as a Better Auth username, which another
 * school could hold. A login whose attempts ran out is refused with that error too, even
 * with the right password.
 */
const signInWithSchoolLogin = Effect.fn("auth.login.signIn")(function* (
  ctx: ActionCtx,
  hook: SignInHook
) {
  const slug = Option.flatMap(Option.fromNullishOr(hook.request), (request) =>
    readSchoolSlug(request, new URL(hook.context.baseURL).hostname)
  );
  if (Option.isNone(slug)) {
    return yield* Effect.fail(passwordSignInDisabledError());
  }
  if (!Predicate.isObject(hook.body)) {
    return yield* Effect.fail(invalidCredentialsError());
  }
  const requestBody: object = hook.body;
  const { password, username } = yield* Schema.decodeUnknownEffect(
    SignInFields
  )(requestBody).pipe(Effect.mapError(invalidCredentialsError));
  const login: typeof LoginUsername.Type = yield* readLoginUsername(
    ctx,
    slug.value,
    username
  );
  return yield* Match.value(login).pipe(
    Match.when({ outcome: "found" }, (found) =>
      Effect.gen(function* () {
        if (!(yield* admitAttempt(ctx, found.username))) {
          return yield* refuseAfterHash(hook, password);
        }
        return {
          context: { body: { ...requestBody, username: found.username } },
        };
      })
    ),
    Match.when({ outcome: "missing" }, () => refuseAfterHash(hook, password)),
    Match.exhaustive
  );
});

/**
 * Clears the attempts of an account whose password sign-in succeeded, so a success leaves no
 * count against the login. A refused sign-in answers an APIError, and it keeps the attempt that
 * it took (ADR 0009).
 */
const clearOnSuccess = Effect.fn("auth.login.clear")(function* (
  ctx: ActionCtx,
  hook: SignInHook
) {
  if (isAPIError(hook.context.returned)) {
    return;
  }
  // A sign-in that succeeded carries both fields, so a body without them is a defect.
  const { username } = yield* Schema.decodeUnknownEffect(SignInFields)(
    hook.body
  );
  yield* Effect.tryPromise(() =>
    attempts.reset(ctx, "schoolLoginAttempt", { key: username })
  );
}, Effect.orDie);

/**
 * Better Auth's school username sign-in. Its `/sign-in/username` path is closed on
 * every host except a school host, where the request answers with the school's own login
 * (ADR 0009). The `username` plugin still owns the password check, so a school login
 * signs in with the same session as every other account. The router adds this plugin
 * (`confect/http`), because only a request names the host that it serves.
 */
export function schoolUsernameSignIn(
  ctx: ActionCtx
): NonNullable<BetterAuthOptions["plugins"]>[number] {
  return {
    id: "school-username-sign-in",
    hooks: {
      after: [
        {
          handler: createAuthMiddleware((hook) =>
            Effect.runPromise(clearOnSuccess(ctx, hook))
          ),
          matcher: (context) => context.path === USERNAME_SIGN_IN_PATH,
        },
      ],
      before: [
        {
          handler: createAuthMiddleware((hook) =>
            Effect.runPromise(signInWithSchoolLogin(ctx, hook))
          ),
          matcher: (context) => context.path === USERNAME_SIGN_IN_PATH,
        },
      ],
    },
  } satisfies NonNullable<BetterAuthOptions["plugins"]>[number];
}
