import { expect, type Locator, test } from "@playwright/test";
import { Effect } from "effect";
import { readRepeatedIcons } from "@/e2e/support/icons";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The column width of a settings section, which its table shares with its cards. */
const COLUMN_WIDTH = 768;
/** The page's gutter around the card of a table page. */
const GUTTER = 16;

/** Reads where the card sits against the viewport and whether the page scrolls sideways. */
function readCard(card: Locator) {
  return card.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      bottom: box.bottom,
      sideways:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
      viewport: window.innerHeight,
      width: box.width,
    };
  });
}

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test.describe(`a School table page at ${viewport.width}px`, () => {
    test.use({ viewport });

    test("holds its list in one card at the settings column width that fills the body under the header", async ({
      browser,
      baseURL,
    }) => {
      const school = await Effect.runPromise(createSchool());
      const address = (path: string) =>
        hostAddress(baseURL, `${school.slug}.localhost`, path);
      const context = await browser.newContext({ viewport });
      await Effect.runPromise(signInOwner(context, school.slug, address("/")));
      const page = await context.newPage();

      await page.goto(address("/settings/members"));
      const card = page.locator('[data-slot="table-card"]');
      await expect(card).toHaveCount(1);
      await expect(card.locator("table")).toBeVisible({
        timeout: readinessTimeoutMilliseconds,
      });
      await expect(card.getByRole("row")).not.toHaveCount(0);

      const placed = await readCard(card);
      expect(placed.sideways).toBe(false);
      expect(placed.width).toBeLessThanOrEqual(COLUMN_WIDTH);
      // A short list still fills the body: the card reaches the gutter above the screen's bottom.
      expect(placed.bottom).toBeGreaterThanOrEqual(
        placed.viewport - GUTTER - 1
      );

      // Each value of the Filter menu draws an icon of its own, and each status cell is a toned badge.
      await page
        .locator("header")
        .getByRole("button", { name: "Filter" })
        .click();
      const menu = page.getByRole("menu");
      await expect(menu.getByRole("menuitemcheckbox")).not.toHaveCount(0);
      expect(await readRepeatedIcons(menu, "[role=menuitemcheckbox]")).toEqual(
        []
      );
      await page.keyboard.press("Escape");
      await expect(card.locator('[data-slot="badge"]').first()).toBeVisible();
      await context.close();
    });
  });
}

/**
 * The working tables of an exam (the exam list, its rooms, and a room's results) each fill one card
 * at the page width, give a state its badge, and keep a value that is not there yet in words.
 */
test("the exam list, its rooms and a room's results fill the page card, with states as badges and no blank cell", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `tables-${school.slug}@acceptance.example.test`;
  const studentContext = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context: studentContext,
      slug: school.slug,
    })
  );
  await studentContext.close();
  const context = await browser.newContext({
    viewport: { height: 900, width: 1920 },
  });
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const sitting = await Effect.runPromise(seedSitting(school.slug, learner, 2));
  const page = await context.newPage();

  // The exam list: its rooms one click away in their own column, and no row menu repeating the title.
  await page.goto(address("/exams"));
  const card = page.locator('[data-slot="table-card"]');
  await expect(card.getByRole("link", { name: "Rooms" }).first()).toBeVisible();
  await expect(card.getByRole("button", { name: "More actions" })).toHaveCount(
    0
  );
  expect((await card.boundingBox())?.width ?? 0).toBeLessThanOrEqual(1280);

  // The rooms: an open room's state is a badge with its icon.
  await page.goto(address(`/exams/${sitting.examId}`));
  const open = card.locator('[data-slot="badge"]').filter({ hasText: "Open" });
  await expect(open).toBeVisible();
  await expect(open.locator("svg")).toHaveCount(1);

  // The results while the room runs: in-progress badges, numbers not there yet in words, and the
  // sentence that says when results can be released, beside a Release results that waits.
  await page.goto(
    address(`/exams/${sitting.examId}/sittings/${sitting.sittingId}/results`)
  );
  await expect(
    card
      .locator('[data-slot="badge"]')
      .filter({ hasText: "In progress" })
      .first()
  ).toBeVisible();
  await expect(card.getByText("Not yet").first()).toBeVisible();
  await expect(
    card.getByText(
      "The exam author or the Admin releases the results once the sitting closes."
    )
  ).toBeVisible();
  await expect(
    page
      .locator('[data-slot="page-header"]')
      .getByRole("button", { exact: true, name: "Release results" })
  ).toBeDisabled();
  await context.close();
});
