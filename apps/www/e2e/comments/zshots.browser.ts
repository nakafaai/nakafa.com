// Takes a picture of every state of a lesson's comments (nakafa comment threads)
// at 390 px and 1440 px in both themes, under <width>-<theme>-<NN>-<state>.png.
// Copy it to apps/www/e2e/comments/zshots.browser.ts of that worktree (never
// commit it) and run it in the shared-runtime project against a production build.
import { expect, type Page, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { DateTime, Effect } from "effect";
import { LESSON_PATH, openChatPage } from "@/e2e/support/chat";
import { withBrowserContext } from "@/e2e/support/context";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const SHOTS = process.env.SHOTS_DIR ?? "";
const PLACEHOLDER = app.Comments["add-comment-placeholder"];

/** A picture of the viewport with the thread at its top, once the page has stopped moving. */
async function shoot(page: Page, name: string, anchor: string) {
  await page.evaluate(() => document.fonts.ready);
  await rowOf(page, anchor).evaluate((row) =>
    row.scrollIntoView({ block: "start" })
  );
  await page.evaluate(() => window.scrollBy(0, -120));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

function rowOf(page: Page, text: string) {
  return page
    .locator("div[id]")
    .filter({ has: page.getByText(text, { exact: true }) })
    .last();
}

function composer(page: Page, which: "first" | "last") {
  const forms = page
    .locator("form")
    .filter({ has: page.getByRole("textbox", { name: PLACEHOLDER }) });
  return which === "first" ? forms.first() : forms.last();
}

async function post(page: Page, which: "first" | "last", text: string) {
  await composer(page, which).getByRole("textbox", { name: PLACEHOLDER }).fill(text);
  await composer(page, which)
    .getByRole("button", { name: app.Posts.post, exact: true })
    .click();
  await expect(rowOf(page, text)).toBeVisible({ timeout: readinessTimeoutMilliseconds });
}

async function reply(page: Page, to: string, text: string) {
  await expect(rowOf(page, to)).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await rowOf(page, to)
    .getByRole("button", { name: app.Common.reply, exact: true })
    .click();
  await post(page, "last", text);
}

const open = (page: Page, origin: string, signIn: boolean) =>
  Effect.gen(function* () {
    if (signIn) {
      yield* openChatPage(page, origin);
    }
    yield* Effect.promise(async () => {
      await page.goto(LESSON_PATH);
      await page.locator("#comments").scrollIntoViewIfNeeded();
    });
  });

for (const width of [390, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`comment states at ${width} in ${theme}`, async ({ baseURL, browser }) => {
      test.setTimeout(300_000);
      const origin = baseURL ?? "";
      const options = {
        baseURL: origin,
        colorScheme: theme,
        serviceWorkers: "block" as const,
        viewport: { height: 900, width },
      };
      const at = (index: number, state: string) =>
        `${width}-${theme}-${String(index).padStart(2, "0")}-${state}`;
      const stamp = DateTime.toEpochMillis(DateTime.nowUnsafe());
      const top = `How do I find the range of a projectile? (${stamp})`;
      const answer = `Use R = v² sin 2θ / g, and check the units first. (${stamp})`;
      const nested = `Thanks, that worked for the second question too. (${stamp})`;
      await Effect.runPromise(
        withBrowserContext(browser, options, (one) =>
          withBrowserContext(browser, options, (two) =>
            withBrowserContext(browser, options, (three) =>
              withBrowserContext(browser, options, (visitor) =>
                Effect.gen(function* () {
                  const author = yield* Effect.promise(() => one.newPage());
                  const replier = yield* Effect.promise(() => two.newPage());
                  const nester = yield* Effect.promise(() => three.newPage());
                  const guest = yield* Effect.promise(() => visitor.newPage());
                  yield* open(author, origin, true);
                  yield* Effect.promise(() => post(author, "first", top));
                  yield* open(replier, origin, true);
                  yield* Effect.promise(() => reply(replier, top, answer));
                  yield* open(nester, origin, true);
                  yield* Effect.promise(async () => {
                    await expect(rowOf(nester, answer)).toBeVisible({
                      timeout: readinessTimeoutMilliseconds,
                    });
                    await rowOf(nester, answer)
                      .getByRole("button", { name: app.Common.reply, exact: true })
                      .click();
                    await composer(nester, "last")
                      .getByRole("textbox", { name: PLACEHOLDER })
                      .fill(nested);
                    await shoot(nester, at(1, "reply-composer"), top);
                    await composer(nester, "last")
                      .getByRole("button", { name: app.Posts.post, exact: true })
                      .click();
                    await expect(rowOf(nester, nested)).toBeVisible({
                      timeout: readinessTimeoutMilliseconds,
                    });
                  });
                  yield* Effect.promise(async () => {
                    await expect(rowOf(author, nested)).toBeVisible({
                      timeout: readinessTimeoutMilliseconds,
                    });
                    await rowOf(author, answer)
                      .getByRole("button", { name: app.Common.like, exact: true })
                      .click();
                    await shoot(author, at(2, "thread-liked"), top);
                    await rowOf(author, top)
                      .getByRole("button", { name: app.Common.more, exact: true })
                      .click();
                    await author
                      .getByRole("menuitem", { name: app.Common.delete, exact: true })
                      .click();
                    await expect(author.getByRole("dialog")).toBeVisible();
                    await author.evaluate(() => document.fonts.ready);
                    await author.waitForTimeout(500);
                    await author.screenshot({ path: `${SHOTS}/${at(3, "delete-thread")}.png` });
                    await author.keyboard.press("Escape");
                    await rowOf(nester, nested)
                      .getByRole("button", { name: app.Common.more, exact: true })
                      .click();
                    await nester
                      .getByRole("menuitem", { name: app.Common.delete, exact: true })
                      .click();
                    await expect(nester.getByRole("dialog")).toBeVisible();
                    await nester.waitForTimeout(500);
                    await nester.screenshot({ path: `${SHOTS}/${at(4, "delete-reply")}.png` });
                    await nester.keyboard.press("Escape");
                  });
                  yield* open(guest, origin, false);
                  yield* Effect.promise(async () => {
                    await expect(rowOf(guest, top)).toBeVisible({
                      timeout: readinessTimeoutMilliseconds,
                    });
                    await shoot(guest, at(5, "signed-out"), top);
                  });
                })
              )
            )
          )
        )
      );
    });
  }
}
