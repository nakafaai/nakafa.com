import { expect, test } from "@playwright/test";
import { Array as Arr, Effect, Schema } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/u;

/** Where the page keeps whether a drawer's popup was ever drawn since it started watching. */
const DRAWER_SEEN = "__drawerSeen";

/** Where the page keeps the length of its main landmark's text, one entry per frame, since it started watching. */
const MAIN_TEXT = "__mainText";

/**
 * The fewest characters the main landmark holds on any frame of the editor that Create opens. The editor's
 * workspace holds far more, and its bare frame, its header and toolbar alone, held 23 before the editor drew
 * the exam that the create answered with.
 */
const MAIN_TEXT_FLOOR = 60;

test("a dialog that opens as it mounts is a dialog from its first frame on a wide screen", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(
    signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
  );
  const page = await context.newPage();
  await page.goto(hostAddress(baseURL, host, "/exams"));
  const create = page.getByRole("button", { name: "Create exam" });
  await waitUntilTakenOver(create);
  await create.click();
  const creating = page.getByRole("dialog");
  await creating.getByRole("textbox", { name: "Exam title" }).fill("Bingkai");
  await creating.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  const schedule = page.getByRole("button", { name: "Schedule" });
  await expect(schedule).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await waitUntilTakenOver(schedule);

  // The schedule's dialog mounts open on the press. Every element the page adds from here is checked, so a
  // drawer drawn for a single frame before the dialog is caught.
  await page.evaluate((flag) => {
    Reflect.set(window, flag, false);
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (
            node instanceof Element &&
            (node.matches('[data-slot="drawer-popup"]') ||
              node.querySelector('[data-slot="drawer-popup"]') !== null)
          ) {
            Reflect.set(window, flag, true);
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }, DRAWER_SEEN);
  await schedule.click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Schedule exam" })
  ).toBeVisible();
  expect(
    await page.evaluate((flag) => Reflect.get(window, flag), DRAWER_SEEN)
  ).toBe(false);
  await context.close();
});

test("the editor that Create opens draws the new exam on its first frame, and the page never drops to a bare frame", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(
    signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
  );
  const page = await context.newPage();
  await page.goto(hostAddress(baseURL, host, "/exams"));
  const create = page.getByRole("button", { name: "Create exam" });
  await waitUntilTakenOver(create);
  await create.click();
  const creating = page.getByRole("dialog");
  await creating.getByRole("textbox", { name: "Exam title" }).fill("Sekejap");

  // Every frame of the editor records how much text the main landmark holds, from the first one on.
  await page.evaluate((key) => {
    const lengths: number[] = [];
    Reflect.set(window, key, lengths);
    const sample = () => {
      if (window.location.pathname.endsWith("/edit")) {
        lengths.push(document.querySelector("main")?.textContent?.length ?? 0);
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, MAIN_TEXT);
  await creating.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  await expect(
    page.getByRole("textbox", { name: "Question 1, option A" })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });

  const lengths = Schema.decodeUnknownSync(Schema.Array(Schema.Int))(
    await page.evaluate((key) => Reflect.get(window, key), MAIN_TEXT)
  );
  expect(lengths.length).toBeGreaterThan(0);
  expect(Arr.filter(lengths, (length) => length < MAIN_TEXT_FLOOR)).toEqual([]);
  await context.close();
});
