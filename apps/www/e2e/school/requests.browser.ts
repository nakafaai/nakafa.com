import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { seedGuardianCode } from "@/e2e/support/guardian";
import {
  createSchool,
  hostAddress,
  seedCard,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The student's NISN that the seed writes on the roster. */
const NISN = "0012345678";

test("a verified parent asks the school office, Staff approves, and the parent reads the answer", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  await Effect.runPromise(seedCard(school.slug));
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const email = `ibu.${school.slug}@example.com`;

  const admin = await browser.newContext();
  await Effect.runPromise(signInOwner(admin, school.slug, address("/")));
  const settings = await admin.newPage();
  await settings.goto(address("/settings/guardians"));
  const add = settings
    .locator("header")
    .getByRole("button", { name: "Link a parent" });
  await waitUntilTakenOver(add);
  await add.click();
  const dialog = settings.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Student" }).click();
  await settings.getByRole("option", { name: "Siswa Uji" }).click();
  await dialog.getByLabel("Parent's name").fill("Ibu Uji");
  await dialog.getByLabel("Parent email").fill(email);
  await dialog.getByRole("button", { name: "Link a parent" }).click();
  await expect(
    settings.getByRole("row").filter({ hasText: "Siswa Uji" })
  ).toContainText(email);

  const parent = await browser.newContext();
  const home = await parent.newPage();
  await home.goto(address("/parents"));
  const send = home.getByRole("button", { name: "Send code" });
  await waitUntilTakenOver(send);
  await home.getByLabel("Parent email").fill(email);
  await send.click();
  await expect(home.getByLabel("Sign-in code")).toBeVisible();
  const seeded = await Effect.runPromise(
    seedGuardianCode(school.slug, email, NISN)
  );
  await home.getByLabel("Sign-in code").fill(seeded.code);
  await home.getByRole("button", { name: "Sign in" }).click();
  const open = home.getByRole("button", { name: "Siswa Uji" });
  await expect(open).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await waitUntilTakenOver(open);
  await open.click();
  const child = home.locator("[data-child]");
  await waitUntilTakenOver(child.getByLabel("Child's NISN"));
  await child.getByLabel("Child's NISN").fill(NISN);
  await child.getByRole("button", { name: "Check" }).click();
  await expect(child).toHaveAttribute("data-child", "verified");

  const ask = child.getByRole("button", { name: "Ask the school" });
  await waitUntilTakenOver(ask);
  await ask.click();
  const request = home.getByRole("dialog");
  await request.getByLabel("Your note").fill("Salinan rapor semester lalu.");
  await request.getByRole("button", { name: "Send" }).click();
  const asked = child
    .getByRole("row")
    .filter({ hasText: "Salinan rapor semester lalu." });
  await expect(asked).toContainText("Waiting");

  await settings.reload();
  const waiting = settings
    .getByRole("row")
    .filter({ hasText: "Salinan rapor semester lalu." });
  await waiting.getByRole("button", { name: "More actions" }).click();
  await settings.getByRole("menuitem", { name: "Approve" }).click();
  await expect(waiting).toHaveCount(0);

  await expect(asked).toContainText("Approved");
  await admin.close();
  await parent.close();
});
