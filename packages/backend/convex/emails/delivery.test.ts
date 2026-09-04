import { Resend } from "@convex-dev/resend";
import resendTest from "@convex-dev/resend/test";
import { describe, expect, it } from "@effect/vitest";
import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import { components, internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { insertTestPage } from "@repo/backend/test/content/page";
import { insertRuntimeRelease } from "@repo/backend/test/content/runtime";
import { convexTest } from "convex-test";

const testResend = new Resend(components.resend, {
  apiKey: "re_test_welcome_delivery",
  testMode: true,
});

function localizedPagePath(
  locale: ActiveAppLocaleCode,
  pageKey: "privacy-policy" | "terms-of-service"
) {
  if (locale === "en") {
    return pageKey === "privacy-policy" ? "privacy-current" : "terms-current";
  }

  return `${pageKey}-${locale}`;
}

describe("emails/delivery", () => {
  it("renders and atomically enqueues a repository-owned welcome email", async () => {
    const t = convexTest(schema, convexModules);
    resendTest.register(t);
    const userId = await t.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx, ["page"]);
      for (const locale of ACTIVE_APP_LOCALE_CODES) {
        await insertTestPage(
          ctx,
          locale,
          "privacy-policy",
          localizedPagePath(locale, "privacy-policy")
        );
        await insertTestPage(
          ctx,
          locale,
          "terms-of-service",
          localizedPagePath(locale, "terms-of-service")
        );
      }

      return ctx.db.insert("users", {
        authId: "welcome-owner",
        credits: 0,
        creditsResetAt: 0,
        email: "delivered@resend.dev",
        name: "Welcome Owner",
        plan: "free",
      });
    });

    const input = await t.query(internal.emails.welcome.readWelcomeEmailInput, {
      userId,
    });
    expect(input).toEqual({
      email: "delivered@resend.dev",
      name: "Welcome Owner",
      privacyPolicyUrl: "http://localhost:3000/en/privacy-current",
      startLearningUrl: "http://localhost:3000/en",
      termsOfServiceUrl: "http://localhost:3000/en/terms-current",
    });

    await t.action(internal.emails.delivery.sendWelcomeEmail, { userId });

    const user = await t.query((ctx) => ctx.db.get("users", userId));
    const welcomeEmailId = user?.welcomeEmailId;
    if (!welcomeEmailId) {
      throw new Error("Expected the welcome delivery handle.");
    }
    const email = await t.query((ctx) => testResend.get(ctx, welcomeEmailId));

    expect(email).toMatchObject({
      subject: "Your Nakafa account is ready",
      to: ["delivered@resend.dev"],
    });
    expect(email).not.toHaveProperty("template");
    expect(email?.html).not.toContain("Welcome Owner");
    expect(email?.html).toContain("http://localhost:3000/en");
    expect(email?.html).toContain("http://localhost:3000/en/privacy-current");
    expect(email?.html).toContain("http://localhost:3000/en/terms-current");
    expect(email?.text).not.toContain("Welcome Owner");
    expect(email?.text).toContain("http://localhost:3000/en");
    expect(email?.text).toContain("http://localhost:3000/en/privacy-current");
    expect(email?.text).toContain("http://localhost:3000/en/terms-current");
  });

  it("stops before rendering when the user no longer exists", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation((ctx) =>
      ctx.db.insert("users", {
        authId: "removed-welcome-owner",
        credits: 0,
        creditsResetAt: 0,
        email: "removed@example.com",
        name: "Removed Welcome Owner",
        plan: "free",
      })
    );
    await t.mutation((ctx) => ctx.db.delete("users", userId));

    await expect(
      t.action(internal.emails.delivery.sendWelcomeEmail, { userId })
    ).resolves.toBeNull();
  });
});
