import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { setLargeText } from "@/e2e/support/footer";
import { expectNoOverflow } from "@/e2e/support/layout";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { compactViewport } from "@/e2e/support/viewport";

/** The Owner's pages that hold the most in their header and their tables. */
const OWNER_PAGES = [
  "/",
  "/exams",
  "/reports",
  "/notifications",
  "/settings/members",
  "/settings/roles",
  "/settings/students",
  "/settings/invites",
  "/settings/audit",
  "/settings/billing",
];

/** The controls of the page header that show, each with how far it reaches past either side of the window. */
function headerControlsOutside(page: Page) {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-slot="page-header"] :is(a, button, input, [role="combobox"])'
      )
    )
      .map((control) => ({
        name:
          control.getAttribute("aria-label") ??
          control.textContent?.trim() ??
          control.tagName,
        rect: control.getBoundingClientRect(),
      }))
      .filter(
        ({ rect }) =>
          rect.width > 0 &&
          (rect.left < -0.5 || rect.right > window.innerWidth + 0.5)
      )
      .map(({ name }) => name)
  );
}

/**
 * Opens each page at the compact phone with the text at 200 percent, and asserts that the page reads its
 * data, keeps every header control inside the window, and never scrolls sideways.
 */
async function expectLargeTextPages(
  context: BrowserContext,
  address: (path: string) => string,
  pages: readonly string[]
) {
  const page = await context.newPage();
  for (const path of pages) {
    await page.goto(address(path));
    await expect(page.locator('[data-slot="page-header"]'), path).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    expect(await Effect.runPromise(setLargeText(page)), path).toBe("32px");
    await expect(
      page.getByText("We could not load this data."),
      path
    ).toHaveCount(0);
    expect(await headerControlsOutside(page), path).toEqual([]);
    await Effect.runPromise(expectNoOverflow(page, `200% ${path}`));
  }
  await page.close();
}

test("an Owner and a Student read every page on a 320 px phone with the text at 200 percent, with every header control in reach", async ({
  baseURL,
  browser,
}) => {
  test.setTimeout(300_000);
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const viewport = {
    height: compactViewport.height,
    width: compactViewport.width,
  };
  const learner = `student-${school.slug}@acceptance.example.test`;
  const student = await browser.newContext({ viewport });
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context: student,
      slug: school.slug,
    })
  );
  const owner = await browser.newContext({ viewport });
  await Effect.runPromise(signInOwner(owner, school.slug, address("/")));
  const sitting = await Effect.runPromise(seedSitting(school.slug, learner));

  await expectLargeTextPages(owner, address, [
    ...OWNER_PAGES,
    `/exams/${sitting.examId}/sittings/${sitting.sittingId}`,
  ]);
  await owner.close();
  await expectLargeTextPages(student, address, [
    "/sittings",
    "/notifications",
    `/sittings/${sitting.sittingId}`,
  ]);
  await student.close();
});
