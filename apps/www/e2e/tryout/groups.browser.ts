import { expect, test } from "@playwright/test";
import { groupHref, trackHref } from "@/e2e/support/tryout";

/** TKA's one grade today, in English. */
const TKA_GRADE = "/en/try-out/indonesia/tka/senior-high-school";

/**
 * Each exam divides its tracks on one axis, and the header of a group and of a
 * track picks the exam and the group side by side: SNBT by its year, TKA by its
 * grade.
 */
for (const [href, exam, axis, group] of [
  [groupHref, "SNBT", "Year", "2027"],
  [trackHref, "SNBT", "Year", "2027"],
  [TKA_GRADE, "TKA", "Grade", "Senior High School"],
] as const) {
  test(`${href} picks its exam and its ${axis.toLowerCase()} in the header`, async ({
    page,
  }) => {
    await page.goto(href);
    const header = page.locator("header").first();

    await expect(header.getByRole("combobox", { name: "Exam" })).toContainText(
      exam
    );
    await expect(header.getByRole("combobox", { name: axis })).toContainText(
      group
    );
  });
}

test("a group's menu lists its exam's groups, each with its icon", async ({
  page,
}) => {
  await page.goto(TKA_GRADE);
  await page.getByRole("combobox", { name: "Grade" }).click();
  const option = page.getByRole("option", { name: "Senior High School" });

  await expect(page.getByRole("option")).toHaveCount(1);
  await expect(option.locator("svg").first()).toBeVisible();
});

/**
 * The catalog before its groups keeps its addresses: an exam's own address
 * moves to its first group for now, and a path without its group or its track
 * moves to the page it named for good.
 */
for (const [from, to, status] of [
  ["/en/try-out/indonesia/tka", TKA_GRADE, 307],
  [
    "/en/try-out/indonesia/tka/compulsory-mathematics",
    `${TKA_GRADE}/compulsory-mathematics`,
    308,
  ],
  ["/en/try-out/indonesia/snbt/2027/set-1", `${trackHref}/set-1`, 308],
] as const) {
  test(`${from} answers ${status} to ${to}`, async ({ request }) => {
    const response = await request.get(from, { maxRedirects: 0 });

    expect(response.status()).toBe(status);
    expect(
      new URL(response.headers().location ?? "", "https://x").pathname
    ).toBe(to);
  });
}
