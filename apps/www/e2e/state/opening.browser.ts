import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { signInLearner } from "@/e2e/support/learner";
import { expectPopupOpensWhole } from "@/e2e/support/opening";
import {
  createSchool,
  hostAddress,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** A dialog on a desktop, and the drawer it becomes on a phone. */
const viewports = [
  { height: 900, name: "desktop", width: 1440 },
  { height: 844, name: "phone", width: 320 },
];

/** The popups of a school that read what they show, each with the page and the button that opens it. */
const schoolPopups = [
  { button: "Preferences", path: "/notifications" },
  { button: "Competencies", path: "/insight" },
  { button: "Create webhook", path: "/settings/webhooks" },
];

/** Opens a page, and presses its button once the page has taken over. */
const openWhole = async (page: Page, address: string, button: string) => {
  await page.goto(address);
  const control = page.getByRole("button", { exact: true, name: button });
  await waitUntilTakenOver(control);
  await expectPopupOpensWhole(page, control);
};

for (const viewport of viewports) {
  test(`a school's popups open whole on a ${viewport.name}`, async ({
    baseURL,
    browser,
  }) => {
    test.slow();
    const school = await Effect.runPromise(createSchool());
    const host = `${school.slug}.localhost`;
    // Insight names what questions test only for a class, so a class teacher
    // opens the school's first class before the Owner reads the page.
    const teacher = await browser.newContext();
    await Effect.runPromise(
      signInClassTeacher(teacher, school.slug, hostAddress(baseURL, host, "/"))
    );
    await teacher.close();
    const context = await browser.newContext({ viewport });
    await Effect.runPromise(
      signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
    );
    const page = await context.newPage();
    for (const { button, path } of schoolPopups) {
      await openWhole(page, hostAddress(baseURL, host, path), button);
    }
    await context.close();
  });

  test(`the inbox's preferences open whole on a ${viewport.name}`, async ({
    baseURL,
    browser,
  }) => {
    const context = await browser.newContext({ viewport });
    await Effect.runPromise(signInLearner(context, String(baseURL)));
    const page = await context.newPage();
    await openWhole(
      page,
      String(new URL("/en/notifications", baseURL)),
      "Preferences"
    );
    const panel = page.getByRole("dialog", { name: "Preferences" });
    await expect(panel.getByRole("switch").first()).toBeVisible();
    const dimensions = await panel.evaluate((sheet) => {
      const card = sheet.querySelector('[data-slot="table-card"]');
      const viewport = card?.querySelector(
        '[data-slot="scroll-area-viewport"]'
      );
      const footer = sheet.querySelector('[data-slot="sheet-footer"]');
      const body = sheet.querySelector('[data-slot="sheet-frame"]');
      if (!(card && viewport && footer && body)) {
        return null;
      }
      return {
        gutter: Math.round(
          footer.getBoundingClientRect().top -
            card.getBoundingClientRect().bottom
        ),
        sheetScroll: body.scrollHeight - body.clientHeight,
        tableOverflow: viewport.scrollWidth - viewport.clientWidth,
      };
    });
    expect(dimensions).toEqual({
      gutter: 16,
      sheetScroll: 0,
      tableOverflow: 0,
    });
    await context.close();
  });
}
