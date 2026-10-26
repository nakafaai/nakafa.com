import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { signInLearner } from "@/e2e/support/learner";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** Google's consent screen, which the test answers itself. */
const CONSENT = "https://accounts.google.com/**";

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test(`a learner starts a Calendar connect with PKCE, comes back to Connectors, and sees a refused connect named, at ${viewport.width} px`, async ({
    browser,
    baseURL,
  }) => {
    const site = baseURL ?? "";
    const context = await browser.newContext({ viewport });
    await Effect.runPromise(signInLearner(context, site));
    const page = await context.newPage();
    await page.route(CONSENT, (route) =>
      route.fulfill({ body: "consent", contentType: "text/plain" })
    );
    await page.goto(`${site}/en/user/settings/connectors`);
    const calendar = page
      .locator("[data-slot=card]")
      .filter({ hasText: "Google Calendar" });
    await expect(calendar.getByText("Not connected.")).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });

    const startConnect = async () => {
      const consent = page.waitForURL(CONSENT);
      await calendar.getByRole("button", { name: "Connect" }).click();
      await consent;
      return new URL(page.url());
    };

    const first = await startConnect();
    expect(first.searchParams.get("code_challenge_method")).toBe("S256");
    expect(first.searchParams.get("access_type")).toBe("offline");
    expect(first.searchParams.get("include_granted_scopes")).toBeNull();
    expect(first.searchParams.get("scope")).toBe(
      "openid https://www.googleapis.com/auth/calendar.events.readonly"
    );
    expect(first.searchParams.get("redirect_uri")).toBe(
      `${site}/api/connectors/google/callback`
    );
    const state = first.searchParams.get("state") ?? "";
    await page.goto(
      `${site}/api/connectors/google/callback?state=${state}&code=not-a-code`
    );
    await page.waitForURL(
      /\/en\/user\/settings\/connectors\?connect=refused$/u,
      {
        timeout: readinessTimeoutMilliseconds,
      }
    );
    await expect(page.getByRole("alert")).toContainText("Not connected");

    await page.goto(`${site}/en/user/settings/connectors`);
    const second = await startConnect();
    await page.goto(
      `${site}/api/connectors/google/callback?state=${second.searchParams.get("state") ?? ""}&error=access_denied`
    );
    await page.waitForURL(/\?connect=cancelled$/u);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(calendar.getByText("Not connected.")).toBeVisible();

    await page.goto(
      `${site}/api/connectors/google/callback?state=${state}&code=again`
    );
    await page.waitForURL(`${site}/`);
    await context.close();
  });
}
