import { describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/components/betterAuth/_generated/api";
import type { Doc } from "@repo/backend/components/betterAuth/_generated/dataModel";
import {
  CLEAR_PAGE_SIZE,
  clearPage,
} from "@repo/backend/components/betterAuth/tokens";
import { createBetterAuthComponentTest } from "@repo/backend/confect/test.helpers";
import { expectNoProviderTokens } from "@repo/backend/test/auth";
import type { WithoutSystemFields } from "convex/server";
import { Array as Arr, Record as Rec } from "effect";

const NOW = Date.UTC(2026, 9, 13, 12);
const HOUR = 60 * 60 * 1000;
const SCOPE = "openid email profile";

type Test = ReturnType<typeof createBetterAuthComponentTest>;
type AccountData = WithoutSystemFields<Doc<"account">>;

/** The five columns as sign-in wrote them before the account hooks. */
const issued = {
  accessToken: "sealed-access-token",
  accessTokenExpiresAt: NOW + HOUR,
  idToken: "id.token.as.issued",
  refreshToken: "sealed-refresh-token",
  refreshTokenExpiresAt: NOW + 24 * HOUR,
};

/** An account that carries no token, as the hooks write it. */
function account(name: string) {
  return {
    accountId: `google-${name}`,
    createdAt: NOW,
    providerId: "google",
    scope: SCOPE,
    updatedAt: NOW,
    userId: `user-${name}`,
  };
}

/**
 * One account of every kind that a page tells apart, in the order they are
 * created. The first three hold at least one of the five columns, and the other
 * two hold none: one has them all null, and one has a column of another kind.
 */
const kinds = {
  all: { ...account("all"), ...issued },
  expiryOnly: {
    ...account("expiry-only"),
    refreshTokenExpiresAt: issued.refreshTokenExpiresAt,
  },
  idOnly: { ...account("id-only"), idToken: issued.idToken },
  nulls: {
    ...account("nulls"),
    accessToken: null,
    accessTokenExpiresAt: null,
    idToken: null,
    refreshToken: null,
    refreshTokenExpiresAt: null,
  },
  none: { ...account("none"), password: "hashed-password" },
} satisfies Record<string, AccountData>;

/** How many accounts of `kinds` hold a token. */
const HOLDING = 3;

/**
 * The most calls one drain makes. It is more than any test below needs, so a
 * function that never reaches its last page fails the test and does not make
 * it loop forever.
 */
const MAX_CALLS = 10;

/** Inserts accounts straight into the component, as rows from before the hooks exist. */
function seed(test: Test, accounts: readonly AccountData[]) {
  return test.run(async (ctx) => {
    for (const data of accounts) {
      await ctx.db.insert("account", data);
    }
  });
}

/** Every account the component holds, oldest first. */
function stored(test: Test) {
  return test.run((ctx) => ctx.db.query("account").collect());
}

/** Runs one page, and reports how many documents that call wrote. */
function runPage(test: Test, cursor: string | null, dry: boolean) {
  return test.mutation(async (ctx) => {
    const result = await ctx.runMutation(internal.tokens.clearPage, {
      cursor,
      dry,
    });
    const metrics = await ctx.meta.getTransactionMetrics();
    return { result, written: metrics.documentsWritten.used };
  });
}

/** Runs pages from the start, each with the `next` of the one before, until the last or `MAX_CALLS`. */
async function drain(test: Test, dry: boolean) {
  const totals = { calls: 0, cleared: 0, holding: 0, scanned: 0, written: 0 };
  let cursor: string | null = null;
  do {
    const { result, written }: Awaited<ReturnType<typeof runPage>> =
      await runPage(test, cursor, dry);
    totals.calls += 1;
    totals.cleared += result.cleared;
    totals.holding += result.holding;
    totals.scanned += result.scanned;
    totals.written += written;
    cursor = result.next;
  } while (cursor !== null && totals.calls < MAX_CALLS);
  return totals;
}

describe("clearing the provider tokens already stored", () => {
  it("is an internal function, so the app cannot call it and only an operator can run it", () => {
    expect(clearPage.isInternal).toBe(true);
  });

  it("counts the accounts that hold a token and writes nothing in a dry pass", async () => {
    const test = createBetterAuthComponentTest();
    await seed(test, Rec.values(kinds));
    const before = await stored(test);
    expect(await drain(test, true)).toEqual({
      calls: 1,
      cleared: 0,
      holding: HOLDING,
      scanned: 5,
      written: 0,
    });
    expect(await stored(test)).toEqual(before);
  });

  it("removes the five columns from the accounts that hold any and writes only those", async () => {
    const test = createBetterAuthComponentTest();
    await seed(test, Rec.values(kinds));
    const before = await stored(test);
    // One write for each account that held a token, and none for the others.
    expect(await drain(test, false)).toEqual({
      calls: 1,
      cleared: HOLDING,
      holding: HOLDING,
      scanned: 5,
      written: HOLDING,
    });
    const after = await stored(test);
    expect(after).toHaveLength(before.length);
    Arr.forEach(after, (row, index) => {
      if (index < HOLDING) {
        // Everything else on an account that held a token stays.
        expectNoProviderTokens(row);
        expect(row).toMatchObject({
          accountId: before[index].accountId,
          scope: SCOPE,
          updatedAt: NOW,
          userId: before[index].userId,
        });
      } else {
        // An account without a token is the same document, null columns included.
        expect(row).toEqual(before[index]);
      }
    });
  });

  it("changes nothing on a second run", async () => {
    const test = createBetterAuthComponentTest();
    await seed(test, Rec.values(kinds));
    await drain(test, false);
    const cleared = await stored(test);
    expect(await drain(test, false)).toEqual({
      calls: 1,
      cleared: 0,
      holding: 0,
      scanned: 5,
      written: 0,
    });
    expect(await stored(test)).toEqual(cleared);
  });

  it("reads every account by the cursor of the call before", async () => {
    const test = createBetterAuthComponentTest();
    // More accounts than one page holds. The accounts that hold a token sit at
    // the start of the first page, at its end, at the start of the second page,
    // and at the very end.
    const last = CLEAR_PAGE_SIZE + 4;
    const holding = [0, CLEAR_PAGE_SIZE - 1, CLEAR_PAGE_SIZE, last];
    await seed(
      test,
      Arr.makeBy(last + 1, (index) =>
        Arr.contains(holding, index)
          ? { ...account(`held-${index}`), ...issued }
          : account(`plain-${index}`)
      )
    );
    expect(await drain(test, false)).toEqual({
      calls: 2,
      cleared: holding.length,
      holding: holding.length,
      scanned: last + 1,
      written: holding.length,
    });
    const after = await stored(test);
    expect(after).toHaveLength(last + 1);
    for (const row of after) {
      expectNoProviderTokens(row);
    }
    // A dry pass over every account finds nothing left.
    expect((await drain(test, true)).holding).toBe(0);
  });
});
