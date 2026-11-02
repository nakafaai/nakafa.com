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

/** Every card of the directory. */
const cards = (page: Page) => page.locator("[data-slot=card]");

/** One service's card on the page. */
const cardOf = (page: Page, name: string) =>
  cards(page).filter({ hasText: name });

/** The press on a card, which opens its service. */
const openOf = (page: Page, name: string) =>
  cardOf(page, name).getByRole("button", { exact: true, name });

/** Keeps a picture of the page at every width, each without a sideways scroll. */
async function picture(page: Page, state: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ height: 900, width });
    // The page reads as wide as it was until it has laid itself out at the new width.
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              document.documentElement.scrollWidth -
              document.documentElement.clientWidth
          ),
        { message: `${state} at ${width}` }
      )
      .toBe(0);
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
  await expect(
    page.getByRole("button", { exact: true, name: "Google Classroom" })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  return { page, slug: school.slug };
}

test("the Owner finds every service in a library, searches and filters it, and one press on plus goes to Google", async ({
  baseURL,
  browser,
}) => {
  const context = await browser.newContext();
  const { page } = await openDirectory(context, baseURL, signInOwner);
  const classroom = cardOf(page, "Google Classroom");

  await expect(classroom.getByText("by Google")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(cards(page)).toHaveCount(4);
  await expect(page.getByText(RAW_KEY)).toHaveCount(0);
  await picture(page, "open");

  const search = page.getByRole("textbox", { name: "Search connectors" });
  await search.fill("form");
  await expect(cards(page)).toHaveCount(1);
  await picture(page, "search");
  await search.fill("zoom");
  await expect(page.getByText("No connector found")).toBeVisible();
  await picture(page, "search-none");
  await search.fill("");

  await page.getByRole("button", { name: "Filter connectors" }).click();
  await page.getByRole("menuitemradio", { name: "Schedule" }).click();
  await expect(cards(page)).toHaveCount(1);
  await expect(cardOf(page, "Google Calendar")).toBeVisible();
  await picture(page, "filter");
  await page.getByRole("button", { name: "Filter connectors" }).click();
  await page.getByRole("menuitemradio", { name: "All" }).click();
  await expect(cards(page)).toHaveCount(4);

  await openOf(page, "Google Forms").click();
  const detail = page.getByRole("complementary", { name: "Connector detail" });
  await expect(detail.getByText("Not connected yet")).toBeVisible();
  await expect(detail.getByText("Your account")).toBeVisible();
  await picture(page, "detail");

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

  await expect(classroom.getByText("Tick every box at Google.")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(page.getByRole("alert")).toHaveCount(1);
  await expect(
    classroom.getByRole("button", { name: "Connect Google Classroom" })
  ).toBeVisible();
  await picture(page, "refused");

  await page.goto(
    `${page.url().split("?")[0]}?connect=failed&connector=classroom`
  );
  await expect(classroom.getByText("Connect failed, try again.")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(page.getByRole("alert")).toHaveCount(1);
  await picture(page, "failed");
  await context.close();
});

test("a connected school sees the check, finds its courses in the detail, and disconnects at once, and no state moves the card", async ({
  baseURL,
  browser,
}) => {
  const context = await browser.newContext();
  const { page, slug } = await openDirectory(context, baseURL, signInOwner);
  const classroom = cardOf(page, "Google Classroom");

  await page.setViewportSize({ height: 900, width: 1440 });
  await expect(classroom.getByText("by Google")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  const before = await classroom.boundingBox();

  await Effect.runPromise(runAcceptanceCommand("connection", slug, "active"));
  await expect(
    classroom.getByRole("img", { name: "Connected." })
  ).toBeVisible();
  expect(await classroom.boundingBox()).toEqual(before);
  await picture(page, "connected");

  await openOf(page, "Google Classroom").click();
  const detail = page.getByRole("complementary", { name: "Connector detail" });
  await expect(detail.getByText("Connected", { exact: true })).toBeVisible();
  await expect(detail.getByText("This school")).toHaveCount(0);
  await picture(page, "import");
  // The open pane takes its share of the page, so the card is measured beside it from here on.
  const beside = await classroom.boundingBox();

  await detail.getByRole("button", { exact: true, name: "Disconnect" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Disconnect Google Classroom",
  });
  await expect(dialog).toBeVisible();
  // The pane becomes a sheet on a narrower page and takes its dialog with it, so this state is pictured as it stands.
  await page.screenshot({
    fullPage: true,
    path: test.info().outputPath("connectors-disconnect-1440.png"),
  });
  await dialog.getByRole("button", { name: "Disconnect" }).click();
  await expect(
    classroom.getByRole("button", { name: "Connect Google Classroom" })
  ).toBeVisible();
  await expect(
    detail.getByRole("button", { exact: true, name: "Connect" })
  ).toBeVisible();
  expect(await classroom.boundingBox()).toEqual(beside);
  await context.close();
});

test("a connect that just finished opens its service, where the next step waits", async ({
  baseURL,
  browser,
}) => {
  const context = await browser.newContext();
  const { page, slug } = await openDirectory(context, baseURL, signInOwner);

  await Effect.runPromise(runAcceptanceCommand("connection", slug, "active"));
  await page.goto(
    `${page.url().split("?")[0]}?connect=connected&connector=classroom`
  );
  await expect(
    page
      .getByRole("complementary", { name: "Connector detail" })
      .getByText("Connected", { exact: true })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
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
  const again = classroom.getByRole("button", {
    name: "Connect Google Classroom again",
  });
  await waitUntilTakenOver(again);
  const consent = page.waitForURL(CONSENT);
  await again.click();
  await consent;
  await context.close();
});

test("a teacher, who does not manage the school, does not open its connections", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(
    signInClassTeacher(context, school.slug, address("/"))
  );
  const page = await context.newPage();
  await page.goto(address("/settings/connections"));

  await expect(page.getByText("We can't find this page").first()).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(cards(page)).toHaveCount(0);
  await picture(page, "locked");
  await context.close();
});
