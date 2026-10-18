import { readSchoolSlug } from "@repo/backend/confect/auth/host";
import { passwordSignInDisabledError } from "@repo/backend/confect/auth/routes";
import type { LoginUsername } from "@repo/backend/confect/identity/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { APIError, createAuthMiddleware } from "better-auth/api";
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

/** The part of the hook context that this module reads: the body, the request, and the password hash. */
interface SignInHook {
  readonly body?: unknown;
  readonly context: {
    readonly baseURL: string;
    readonly password: { readonly hash: (password: string) => Promise<string> };
  };
  readonly request?: Request | undefined;
}

/**
 * The refusal of a sign-in whose school login name or password is not right. Better
 * Auth gives the same answer for every cause, so a visitor never learns whether a login
 * name exists on the school.
 */
const invalidCredentialsError = () =>
  APIError.from(
    "UNAUTHORIZED",
    USERNAME_ERROR_CODES.INVALID_USERNAME_OR_PASSWORD
  );

/** The one action method that the hook calls: a query of the school's identity. */
type QueryCtx = Pick<GenericActionCtx<GenericDataModel>, "runQuery">;

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
  (ctx: QueryCtx, slug: TenantSlug, loginName: string) =>
    Effect.tryPromise(() => ctx.runQuery(usernameOf, { loginName, slug })).pipe(
      Effect.orDie
    )
);

/**
 * Serves the school's username sign-in for one request, or refuses it (ADR 0009). The
 * school is the one that the browser host names, so a request from any other host is
 * refused as not found, before a password is read. The login name then becomes the Better
 * Auth username of its own account, so the endpoint checks the password of that account
 * alone. A name that is not a login of this school is refused with the same error as a
 * wrong password, and it is never passed on as a Better Auth username, which another
 * school could hold.
 */
const signInWithSchoolLogin = Effect.fn("auth.login.signIn")(function* (
  ctx: QueryCtx,
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
      Effect.succeed({
        context: { body: { ...requestBody, username: found.username } },
      })
    ),
    Match.when({ outcome: "missing" }, () =>
      Effect.promise(() => hook.context.password.hash(password)).pipe(
        Effect.andThen(Effect.fail(invalidCredentialsError()))
      )
    ),
    Match.exhaustive
  );
});

/**
 * Better Auth's school username sign-in. Its `/sign-in/username` path is closed on
 * every host except a school host, where the request answers with the school's own login
 * (ADR 0009). The `username` plugin still owns the password check, so a school login
 * signs in with the same session as every other account. The router adds this plugin
 * (`confect/http`), because only a request names the host that it serves.
 */
export function schoolUsernameSignIn(
  ctx: QueryCtx
): NonNullable<BetterAuthOptions["plugins"]>[number] {
  return {
    id: "school-username-sign-in",
    hooks: {
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
