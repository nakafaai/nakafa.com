import { expect, type Frame, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { saved, trackChanges } from "@/e2e/support/changes";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { signInLearner } from "@/e2e/support/learner";
import { hostAddress } from "@/e2e/support/school";

test("a new account opens its own school in five questions and lands in it as its Owner", async ({
  baseURL,
  browser,
}, testInfo) => {
  const context = await browser.newContext();
  await Effect.runPromise(signInLearner(context, String(baseURL)));
  const page = await context.newPage();
  const changes = await Effect.runPromise(trackChanges(page, []));
  const tag = `${testInfo.testId.slice(0, 6)}${testInfo.repeatEachIndex}${testInfo.retry}`;
  const name = `Harapan ${tag}`;
  const slug = `harapan-${tag}`;

  // The home page's school band opens the questionnaire. The usage data prompt is
  // decided first, so it does not cover the band.
  await Effect.runPromise(seedAnalyticsConsent(page, "denied"));
  await page.goto("/en");
  await page.getByRole("link", { name: "Open a school" }).click();
  await page.waitForURL("**/en/school/new");
  await expect(page.getByText("Question 1 of 5")).toBeVisible();

  // A reserved address keeps the question here, with its reason.
  await page.getByLabel("School name").fill("New");
  await expect(page.getByText("This address is reserved.")).toBeVisible();

  // The address follows the name, and the server says it is free.
  await page.getByLabel("School name").fill(name);
  await expect(page.getByLabel("Address")).toHaveValue(slug);
  await expect(page.getByText("Available")).toBeAttached();
  const sentBefore = changes.sent;
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("radio", { name: "Indonesia" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // A reload resumes at the first open question, with the answers kept. It
  // waits for the server to have both answers: a reload drops a save still on
  // its way.
  await saved(changes, sentBefore);
  await page.reload();
  await expect(page.getByText("Question 3 of 5")).toBeVisible();
  await page.getByRole("checkbox", { name: "SD" }).click();
  await page.getByRole("checkbox", { name: "SMP" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("radio", { name: "Teacher" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("radio", { name: "100 to 499" }).click();
  await expect(page.getByRole("link", { name: "Terms" })).toBeVisible();
  // The page opens the school's own host at SITE_URL's port. A verify run may
  // serve the site on another port, where that navigation commits the browser's
  // error page, so the test waits for the page's own navigation to commit, on
  // either, before it opens the host at the port this run serves.
  const opened = Effect.runPromise(
    Effect.callback<void>((resume) => {
      const committed = (frame: Frame) => {
        const url = new URL(frame.url());
        if (
          frame === page.mainFrame() &&
          (url.hostname === `${slug}.localhost` ||
            url.protocol === "chrome-error:")
        ) {
          page.off("framenavigated", committed);
          resume(Effect.void);
        }
      };
      page.on("framenavigated", committed);
    })
  );
  await page.getByRole("button", { name: "Open school" }).click();

  // The school shows at once, then its own address opens.
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await opened;
  await page.goto(hostAddress(baseURL, `${slug}.localhost`, "/"));

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

test("a founder types a school name a letter at a time, and the name, the address, Back and the browser's history all keep it", async ({
  baseURL,
  browser,
}, testInfo) => {
  const context = await browser.newContext();
  await Effect.runPromise(signInLearner(context, String(baseURL)));
  const page = await context.newPage();
  const tag = `${testInfo.testId.slice(0, 6)}${testInfo.repeatEachIndex}${testInfo.retry}`;
  const name = `Tunas ${tag}`;
  const slug = `tunas-${tag}`;

  await page.goto("/en/school/new");
  await expect(page.getByText("Question 1 of 5")).toBeVisible();
  const nameField = page.getByLabel("School name");
  const address = page.getByLabel("Address");

  // A person types with pauses, so the address follows each letter and the server
  // checks it between them; both fields stay on the page through every letter, and
  // the error that comes and goes on the way never moves the button below.
  const proceed = page.getByRole("button", { name: "Continue" });
  await nameField.click();
  const before = await proceed.boundingBox();
  await Effect.runPromise(
    Effect.forEach(
      Arr.fromIterable(name),
      (letter, index) =>
        Effect.promise(async () => {
          await page.keyboard.type(letter, { delay: 120 });
          await expect(nameField).toBeVisible();
          await expect(address).toBeVisible();
          await expect(nameField).toHaveValue(name.slice(0, index + 1));
          expect(await proceed.boundingBox()).toEqual(before);
        }),
      { discard: true }
    )
  );
  await expect(address).toHaveValue(slug);
  await expect(page.getByText("Available")).toBeAttached();

  // Continue and Back return to the name as it was typed.
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Question 2 of 5")).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(nameField).toHaveValue(name);
  await expect(address).toHaveValue(slug);

  // The browser's back and forward return to the questionnaire, which resumes
  // with the saved name.
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Question 2 of 5")).toBeVisible();
  await page.goBack();
  await page.goForward();
  await expect(page.getByText("Question 2 of 5")).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(nameField).toHaveValue(name);
  await context.close();
});
