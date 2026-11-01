import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { signInLearner } from "@/e2e/support/learner";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The connectors page after a connect that Google refused. */
const REFUSED =
  /\/en\/user\/settings\/connectors\?connect=refused&connector=calendar$/u;

/** The connectors page after a connect the learner stopped on Google's screen. */
const CANCELLED = /\?connect=cancelled&connector=calendar$/u;

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
    const plus = calendar.getByRole("button", {
      exact: true,
      name: "Connect Google Calendar",
    });
    await expect(plus).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });

    const startConnect = async () => {
      const consent = page.waitForURL(CONSENT);
      await waitUntilTakenOver(plus);
      await plus.click();
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
      `${site}/api/connectors/callback`
    );
    const state = first.searchParams.get("state") ?? "";
    await page.goto(
      `${site}/api/connectors/callback?state=${state}&code=not-a-code`
    );
    await page.waitForURL(REFUSED, {
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(page.getByRole("alert")).toContainText(
      "Tick every box at Google."
    );
    await expect(page.getByRole("alert")).toHaveCount(1);

    await page.goto(`${site}/en/user/settings/connectors`);
    const second = await startConnect();
    await page.goto(
      `${site}/api/connectors/callback?state=${second.searchParams.get("state") ?? ""}&error=access_denied`
    );
    await page.waitForURL(CANCELLED);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(plus).toBeVisible();

    // A replayed code goes home, and the root answers in the reader's language, English here.
    await page.goto(
      `${site}/api/connectors/callback?state=${state}&code=again`
    );
    await page.waitForURL(`${site}/en`);
    await context.close();
  });
}

test("the account lists a person's services like a school's library, and a pane opens only on a press", async ({
  browser,
  baseURL,
}) => {
  const site = baseURL ?? "";
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(signInLearner(context, site));
  const page = await context.newPage();
  await page.goto(`${site}/en/user/settings/connectors`);
  const cards = page.locator("[data-slot=card]");
  await expect(cards).toHaveCount(2, {
    timeout: readinessTimeoutMilliseconds,
  });
  const drive = cards.filter({ hasText: "Google Drive" });
  await expect(page.getByRole("complementary")).toHaveCount(0);

  const open = drive.getByRole("button", { exact: true, name: "Google Drive" });
  await waitUntilTakenOver(open);
  await open.click();
  const pane = page.getByRole("complementary", { name: "Connector detail" });
  await expect(pane.getByText("Not connected", { exact: true })).toBeVisible();
  await expect(pane.getByRole("button", { name: "Connect" })).toBeVisible();
  await pane.getByRole("button", { name: "Close" }).click();
  await expect(pane).toHaveCount(0);

  const search = page.getByPlaceholder("Search connectors");
  await search.fill("calendar");
  await expect(cards).toHaveCount(1);
  await search.fill("zzz");
  await expect(page.getByText("No connector found")).toBeVisible();
  await context.close();
});
