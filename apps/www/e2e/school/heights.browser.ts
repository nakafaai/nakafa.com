import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The height of every control of a School page header: the design system's default button and field. */
const CONTROL_HEIGHT = 36;

/**
 * The heights of the controls a page's header shows at its end, its buttons, its links drawn as buttons and its
 * fields, leaving out the path's own links, which are text.
 */
function readControlHeights(page: Page) {
  return page
    .locator('[data-slot="page-header"]')
    .first()
    .evaluate((header) =>
      Array.from(header.querySelectorAll("button, a, input"))
        .filter(
          (control) =>
            control.closest('nav[aria-label="Breadcrumb"]') === null &&
            control.getBoundingClientRect().height > 0
        )
        .map((control) => ({
          height: Math.round(control.getBoundingClientRect().height),
          name:
            control.getAttribute("aria-label") ??
            control.getAttribute("placeholder") ??
            control.textContent?.trim() ??
            "",
        }))
    );
}

test("every School page header holds controls of one height", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `heights-${school.slug}@acceptance.example.test`;
  const learnerContext = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context: learnerContext,
      slug: school.slug,
    })
  );
  await learnerContext.close();
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const sitting = await Effect.runPromise(seedSitting(school.slug, learner));
  const page = await context.newPage();

  // Each page and a control that tells its header has drawn its end.
  const pages = [
    { drawn: "Create exam", path: "/exams" },
    { drawn: "Mark all read", path: "/notifications" },
    { drawn: "Invite", path: "/settings/members" },
    { drawn: "Add period", path: "/settings/periods" },
    { drawn: "Add cohort", path: "/settings/cohorts" },
    { drawn: "Edit", path: `/exams/${sitting.examId}` },
  ];
  for (const { drawn, path } of pages) {
    await page.goto(address(path));
    await expect(
      page
        .locator('[data-slot="page-header"]')
        .getByRole("button", { name: drawn })
        .or(
          page
            .locator('[data-slot="page-header"]')
            .getByRole("link", { name: drawn })
        )
    ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    const controls = await readControlHeights(page);
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      expect(control, `${path}: ${control.name}`).toMatchObject({
        height: CONTROL_HEIGHT,
      });
    }
  }
  await context.close();
});
