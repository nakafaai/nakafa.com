import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { signInLearner, signInOperator } from "@/e2e/support/learner";

test("an operator opens a school from the console, and it joins the list", async ({
  baseURL,
  browser,
}, testInfo) => {
  const context = await browser.newContext();
  await Effect.runPromise(signInOperator(context, String(baseURL)));
  const page = await context.newPage();
  const tag = `${testInfo.testId.slice(0, 6)}${testInfo.repeatEachIndex}${testInfo.retry}`;
  const name = `Kontrak ${tag}`;

  await page.goto("/en/operators");
  await page.getByRole("button", { name: "Open school" }).click();
  const dialog = page.getByRole("dialog");
  const open = dialog.getByRole("button", { name: "Open school" });
  await expect(open).toBeDisabled();
  await dialog.getByLabel("School", { exact: true }).fill(name);
  await expect(dialog.getByLabel("Address")).toHaveValue(`kontrak-${tag}`);
  await dialog.getByLabel("Owner's name").fill("Ayu Lestari");
  await dialog.getByLabel("Owner's email").fill(`ayu-${tag}@example.com`);
  await dialog.getByLabel("DPA version").fill("2026-10");
  await dialog.getByLabel("Content licence version").fill("2026-10");
  await open.click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("cell", { name })).toBeVisible();
  await context.close();
});

test("an account that is no operator reads who the console is for", async ({
  baseURL,
  browser,
}) => {
  const context = await browser.newContext();
  await Effect.runPromise(signInLearner(context, String(baseURL)));
  const page = await context.newPage();

  await page.goto("/en/operators");

  await expect(page.getByText("For Nakafa staff")).toBeVisible();
  await expect(page.getByRole("cell")).toHaveCount(0);
  await context.close();
});
