import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, inviteLearner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

const INVITED = "You have been invited to join this school.";

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test(`a learner reads this school's notifications on the school's host and filters to every school, without an error or a sideways scroll, at ${viewport.width} px`, async ({
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
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(address("/notifications"));

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
    await expect(page).toHaveURL(/\/notifications\?schools=all$/u);
    await expect(page.getByText(INVITED)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "All schools" })
    ).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    expect(errors).toEqual([]);
    await context.close();
  });
}
