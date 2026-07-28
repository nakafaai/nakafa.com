import { components, internal } from "@repo/backend/convex/_generated/api";
import { ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE } from "@repo/backend/convex/auth/deletion/constants";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 6, 28, 21, 0, 0);
const decodeVerificationPage = Schema.decodeUnknownSync(
  Schema.Struct({
    page: Schema.Array(
      Schema.Struct({
        value: Schema.String,
      })
    ),
  })
);

describe("auth/deletion/verification", () => {
  it("drains direct tokens and OAuth-link state across bounded pages", async () => {
    const t = createConvexTestWithBetterAuth();
    const authUser = await t.mutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          createdAt: NOW,
          email: "verification-owner@example.com",
          emailVerified: true,
          name: "Verification owner",
          updatedAt: NOW,
        },
      },
      select: ["_id"],
    });
    const unrelatedValues = Array.from(
      { length: ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE + 1 },
      (_, index) => `unrelated-${index}`
    );

    for (const [index, value] of unrelatedValues.entries()) {
      await t.mutation(components.betterAuth.adapter.create, {
        input: {
          model: "verification",
          data: {
            createdAt: NOW + index,
            expiresAt: NOW + 60_000,
            identifier: `unrelated-${index}`,
            updatedAt: NOW + index,
            value,
          },
        },
      });
    }

    await t.mutation(components.betterAuth.adapter.create, {
      input: {
        model: "verification",
        data: {
          createdAt: NOW + 100,
          expiresAt: NOW + 60_000,
          identifier: "reset-password:token",
          updatedAt: NOW + 100,
          value: authUser._id,
        },
      },
    });
    await t.mutation(components.betterAuth.adapter.create, {
      input: {
        model: "verification",
        data: {
          createdAt: NOW + 101,
          expiresAt: NOW + 60_000,
          identifier: "oauth-link-state",
          updatedAt: NOW + 101,
          value: JSON.stringify({
            callbackURL: "https://nakafa.com/id",
            codeVerifier: "verifier",
            expiresAt: NOW + 60_000,
            link: {
              email: "verification-owner@example.com",
              userId: authUser._id,
            },
          }),
        },
      },
    });
    const substringValue = `unrelated-${authUser._id}`;
    await t.mutation(components.betterAuth.adapter.create, {
      input: {
        model: "verification",
        data: {
          createdAt: NOW + 102,
          expiresAt: NOW + 60_000,
          identifier: "unrelated-substring",
          updatedAt: NOW + 102,
          value: substringValue,
        },
      },
    });

    await t.action(
      internal.auth.deletion.verification.drainDeletedUserVerifications,
      {
        authId: authUser._id,
      }
    );

    const remaining = decodeVerificationPage(
      await t.query(components.betterAuth.adapter.findMany, {
        model: "verification",
        paginationOpts: {
          cursor: null,
          numItems: 100,
        },
        select: ["value"],
      })
    );

    expect(remaining.page.map((row) => row.value)).toEqual([
      ...unrelatedValues,
      substringValue,
    ]);
  });
});
