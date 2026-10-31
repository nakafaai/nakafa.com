import { expect, test } from "@playwright/test";
import { Clock, Duration, Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { signInLearner } from "@/e2e/support/learner";
import { finishSchoolStart } from "@/e2e/support/school";

/** The address of the Exams page, where the new Owner lands. */
const EXAMS_ADDRESS = /\/exams$/u;

/** The target of K42: from signing in to a school that is ready, under two minutes. */
const TARGET = Duration.minutes(2);

/** What a person spends reading and answering one of the five questions, which a browser test does not. */
const READING = Duration.seconds(10);

/** The time the page itself may take, once a person has read the five questions. */
const PAGE_BUDGET = Duration.subtract(TARGET, Duration.times(READING, 5));

/** The screens K42 is held to: a phone and a laptop. */
const VIEWPORTS = [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
];

for (const viewport of VIEWPORTS) {
  test(`a new account has a ready school within two minutes at ${viewport.width} px`, async ({
    baseURL,
    browser,
  }, testInfo) => {
    const context = await browser.newContext({ viewport });
    await Effect.runPromise(signInLearner(context, String(baseURL)));
    const page = await context.newPage();
    const tag = `${testInfo.testId.slice(0, 6)}${testInfo.repeatEachIndex}${testInfo.retry}`;
    const name = `Harapan ${tag}`;
    const started = await Effect.runPromise(Clock.currentTimeMillis);

    await page.goto("/en/school/new");
    await expect(page.getByText("Question 1 of 5")).toBeVisible();
    await page.getByLabel("School name").fill(name);
    await expect(page.getByText("Available")).toBeAttached();
    const proceed = page.getByRole("button", { name: "Continue" });
    await proceed.click();
    await page.getByRole("radio", { name: "Indonesia" }).click();
    await proceed.click();
    await page.getByRole("checkbox", { name: "SMP" }).click();
    await proceed.click();
    await page.getByRole("radio", { name: "Teacher" }).click();
    await proceed.click();

    // Each size names the plan suggested for it before the founder chooses.
    await expect(
      page.getByText("Free plan, up to 100 students.")
    ).toBeVisible();
    await expect(page.getByText("School plan, paid per student.")).toHaveCount(
      2
    );
    await expect(
      page.getByText("School plan, with the founder's help.")
    ).toBeVisible();
    await page.getByRole("radio", { name: "Under 100" }).click();
    await Effect.runPromise(
      finishSchoolStart(page, baseURL, { name, slug: `harapan-${tag}` })
    );

    await page.waitForURL(EXAMS_ADDRESS);
    await expect(
      page.getByRole("button", { name: "Create exam" })
    ).toBeVisible();
    const finished = await Effect.runPromise(Clock.currentTimeMillis);
    expect(finished - started).toBeLessThan(Duration.toMillis(PAGE_BUDGET));
    await context.close();
  });
}

test("the home page's school band copies the one link a new school opens from", async ({
  browser,
}) => {
  const context = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  await Effect.runPromise(seedAnalyticsConsent(page, "denied"));
  await page.goto("/en");
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("button", { name: "Link copied" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(new URL(copied).pathname).toBe("/en/school/new");
  await context.close();
});
