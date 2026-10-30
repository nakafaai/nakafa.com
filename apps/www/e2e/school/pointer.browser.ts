import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { signInLearner } from "@/e2e/support/learner";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/u;

/**
 * Runs in the page. Every shown element a press reaches must show the pointer and a disabled one must not; static
 * text, headings and the cells of a row that takes no press must not show it either. It answers each element that
 * breaks the rule, with its tag, role, text and cursor.
 */
function cursorMisses() {
  const pressable =
    'button, a[href], summary, label[for], [role="button"], [role="checkbox"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="radio"], [role="switch"], [role="tab"], tr[data-pressable]';
  const shown = (element: Element) => {
    const box = element.getBoundingClientRect();
    return (
      box.width > 1 &&
      box.height > 1 &&
      getComputedStyle(element).visibility !== "hidden" &&
      element.closest('[inert], [aria-hidden="true"]') === null
    );
  };
  const describe = (element: Element, cursor: string) =>
    `${element.tagName.toLowerCase()}${element.hasAttribute("role") ? `[role=${element.getAttribute("role")}]` : ""} "${(element.textContent ?? "").trim().slice(0, 40)}" shows ${cursor}`;
  const misses: string[] = [];
  for (const element of document.querySelectorAll(pressable)) {
    if (!shown(element)) {
      continue;
    }
    const cursor = getComputedStyle(element).cursor;
    const disabled = element.matches(
      ':disabled, [aria-disabled="true"], [data-disabled]'
    );
    if (disabled ? cursor === "pointer" : cursor !== "pointer") {
      misses.push(describe(element, cursor));
    }
  }
  for (const element of document.querySelectorAll(
    "p, h1, h2, h3, th, tr:not([data-pressable]) > td"
  )) {
    if (!shown(element) || element.closest(pressable) !== null) {
      continue;
    }
    const cursor = getComputedStyle(element).cursor;
    if (cursor === "pointer") {
      misses.push(describe(element, cursor));
    }
  }
  return misses;
}

/** Expects the page at its current address to show the pointer exactly where a press does something. */
async function expectPointerOnlyOnPresses(page: Page) {
  expect(await page.evaluate(cursorMisses), page.url()).toEqual([]);
}

test("every control a press reaches shows the pointer, and static content does not", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const owner = await browser.newContext();
  await Effect.runPromise(
    signInOwner(owner, school.slug, hostAddress(baseURL, host, "/"))
  );
  const page = await owner.newPage();

  // The school's settings: its profile, then its periods with their table.
  await page.goto(hostAddress(baseURL, host, "/settings/profile"));
  await waitUntilTakenOver(page.getByRole("button", { name: "Copy address" }));
  await expectPointerOnlyOnPresses(page);
  await page.goto(hostAddress(baseURL, host, "/settings/periods"));
  await waitUntilTakenOver(
    page.locator("header").getByRole("button", { name: "Add period" })
  );
  await expectPointerOnlyOnPresses(page);

  // An exam's editor, with its toolbar and its first question.
  await page.goto(hostAddress(baseURL, host, "/exams"));
  const create = page.getByRole("button", { name: "Create exam" });
  await waitUntilTakenOver(create);
  await create.click();
  const creating = page.getByRole("dialog");
  await creating.getByRole("textbox", { name: "Exam title" }).fill("Kursor");
  await creating.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  await expect(page.getByRole("button", { name: "Schedule" })).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expectPointerOnlyOnPresses(page);
  await owner.close();

  // A learner's home and a lesson on the main host.
  const learner = await browser.newContext();
  await Effect.runPromise(signInLearner(learner, String(baseURL)));
  const reader = await learner.newPage();
  await reader.goto(new URL("/en", baseURL).href);
  await waitUntilTakenOver(reader.getByRole("main").getByRole("link").first());
  await expectPointerOnlyOnPresses(reader);
  await reader.goto(new URL(pinnedRoutes.material.en, baseURL).href);
  await expect(reader.getByRole("heading", { level: 1 })).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expectPointerOnlyOnPresses(reader);
  await learner.close();
});
