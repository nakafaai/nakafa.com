import { FunctionImpl, GroupImpl } from "@confect/server";
import { components } from "@repo/backend/confect/_generated/components";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { createAuthOptions } from "@repo/backend/confect/auth/runtime";
import spec, {
  AuthSecretMissing,
} from "@repo/backend/confect/auth/tokens.spec";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import { readSiteUrl } from "@repo/backend/confect/site/config";
import { type BetterAuthOptions, betterAuth } from "better-auth/minimal";
import { decryptOAuthToken, setTokenUtil } from "better-auth/oauth2";
import { Array as Arr, Config, Effect, Layer, Option, Schema } from "effect";

/**
 * Account rows one call reads. Each row costs up to four token operations and
 * one write through the Better Auth component, and a mutation may spend only a
 * short time in such system operations: production refused a page of 100 rows
 * with "Your request timed out performing too many system operations".
 */
export const TOKEN_PAGE_SIZE = 10;

/**
 * The variables that Better Auth reads its secret from. With none of them set
 * it falls back to a default secret that its source publishes, and outside
 * production it says nothing.
 */
const SECRET_VARIABLES = [
  "BETTER_AUTH_SECRETS",
  "BETTER_AUTH_SECRET",
  "AUTH_SECRET",
] as const;

/** The columns of one component `account` row that this function reads. */
const AccountRow = Schema.Struct({
  _id: Schema.String,
  accessToken: Schema.optional(Schema.NullOr(Schema.String)),
  refreshToken: Schema.optional(Schema.NullOr(Schema.String)),
});

/** One page of component `account` rows. */
const AccountPage = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  page: Schema.Array(AccountRow),
});

/** The context that Better Auth hands to its own token functions. */
type AuthContext = Parameters<typeof setTokenUtil>[1];

/**
 * A stored token that looks encrypted but that the secrets of this deployment
 * cannot read. The message is Better Auth's own, so it names a retired secret
 * version when that is the cause.
 */
class TokenUnreadable extends Schema.TaggedError<TokenUnreadable>()(
  "TokenUnreadable",
  { message: Schema.String }
) {}

/** A token that needs no write. */
const untouched = {
  sealed: Option.none<string>(),
  unreadable: Option.none<string>(),
};

/** Reads one stored token with Better Auth's own function. */
const readToken = (context: AuthContext, token: string) =>
  Effect.tryPromise({
    catch: (cause) =>
      new TokenUnreadable({ message: getUnknownErrorMessage(cause) }),
    try: () => Promise.resolve(decryptOAuthToken(token, context)),
  });

/** Seals one plain token with Better Auth's own function. */
const sealPlain = (context: AuthContext, token: string) =>
  Effect.promise(() => Promise.resolve(setTokenUtil(token, context))).pipe(
    Effect.map(Option.fromNullishOr)
  );

/** Fails before any write when Better Auth would seal under its default secret. */
const requireSecret = Effect.fn("auth.tokens.requireSecret")(function* () {
  const configured = yield* Config.all(
    Arr.map(SECRET_VARIABLES, (name) => Config.option(Config.String(name)))
  ).pipe(Effect.orDie);
  if (Arr.every(configured, Option.isNone)) {
    return yield* new AuthSecretMissing({
      code: "AUTH_SECRET_MISSING",
      message:
        "Set BETTER_AUTH_SECRET on this deployment first: without it Better Auth would seal the tokens under its published default secret.",
    });
  }
});

/**
 * Decides what one stored token needs, with Better Auth's own read and write
 * functions, so the answer matches how sign-in and the token routes see it.
 * Better Auth returns a token that does not look encrypted as it is, and
 * decrypts one that does. A result that differs from the stored text proves
 * the token was encrypted already, and a failure means the secrets of this
 * deployment cannot read it.
 */
const sealToken = Effect.fn("auth.tokens.sealToken")(function* (
  context: AuthContext,
  token: string | null | undefined
) {
  if (!token) {
    return untouched;
  }
  return yield* readToken(context, token).pipe(
    Effect.flatMap((read) =>
      read === token
        ? sealPlain(context, token)
        : Effect.succeed(Option.none<string>())
    ),
    Effect.map((sealed) => ({ ...untouched, sealed })),
    Effect.catchTag("TokenUnreadable", ({ message }) =>
      Effect.succeed({ ...untouched, unreadable: Option.some(message) })
    )
  );
});

/** Seals the plain tokens of one account row in the caller's transaction. */
const sealAccount = Effect.fn("auth.tokens.sealAccount")(function* (
  context: AuthContext,
  account: typeof AccountRow.Type
) {
  const ctx = yield* MutationCtx;
  const access = yield* sealToken(context, account.accessToken);
  const refresh = yield* sealToken(context, account.refreshToken);
  const rewritten =
    Option.isSome(access.sealed) || Option.isSome(refresh.sealed);
  if (rewritten) {
    yield* Effect.promise(() =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "account",
          update: {
            ...Option.match(access.sealed, {
              onNone: () => ({}),
              onSome: (accessToken) => ({ accessToken }),
            }),
            ...Option.match(refresh.sealed, {
              onNone: () => ({}),
              onSome: (refreshToken) => ({ refreshToken }),
            }),
          },
          where: [{ field: "_id", operator: "eq", value: account._id }],
        },
      })
    );
  }
  return {
    rewritten,
    unreadable: Arr.getSomes([
      Option.map(access.unreadable, (reason) => ({
        account: account._id,
        field: "accessToken" as const,
        reason,
      })),
      Option.map(refresh.unreadable, (reason) => ({
        account: account._id,
        field: "refreshToken" as const,
        reason,
      })),
    ]),
  };
});

const encryptStoredTokens = FunctionImpl.make(
  databaseSchema,
  spec,
  "encryptStoredTokens",
  Effect.fn("auth.tokens.encryptStoredTokens")(function* ({ cursor }) {
    yield* requireSecret();
    const ctx = yield* MutationCtx;
    const siteUrl = yield* readSiteUrl().pipe(Effect.orDie);
    // Only the secret and the account options matter here, so the social
    // provider is left out. The explicit options type gives the context the
    // shape that Better Auth's token functions accept.
    const context = yield* Effect.promise(
      () =>
        betterAuth<BetterAuthOptions>({
          ...createAuthOptions(ctx),
          baseURL: siteUrl.href,
        }).$context
    );
    const page = yield* Effect.promise(() =>
      ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: "account",
        paginationOpts: { cursor, numItems: TOKEN_PAGE_SIZE },
        select: ["_id", "accessToken", "refreshToken"],
      })
    ).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(AccountPage)),
      Effect.orDie
    );
    const rows = yield* Effect.forEach(page.page, (account) =>
      sealAccount(context, account)
    );
    return {
      continueCursor: page.continueCursor,
      encrypted: Arr.filter(rows, ({ rewritten }) => rewritten).length,
      isDone: page.isDone,
      scanned: rows.length,
      unreadable: Arr.flatMap(rows, ({ unreadable }) => unreadable),
    };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(encryptStoredTokens),
  GroupImpl.finalize
);
