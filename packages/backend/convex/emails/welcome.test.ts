import { canonicalizePublicPageProjection } from "@nakafa/aksara-contracts/projection/page";
import { internal } from "@repo/backend/convex/_generated/api";
import { resend } from "@repo/backend/convex/emails/client";
import { resolveWelcomeEmailLinks } from "@repo/backend/convex/emails/welcome";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  makeTestPageProjection,
  TEST_PAGE_PROJECTION_JSON,
} from "@repo/backend/test/content-page";
import { TEST_ARTICLE_PROJECTION_JSON } from "@repo/backend/test/content-runtime";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

const SITE_URL = new URL("https://nakafa.com");

function pageJson(pageKey: string, publicPath: string) {
  return canonicalizePublicPageProjection(
    makeTestPageProjection("en", pageKey, publicPath)
  );
}

describe("emails/welcome", () => {
  it("resolves legal URLs from the signed English Page projections", async () => {
    await expect(
      Effect.runPromise(
        resolveWelcomeEmailLinks(
          {
            managed: true,
            projectionJson: [
              pageJson("privacy-policy", "privacy-current"),
              pageJson("terms-of-service", "terms-current"),
            ],
          },
          SITE_URL
        )
      )
    ).resolves.toEqual({
      privacyPolicyUrl: "https://nakafa.com/en/privacy-current",
      startLearningUrl: "https://nakafa.com/en",
      termsOfServiceUrl: "https://nakafa.com/en/terms-current",
    });
  });

  it.each([
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
  ])("rejects %s", async (_label, catalog) => {
    await expect(
      Effect.runPromise(resolveWelcomeEmailLinks(catalog, SITE_URL))
    ).rejects.toMatchObject({
      _tag: "ReleaseError",
      code: "CONTENT_RELEASE_INTEGRITY",
    });
  });

  it("skips enqueue when the recipient disappeared or entered deletion", async () => {
    const t = convexTest(schema, convexModules);
    const deletedUserId = await t.mutation((ctx) =>
      ctx.db.insert("users", {
        authId: "deleted-welcome-owner",
        credits: 0,
        creditsResetAt: 0,
        email: "deleted@example.com",
        name: "Deleted Welcome Owner",
        plan: "free",
      })
    );
    const pendingUserId = await t.mutation((ctx) =>
      ctx.db.insert("users", {
        authId: "pending-welcome-owner",
        credits: 0,
        creditsResetAt: 0,
        deletionPreparedAt: 1,
        email: "pending@example.com",
        name: "Pending Welcome Owner",
        plan: "free",
      })
    );
    await t.mutation((ctx) => ctx.db.delete("users", deletedUserId));

    for (const userId of [deletedUserId, pendingUserId]) {
      await expect(
        t.mutation(internal.emails.welcome.enqueueWelcomeEmail, {
          html: "<p>Welcome</p>",
          text: "Welcome",
          userId,
        })
      ).resolves.toBeNull();
    }
  });

  it("translates a component enqueue failure into a typed Convex error", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation((ctx) =>
      ctx.db.insert("users", {
        authId: "failed-welcome-owner",
        credits: 0,
        creditsResetAt: 0,
        email: "failed@example.com",
        name: "Failed Welcome Owner",
        plan: "free",
      })
    );
    vi.spyOn(resend, "sendEmail").mockRejectedValueOnce(
      new Error("component unavailable")
    );

    await expect(
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
    });
  });
});
