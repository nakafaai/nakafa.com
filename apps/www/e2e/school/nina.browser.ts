import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  seedForum,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

test("Nina joins a class's mention list once the school turns her on, and a mention of her sends", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);

  const owner = await browser.newContext();
  await Effect.runPromise(signInOwner(owner, school.slug, address("/")));
  const settings = await owner.newPage();
  await settings.goto(address("/settings/policies"));
  const nina = settings.getByRole("switch", { name: "Nina for students" });
  await waitUntilTakenOver(nina);
  await nina.click();
  await expect(nina).toBeChecked();
  await owner.close();

  const context = await browser.newContext();
  await Effect.runPromise(
    signInClassTeacher(context, school.slug, address("/"))
  );
  const forum = await Effect.runPromise(seedForum(school.slug, 1, 1));
  const page = await context.newPage();
  await page.goto(
    address(`/classes/fisika-x-1/forum?channel=${forum.channelId}`)
  );
  const field = page.getByRole("textbox", { name: "Write a message" });
  await waitUntilTakenOver(field);
  await expect(page.getByText("Pesan 1", { exact: true })).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });

  await field.click();
  await field.pressSequentially("Halo @Ni");
  const list = page.getByRole("listbox", { name: "People to mention" });
  await expect(
    list.getByRole("option", { name: "Nina, the AI assistant" })
  ).toBeVisible();
  await field.press("Enter");
  await expect(field).toHaveValue("Halo @Nina ");
  await field.pressSequentially("apa itu percepatan?");
  await field.press("Enter");
  await expect(page.getByText("apa itu percepatan?")).toBeVisible();
  await context.close();
});
