import { type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { signInLearner } from "@/e2e/support/learner";
import { expectPopupOpensWhole } from "@/e2e/support/opening";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** A dialog on a desktop, and the drawer it becomes on a phone. */
const viewports = [
  { height: 900, name: "desktop", width: 1440 },
  { height: 844, name: "phone", width: 390 },
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
    await context.close();
  });
}
