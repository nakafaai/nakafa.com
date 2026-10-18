import { expect, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { signInLearner } from "@/e2e/support/learner";
import { hostAddress } from "@/e2e/support/school";

test("a new account opens its own school in five questions and lands in it as its Owner", async ({
  baseURL,
  browser,
}, testInfo) => {
  const context = await browser.newContext();
  await Effect.runPromise(signInLearner(context, String(baseURL)));
  const page = await context.newPage();
  const tag = `${testInfo.testId.slice(0, 6)}${testInfo.repeatEachIndex}${testInfo.retry}`;
  const name = `Harapan ${tag}`;
  const slug = `harapan-${tag}`;

  await page.goto("/en/school/new");
  await expect(page.getByText("Question 1 of 5")).toBeVisible();

  // A reserved address keeps the question here, with its reason.
  await page.getByLabel("School name").fill("New");
  await expect(page.getByText("This address is reserved.")).toBeVisible();

  // The address follows the name, and the server says it is free.
  await page.getByLabel("School name").fill(name);
  await expect(page.getByLabel("Address")).toHaveValue(slug);
  await expect(page.getByText("Available")).toBeAttached();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByText("Indonesia", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // A reload resumes at the first open question, with the answers kept.
  await page.reload();
  await expect(page.getByText("Question 3 of 5")).toBeVisible();
  await page.getByText("SD", { exact: true }).click();
  await page.getByText("SMP", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByText("Teacher", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByText("100 to 499", { exact: true }).click();
  await expect(page.getByRole("link", { name: "Terms" })).toBeVisible();
  await page.getByRole("button", { name: "Open school" }).click();

  // The school shows at once, then its own address opens.
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.waitForURL(hostAddress(baseURL, `${slug}.localhost`, "/"));

  // The account's session reaches the school's host as it does in production.
  const schoolHome = hostAddress(baseURL, `${slug}.localhost`, "/");
  const cookies = await context.cookies(String(baseURL));
  await context.addCookies(
    Arr.map(cookies, (cookie) => ({
      httpOnly: cookie.httpOnly,
      name: cookie.name,
      sameSite: cookie.sameSite,
      url: schoolHome,
      value: cookie.value,
    }))
  );
  await page.reload();
  await expect(page.getByText("You are signed in as Owner.")).toBeVisible();
  // The tab names the school.
  await expect(page).toHaveTitle(new RegExp(name));
  await context.close();
});
