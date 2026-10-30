import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The two widths every school screen is checked at: a phone and a desktop. */
const WIDTHS = [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
] as const;

/** The shape of a card code: Crockford base32 in two groups of five. */
const CARD_CODE = /^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/;

test("an owner adds a teacher by email and sees the invite in the members list, and adds a student with the first card", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  const run = school.slug.slice(0, 8);

  for (const viewport of WIDTHS) {
    // Each width adds its own people, so the second pass never repeats an address.
    const teacher = `Guru ${run} ${viewport.width}`;
    const login = `siswa-${run}-${viewport.width}`;
    await page.setViewportSize(viewport);

    await page.goto(address("/settings/invites"));
    const inviteAction = page
      .locator("header")
      .getByRole("button", { exact: true, name: "Invite" });
    await waitUntilTakenOver(inviteAction);
    await inviteAction.click();
    const invite = page.getByRole("dialog");
    await invite.getByLabel("Name", { exact: true }).fill(teacher);
    await invite
      .getByLabel("Email", { exact: true })
      .fill(`guru.${run}.${viewport.width}@harapan.example.test`);
    await invite.getByRole("button", { exact: true, name: "Invite" }).click();
    await expect(
      page.getByRole("cell", { exact: true, name: teacher })
    ).toBeVisible();

    await page.goto(address("/settings/members"));
    const teacherRow = page.getByRole("row").filter({ hasText: teacher });
    await expect(
      teacherRow.getByText("Invited", { exact: true })
    ).toBeVisible();
    await expect(
      teacherRow.getByText("Teacher", { exact: true })
    ).toBeVisible();

    await page.goto(address("/settings/students"));
    const enrolAction = page
      .locator("header")
      .getByRole("button", { exact: true, name: "Add student" });
    await waitUntilTakenOver(enrolAction);
    await enrolAction.click();
    const enrol = page.getByRole("dialog");
    await enrol.getByLabel("Name", { exact: true }).fill(`Murid ${run}`);
    await enrol.getByLabel("Login name", { exact: true }).fill(login);
    await enrol
      .getByRole("button", { exact: true, name: "Add student" })
      .click();

    // The first card shows once, with its username, its code, its QR code, and print.
    const card = page.getByRole("dialog");
    await expect(card.getByText(login, { exact: true })).toBeVisible();
    await expect(card.getByText(CARD_CODE)).toBeVisible();
    await expect(
      card.getByRole("img", { name: "QR code with the card code" })
    ).toBeVisible();
    await expect(
      card.getByRole("button", { exact: true, name: "Print card" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
  }

  await context.close();
});

test("an owner renames a teacher from the members and a student from the logins, and both names stay after a reload", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  const run = school.slug.slice(0, 8);

  await page.goto(address("/settings/invites"));
  const inviteAction = page
    .locator("header")
    .getByRole("button", { exact: true, name: "Invite" });
  await waitUntilTakenOver(inviteAction);
  await inviteAction.click();
  const invite = page.getByRole("dialog");
  await invite.getByLabel("Name", { exact: true }).fill("Guru Salah Ketik");
  await invite
    .getByLabel("Email", { exact: true })
    .fill(`guru.${run}@harapan.example.test`);
  await invite.getByRole("button", { exact: true, name: "Invite" }).click();
  await expect(
    page.getByRole("cell", { exact: true, name: "Guru Salah Ketik" })
  ).toBeVisible();

  // Rename starts from the name the member has, and the row shows the new one at once.
  await page.goto(address("/settings/members"));
  const teacherRow = page
    .getByRole("row")
    .filter({ hasText: "Guru Salah Ketik" });
  const teacherMenu = teacherRow.getByRole("button", { name: "More actions" });
  await waitUntilTakenOver(teacherMenu);
  await teacherMenu.click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  const renameTeacher = page.getByRole("dialog");
  await expect(renameTeacher.getByLabel("Name")).toHaveValue(
    "Guru Salah Ketik"
  );
  await renameTeacher.getByLabel("Name").fill("Guru Benar");
  await renameTeacher.getByRole("button", { name: "Save" }).click();
  await expect(renameTeacher).toBeHidden();
  await expect(
    page.getByRole("cell", { exact: true, name: "Guru Benar" })
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("cell", { exact: true, name: "Guru Benar" })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });

  await page.goto(address("/settings/students"));
  const enrolAction = page
    .locator("header")
    .getByRole("button", { exact: true, name: "Add student" });
  await waitUntilTakenOver(enrolAction);
  await enrolAction.click();
  const enrol = page.getByRole("dialog");
  await enrol.getByLabel("Name", { exact: true }).fill("Murid Salah Ketik");
  await enrol.getByLabel("Login name", { exact: true }).fill(`siswa-${run}`);
  await enrol.getByRole("button", { exact: true, name: "Add student" }).click();
  await expect(page.getByRole("dialog").getByText(CARD_CODE)).toBeVisible();
  await page.keyboard.press("Escape");

  const studentRow = page
    .getByRole("row")
    .filter({ hasText: "Murid Salah Ketik" });
  const studentMenu = studentRow.getByRole("button", { name: "More actions" });
  await waitUntilTakenOver(studentMenu);
  await studentMenu.click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  const renameStudent = page.getByRole("dialog");
  await renameStudent.getByLabel("Name").fill("Murid Benar");
  await renameStudent.getByRole("button", { name: "Save" }).click();
  await expect(renameStudent).toBeHidden();
  await expect(
    page.getByRole("row").filter({ hasText: `siswa-${run}` })
  ).toContainText("Murid Benar");
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: `siswa-${run}` })
  ).toContainText("Murid Benar", { timeout: readinessTimeoutMilliseconds });
  await context.close();
});
