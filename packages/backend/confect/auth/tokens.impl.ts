import { FunctionImpl, GroupImpl } from "@confect/server";
import { components } from "@repo/backend/confect/_generated/components";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { createAuth } from "@repo/backend/confect/auth/runtime";
import spec from "@repo/backend/confect/auth/tokens.spec";
import { decryptOAuthToken, setTokenUtil } from "better-auth/oauth2";
import { Array as Arr, Effect, Layer, Option, Schema } from "effect";

/** Rows read by one call: far below the transaction limits for account rows. */
const PAGE_SIZE = 100;

/** The columns of one component `account` page that this function reads. */
const AccountPage = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  page: Schema.Array(
    Schema.Struct({
      _id: Schema.String,
      accessToken: Schema.optionalKey(Schema.NullOr(Schema.String)),
      refreshToken: Schema.optionalKey(Schema.NullOr(Schema.String)),
    })
  ),
});

/** A token that needs no write. */
const untouched = { sealed: Option.none<string>(), unreadable: false };

/**
 * Decides what one stored token needs, with Better Auth's own read and write
 * functions, so the answer matches how sign-in and the token routes see it.
 * Better Auth returns a plain token as it is and decrypts one that looks
 * encrypted: a result that differs from the stored text proves it was
 * encrypted already, and a failure means the current secret cannot read it.
 */
const sealToken = Effect.fn("auth.tokens.sealToken")(function* (
  authContext: Parameters<typeof setTokenUtil>[1],
  token: string | null | undefined
) {
  if (!token) {
    return untouched;
  }
  const readable = yield* Effect.tryPromise(() =>
    Promise.resolve(decryptOAuthToken(token, authContext))
  ).pipe(Effect.option);
  if (Option.isNone(readable)) {
    return { sealed: Option.none<string>(), unreadable: true };
  }
  if (readable.value !== token) {
    return untouched;
  }
  const sealed = yield* Effect.promise(() =>
    Promise.resolve(setTokenUtil(token, authContext))
  );
  return { sealed: Option.fromNullishOr(sealed), unreadable: false };
});

/** Rewrites the plain tokens of one account row in the caller's transaction. */
const sealAccount = Effect.fn("auth.tokens.sealAccount")(function* (
  ctx: MutationCtx,
  authContext: Parameters<typeof setTokenUtil>[1],
  account: (typeof AccountPage.Type)["page"][number]
) {
  const access = yield* sealToken(authContext, account.accessToken);
  const refresh = yield* sealToken(authContext, account.refreshToken);
  const rewritten =
    Option.isSome(access.sealed) || Option.isSome(refresh.sealed);
  if (rewritten) {
    const update = {
      ...Option.match(access.sealed, {
        onNone: () => ({}),
        onSome: (accessToken) => ({ accessToken }),
      }),
      ...Option.match(refresh.sealed, {
        onNone: () => ({}),
        onSome: (refreshToken) => ({ refreshToken }),
      }),
    };
    yield* Effect.promise(() =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "account",
          update,
          where: [{ field: "_id", operator: "eq", value: account._id }],
        },
      })
    );
  }
  return { rewritten, unreadable: access.unreadable || refresh.unreadable };
});

const encryptStoredTokens = FunctionImpl.make(
  databaseSchema,
  spec,
  "encryptStoredTokens",
  Effect.fn("auth.tokens.encryptStoredTokens")(function* ({ cursor }) {
    const ctx = yield* MutationCtx;
    const auth = yield* createAuth(ctx).pipe(Effect.orDie);
    const authContext = yield* Effect.promise(() => auth.$context);
    const page = yield* Effect.promise(() =>
      ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: "account",
        paginationOpts: { cursor, numItems: PAGE_SIZE },
      })
    ).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(AccountPage)),
      Effect.orDie
    );
    const rows = yield* Effect.forEach(page.page, (account) =>
      sealAccount(ctx, authContext, account)
    );
    return {
      continueCursor: page.continueCursor,
      encrypted: Arr.filter(rows, ({ rewritten }) => rewritten).length,
      isDone: page.isDone,
      scanned: rows.length,
      unreadable: Arr.filter(rows, ({ unreadable }) => unreadable).length,
    };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(encryptStoredTokens),
  GroupImpl.finalize
);
