import { loginAccountOf } from "@repo/backend/confect/identity/logins";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect, Option } from "effect";

const refused = {
  status: "error" as const,
  userError: { error: "INVALID_CREDENTIALS" as const },
};

/**
 * Signs a school login in on its school's host (ADR 0009). The login name and
 * the school resolve to the account a card made, whose Convex Auth username is
 * the account's own id, and Convex Auth's password method checks the password,
 * limits the account's attempts, and makes the session. Every refusal reads the
 * same.
 * https://docs.convex.dev/auth/convex-auth/methods/username-password
 */
export const signInSchoolLogin = Effect.fn("auth.school.signIn")(function* (args: {
  readonly loginName: string;
  readonly password: string;
  readonly slug: TenantSlug;
}) {
  const userId = yield* loginAccountOf(args.slug, args.loginName);
  if (Option.isNone(userId)) {
    return refused;
  }
  const ctx = yield* MutationCtx;
  const answer = yield* Effect.promise(() =>
    ctx.runMutation(api.auth.core.signInWithUsernamePassword, {
      password: args.password,
      username: userId.value,
    })
  );
  return answer.status === "complete"
    ? { status: "complete" as const, tokens: answer.tokens }
    : refused;
});
