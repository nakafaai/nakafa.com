import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { runAcceptanceCommand } from "@/e2e/support/acceptance";
import {
  createSchool,
  hostAddress,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** A message key drawn as text, which a page shows when its namespace is not loaded. */
const RAW_KEY = /^Connectors\./u;

/** Google's consent screen, which the test answers itself. */
const CONSENT = "https://accounts.google.com/**";

/** The widths every state of the directory is pictured at: a phone, a tablet and a desktop. */
const WIDTHS = [390, 768, 1440] as const;

/** One service's card on the page. */
const cardOf = (page: Page, name: string) =>
  page.locator("[data-slot=card]").filter({ hasText: name });

/** Keeps a picture of the page at every width, each without a sideways scroll. */
async function picture(page: Page, state: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ height: 900, width });
    const sideways = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );
    expect(sideways, `${state} at ${width}`).toBe(0);
    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`connectors-${state}-${width}.png`),
    });
  }
  await page.setViewportSize({ height: 900, width: 1440 });
}

/** Opens a new school, signed in as `signIn` signs in, at its connectors page. */
async function openDirectory(
  context: BrowserContext,
  origin: string | undefined,
  signIn: typeof signInOwner,
  search = ""
) {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(origin, `${school.slug}.localhost`, path);
  await Effect.runPromise(signIn(context, school.slug, address("/")));
  const page = await context.newPage();
  await page.route(CONSENT, (route) =>
    route.fulfill({ body: "consent", contentType: "text/plain" })
  );
  await page.goto(address(`/settings/connections${search}`));
  await expect(page.getByText("Google Classroom", { exact: true })).toBeVisible(
    { timeout: readinessTimeoutMilliseconds }
  );
  return { page, slug: school.slug };
}

test("the Owner finds every service in words, searches them, and one press on plus goes to Google", async ({
  baseURL,
  browser,
}) => {
  const context = await browser.newContext();
  const { page } = await openDirectory(context, baseURL, signInOwner);
  const classroom = cardOf(page, "Google Classroom");

  await expect(classroom.getByText("Not connected.")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(classroom.getByText("School", { exact: true })).toBeVisible();
  await expect(
    cardOf(page, "Google Forms").getByText("Connects through Google Drive.")
  ).toBeVisible();
  await expect(page.locator("[data-slot=card]")).toHaveCount(4);
  await expect(page.getByText(RAW_KEY)).toHaveCount(0);
  await picture(page, "open");

  const search = page.getByRole("textbox", { name: "Search connectors" });
  await search.fill("form");
  await expect(page.locator("[data-slot=card]")).toHaveCount(1);
  await picture(page, "search");
  await search.fill("zoom");
  await expect(page.getByText("No connector found")).toBeVisible();
  await picture(page, "search-none");
  await search.fill("");

  const plus = classroom.getByRole("button", {
    name: "Connect Google Classroom",
  });
  await waitUntilTakenOver(plus);
  const consent = page.waitForURL(CONSENT);
  await plus.click();
  await consent;
  expect(new URL(page.url()).searchParams.get("scope")).toContain("classroom");
  await context.close();
});

test("a connect that ended badly says so on the card that tried, and plus starts it again", async ({
  baseURL,
  browser,
}) => {
  const context = await browser.newContext();
  const { page } = await openDirectory(
    context,
    baseURL,
    signInOwner,
    "?connect=refused&connector=classroom"
  );
  const classroom = cardOf(page, "Google Classroom");

  await expect(
    classroom.getByText("Tick every box on the Google screen.")
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await expect(page.getByRole("alert")).toHaveCount(1);
  await expect(
    classroom.getByRole("button", { name: "Connect Google Classroom" })
  ).toBeVisible();
  await picture(page, "refused");

  await page.goto(
    `${page.url().split("?")[0]}?connect=failed&connector=classroom`
  );
  await expect(
    classroom.getByText("The connect failed, so try again.")
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await expect(page.getByRole("alert")).toHaveCount(1);
  await picture(page, "failed");
  await context.close();
});

test("a connected school imports next and disconnects at once, and no state moves the card", async ({
  baseURL,
  browser,
}) => {
  const context = await browser.newContext();
  const { page, slug } = await openDirectory(context, baseURL, signInOwner);
  const classroom = cardOf(page, "Google Classroom");

  await page.setViewportSize({ height: 900, width: 1440 });
  await expect(classroom.getByText("Not connected.")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  const before = await classroom.boundingBox();

  await Effect.runPromise(runAcceptanceCommand("connection", slug, "active"));
  await expect(
    classroom.getByText("Connected.", { exact: true })
  ).toBeVisible();
  expect(await classroom.boundingBox()).toEqual(before);
  await picture(page, "connected");

  const importing = classroom.getByRole("button", { name: "Import classes" });
  await waitUntilTakenOver(importing);
  await importing.click();
  const sheet = page.getByRole("dialog", { name: "Classes in Classroom" });
  await expect(sheet).toBeVisible();
  await picture(page, "import");
  await sheet.getByRole("button", { name: "Close" }).last().click();
  await expect(sheet).toBeHidden();

  await classroom
    .getByRole("button", { name: "Manage Google Classroom" })
    .click();
  await page
    .getByRole("menuitem", { name: "Disconnect Google Classroom" })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Disconnect Google Classroom",
  });
  await picture(page, "disconnect");
  await dialog.getByRole("button", { name: "Disconnect" }).click();
  await expect(classroom.getByText("Not connected.")).toBeVisible();
  expect(await classroom.boundingBox()).toEqual(before);
  await context.close();
});

test("a connection Google stopped accepting says so, and connects again with one press", async ({
  baseURL,
  browser,
}) => {
  const context = await browser.newContext();
  const { page, slug } = await openDirectory(context, baseURL, signInOwner);
  const classroom = cardOf(page, "Google Classroom");

  await Effect.runPromise(
    runAcceptanceCommand("connection", slug, "reconnect")
  );
  await expect(classroom.getByText("Connection lost.")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await picture(page, "reconnect");
  const again = classroom.getByRole("button", { name: "Connect again" });
  await waitUntilTakenOver(again);
  const consent = page.waitForURL(CONSENT);
  await again.click();
  await consent;
  await context.close();
});

test("a teacher without the school's permission sees why, and keeps their own services", async ({
  baseURL,
  browser,
}) => {
  const context = await browser.newContext();
  const { page } = await openDirectory(context, baseURL, signInClassTeacher);
  const classroom = cardOf(page, "Google Classroom");

  await expect(
    classroom.getByText("Only an Admin can connect this.")
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await expect(classroom.getByRole("button")).toHaveCount(0);
  await expect(
    cardOf(page, "Google Drive").getByRole("button", {
      name: "Connect Google Drive",
    })
  ).toBeVisible();
  await picture(page, "locked");
  await context.close();
});
