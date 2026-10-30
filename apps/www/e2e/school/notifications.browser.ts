import { expect, test } from "@playwright/test";
import { Effect, MutableList } from "effect";
import { createSchool, hostAddress, inviteLearner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

const INVITED = "You have been invited to join this school.";

/** The page's address with this school's rows, and with every school's. */
const THIS_SCHOOL = /\/notifications$/u;
const ALL_SCHOOLS = /\/notifications\?schools=all$/u;

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test(`a learner opens this school's notifications from the sidebar and filters to every school, without an error or a sideways scroll, at ${viewport.width} px`, async ({
    browser,
    baseURL,
  }) => {
    const school = await Effect.runPromise(createSchool());
    const address = (path: string) =>
      hostAddress(baseURL, `${school.slug}.localhost`, path);
    const context = await browser.newContext({ viewport });
    await Effect.runPromise(
      inviteLearner({
        address: `student-${school.slug}@acceptance.example.test`,
        baseURL: address("/"),
        context,
        slug: school.slug,
      })
    );
    const page = await context.newPage();
    const errors = MutableList.make<string>();
    page.on("pageerror", (error) => MutableList.append(errors, String(error)));
    await page.goto(address("/"));

    // The sidebar's main pages lead to it; on a phone the sidebar opens from its trigger.
    if (viewport.width < 768) {
      const trigger = page.getByRole("button", { name: "Toggle Sidebar" });
      await waitUntilTakenOver(trigger);
      await trigger.click();
    }
    const entry = page.getByRole("link", {
      name: "Notifications",
      exact: true,
    });
    await waitUntilTakenOver(entry);
    await entry.click();
    await expect(page).toHaveURL(THIS_SCHOOL);
    // On a phone the sidebar steps aside for the page it opened.
    await expect(page.getByRole("dialog", { name: "Sidebar" })).toBeHidden();

    await expect(
      page.getByRole("heading", { name: "Notifications", level: 1 })
    ).toBeAttached();
    await expect(page.getByText(INVITED)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });

    const filter = page.getByRole("button", { name: "This school" });
    await waitUntilTakenOver(filter);
    await filter.click();
    await page.getByRole("menuitemradio", { name: "All schools" }).click();
    await expect(page).toHaveURL(ALL_SCHOOLS);
    await expect(page.getByText(INVITED)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "All schools" })
    ).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    expect(MutableList.toArray(errors)).toEqual([]);
    await context.close();
  });
}
