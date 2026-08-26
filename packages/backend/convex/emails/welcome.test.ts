import { canonicalizePublicPageProjection } from "@nakafa/aksara-contracts/projection/page";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { resend } from "@repo/backend/convex/emails/client";
import { resolveWelcomeEmailLinks } from "@repo/backend/convex/emails/welcome";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  makeTestPageProjection,
  TEST_PAGE_PROJECTION_JSON,
} from "@repo/backend/test/content-page";
import { TEST_ARTICLE_PROJECTION_JSON } from "@repo/backend/test/content-runtime";
import { describe, expect, it } from "@repo/testing/effect";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { vi } from "vitest";

const SITE_URL = new URL("https://nakafa.com");

function pageJson(pageKey: string, publicPath: string) {
  return canonicalizePublicPageProjection(
    makeTestPageProjection("en", pageKey, publicPath)
  );
}

/** Inserts one welcome-email recipient fixture. */
function insertWelcomeUser(
  ctx: MutationCtx,
  suffix: string,
  deletionPreparedAt?: number
) {
  return Effect.promise(() =>
    ctx.db.insert("users", {
      authId: `${suffix}-welcome-owner`,
      credits: 0,
      creditsResetAt: 0,
      deletionPreparedAt,
      email: `${suffix}@example.com`,
      name: `${suffix} Welcome Owner`,
      plan: "free",
    })
  );
}

describe("emails/welcome", () => {
  it.effect(
    "resolves legal URLs from the signed English Page projections",
    () =>
      Effect.gen(function* () {
        const links = yield* resolveWelcomeEmailLinks(
          {
            managed: true,
            projectionJson: [
              pageJson("privacy-policy", "privacy-current"),
              pageJson("terms-of-service", "terms-current"),
            ],
          },
          SITE_URL
        );

        expect(links).toEqual({
          privacyPolicyUrl: "https://nakafa.com/en/privacy-current",
          startLearningUrl: "https://nakafa.com/en",
          termsOfServiceUrl: "https://nakafa.com/en/terms-current",
        });
      })
  );

  it.effect.each([
    ["an unmanaged catalog", { managed: false, projectionJson: [] }],
    ["a malformed projection", { managed: true, projectionJson: ["not-json"] }],
    [
      "a non-Page projection",
      { managed: true, projectionJson: [TEST_ARTICLE_PROJECTION_JSON] },
    ],
    [
      "a missing legal Page",
      { managed: true, projectionJson: [TEST_PAGE_PROJECTION_JSON] },
    ],
  ] as const)("rejects %s", ([, catalog]) =>
    Effect.gen(function* () {
      const error = yield* resolveWelcomeEmailLinks(catalog, SITE_URL).pipe(
        Effect.flip
      );

      expect(error).toMatchObject({
        _tag: "ReleaseError",
        code: "CONTENT_RELEASE_INTEGRITY",
      });
    })
  );

  it.effect(
    "skips enqueue when the recipient disappeared or entered deletion",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const deletedUserId = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(insertWelcomeUser(ctx, "deleted"))
          )
        );
        const pendingUserId = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(insertWelcomeUser(ctx, "pending", 1))
          )
        );
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              Effect.promise(() => ctx.db.delete("users", deletedUserId))
            )
          )
        );

        for (const userId of [deletedUserId, pendingUserId]) {
          const result = yield* Effect.promise(() =>
            t.mutation(internal.emails.welcome.enqueueWelcomeEmail, {
              html: "<p>Welcome</p>",
              text: "Welcome",
              userId,
            })
          );
          expect(result).toBeNull();
        }
      })
  );

  it.effect(
    "translates a component enqueue failure into a typed Convex error",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const userId = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(insertWelcomeUser(ctx, "failed"))
          )
        );
        vi.spyOn(resend, "sendEmail").mockRejectedValueOnce(
          new Error("component unavailable")
        );

        yield* Effect.promise(() =>
          expect(
            t.mutation(internal.emails.welcome.enqueueWelcomeEmail, {
              html: "<p>Welcome</p>",
              text: "Welcome",
              userId,
            })
          ).rejects.toMatchObject({
            data: {
              code: "WELCOME_EMAIL_DELIVERY_FAILED",
              message: "Unable to enqueue the welcome email.",
            },
          })
        );
      })
  );
});
