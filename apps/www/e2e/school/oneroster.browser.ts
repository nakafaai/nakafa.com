import { expect, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { strToU8, zipSync } from "fflate";
import { chooseFile, openPeriodWithCohort } from "@/e2e/support/roster";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

const USERS = Arr.join(
  [
    "sourcedId,status,givenName,familyName,email",
    "u1,active,Raka,Pratama,raka@school.example",
    "u2,active,Nadia,Putri,nadia@school.example",
    "t1,active,Ayu,Lestari,ayu@school.example",
  ],
  "\n"
);

const CLASSES = Arr.join(["sourcedId,title,classType", "c1,7A,homeroom"], "\n");

const ENROLLMENTS = Arr.join(
  [
    "sourcedId,classSourcedId,userSourcedId,role",
    "e1,c1,u1,student",
    "e2,c1,u2,student",
    "e3,c1,t1,teacher",
  ],
  "\n"
);

/** A OneRoster CSV bundle as a student information system exports it. */
const bundle = () => ({
  buffer: Buffer.from(
    zipSync({
      "classes.csv": strToU8(CLASSES),
      "enrollments.csv": strToU8(ENROLLMENTS),
      "manifest.csv": strToU8("propertyName,value"),
      "users.csv": strToU8(USERS),
    })
  ),
  mimeType: "application/zip",
  name: "oneroster.zip",
});

test("an admin previews a OneRoster zip and imports its students into their class group", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  await openPeriodWithCohort(page, address, "7A");

  await page.goto(address("/settings/roster"));
  await waitUntilTakenOver(
    page.locator("header").getByRole("button", { name: "Import" })
  );
  await chooseFile(page, bundle());

  const raka = page.getByRole("row").filter({ hasText: "Raka Pratama" });
  await expect(raka).toContainText("u1");
  await expect(raka).toContainText("7A");
  await expect(page.getByText("Nadia Putri")).toBeVisible();
  // A teacher stays out of a student list, and an email never shows.
  await expect(page.getByText("Ayu Lestari")).toHaveCount(0);
  await expect(page.getByText("raka@school.example")).toHaveCount(0);

  await page
    .locator("header")
    .getByRole("button", { name: "Import students" })
    .click();
  await expect(page.getByText("The students are in the roster.")).toBeVisible();

  // An import names a student and holds no address, so the school invites them from their row.
  await page.goto(address("/settings/members"));
  const member = page.getByRole("row").filter({ hasText: "Raka Pratama" });
  const menu = member.getByRole("button", { name: "More actions" });
  await waitUntilTakenOver(menu);
  await menu.click();
  await page.getByRole("menuitem", { name: "Invite" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email").fill("raka@school.example");
  await dialog.getByRole("button", { name: "Invite" }).click();
  await expect(dialog).toBeHidden();

  await page.goto(address("/settings/invites"));
  await expect(page.getByText("raka@school.example")).toBeVisible();
  await context.close();
});
