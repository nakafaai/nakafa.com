import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { runOnPage } from "@/e2e/support/chat";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withBrowserContext } from "@/e2e/support/context";
import { signInLearner } from "@/e2e/support/learner";
import {
  readPaints,
  recordedMilliseconds,
  recordPaints,
  summarizePaints,
} from "@/e2e/support/paint";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { ownedChat } from "@/e2e/support/share";
import { desktopViewport, viewportSize } from "@/e2e/support/viewport";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** How long each recording runs after the press. The open animation takes about 200 ms. */
const RECORD_MILLISECONDS = 1500;
/** The popup of a menu, which a sub-menu or the account menu opens as. */
const MENU = '[role="menu"]';
/** The popup of the Nina sheet while it is open. */
const SHEET = '[data-slot="sheet-popup"][data-open]';
/** The popup of the command palette. */
const PALETTE = '[data-slot="command-dialog-popup"]';
/** The popup of a desktop dialog, which the chat share dialog is. */
const DIALOG = '[data-slot="dialog-content"]';
/** The account footer of a signed-in learner that is on screen. */
const ACCOUNT_FOOTER = '[data-account="member"]:visible';
/** The title of the chat that the share dialog shares. */
const CHAT_TITLE = "The derivative of sine";
/** The first prompt of that chat. */
const CHAT_PROMPT = "Why is the derivative of sine the cosine?";

test.use({ viewport: viewportSize(desktopViewport) });

/** Waits until a recording has run its whole length, so its samples are complete. */
async function untilRecorded(page: Page) {
  await expect
    .poll(() => recordedMilliseconds(page), {
      timeout: RECORD_MILLISECONDS * 4,
    })
    .toBeGreaterThanOrEqual(RECORD_MILLISECONDS);
}

/**
 * Expects the first frame a reader saw the popup in to be its final frame: the same
 * height and the same controls, and no later frame that moved its height by more
 * than half a pixel.
 */
async function expectFinalFirstFrame(page: Page) {
  const summary = summarizePaints(await readPaints(page));
  expect(summary).toBeDefined();
  expect(summary?.firstHeight).toBeGreaterThan(0);
  expect(summary?.firstHeight).toBe(summary?.finalHeight);
  expect(summary?.firstControls).toBeGreaterThan(0);
  expect(summary?.firstControls).toBe(summary?.finalControls);
  expect(summary?.drift ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(0.5);
}

/** The button that opens the account menu of the signed-in learner. */
const accountTrigger = (page: Page) =>
  page.locator(ACCOUNT_FOOTER).locator('button[aria-haspopup="menu"]');

/**
 * Signs a learner in and opens the search page, where the account footer is on
 * screen. The menu body mounts once the menu warms, in the idle time after
 * hydration, so the test waits until the Learn more item is in the document,
 * hidden, before it presses.
 */
const openSearchAsLearner = Effect.fn("NakafaE2E.openSearchAsLearner")(
  function* (page: Page, origin: string) {
    yield* seedAnalyticsConsent(page, "denied");
    yield* signInLearner(page.context(), origin);
    yield* Effect.promise(() => page.goto("/en/search"));
    yield* Effect.promise(() => expect(accountTrigger(page)).toBeVisible());
    yield* Effect.promise(() =>
      expect(page.locator(MENU).filter({ hasText: "Learn more" })).toHaveCount(
        1
      )
    );
  }
);

test("the account menu shows every group in its first frame", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      yield* openSearchAsLearner(page, origin);
      yield* Effect.promise(async () => {
        await recordPaints(page, {
          contains: "Logout",
          duration: RECORD_MILLISECONDS,
          selector: MENU,
        });
        await accountTrigger(page).click();
        await expect(
          page.getByRole("menu").filter({ hasText: "Logout" })
        ).toBeVisible();
        await untilRecorded(page);
        await expectFinalFirstFrame(page);
        for (const item of [
          "Profile",
          "Notifications",
          "Settings",
          "Language",
          "Theme",
          "Learn more",
          "Logout",
        ]) {
          await expect(
            page.getByRole("menuitem", { exact: true, name: item })
          ).toBeVisible();
        }
      });
    })
  );
});

test("each submenu of the account menu shows its items in its first frame", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      yield* openSearchAsLearner(page, origin);
      yield* Effect.promise(async () => {
        await accountTrigger(page).click();
        await expect(
          page.getByRole("menu").filter({ hasText: "Logout" })
        ).toBeVisible();

        const submenus = [
          { contains: "Deutsch (Deutschland)", name: "Language" },
          { contains: "Dark", name: "Theme" },
          { contains: "Community", name: "Learn more" },
        ];
        for (const submenu of submenus) {
          await recordPaints(page, {
            contains: submenu.contains,
            duration: RECORD_MILLISECONDS,
            selector: MENU,
          });
          const item = page.getByRole("menuitem", {
            exact: true,
            name: submenu.name,
          });
          // A reader's pointer travels to the next item. Base UI closes the
          // open submenu once the pointer leaves the path to it, and the menu
          // takes pointer events again only then, so a single jump never lands.
          const box = await item.boundingBox();
          expect(box).not.toBeNull();
          await page.mouse.move(
            (box?.x ?? 0) + (box?.width ?? 0) / 2,
            (box?.y ?? 0) + (box?.height ?? 0) / 2,
            { steps: 10 }
          );
          await item.hover();
          await expect(
            page.getByRole("menu").filter({ hasText: submenu.contains })
          ).toBeVisible();
          await untilRecorded(page);
          await expectFinalFirstFrame(page);
        }
      });
    })
  );
});

test("the Nina sheet shows its composer in its first frame", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      yield* seedAnalyticsConsent(page, "denied");
      yield* signInLearner(page.context(), origin);
      yield* Effect.promise(async () => {
        await page.goto("/en/quran/2");
        const askNina = page.getByRole("button", {
          exact: true,
          name: "Ask Nina",
        });
        await expect(askNina).toBeVisible();
        await waitUntilTakenOver(askNina);
        await recordPaints(page, {
          contains: "",
          duration: RECORD_MILLISECONDS,
          selector: SHEET,
        });
        await askNina.click();
        await expect(
          page.getByRole("textbox", { name: "Ask Nina anything..." })
        ).toBeVisible();
        await untilRecorded(page);
        await expectFinalFirstFrame(page);
      });
    })
  );
});

test("the command palette shows its groups in its first frame", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      yield* seedAnalyticsConsent(page, "denied");
      yield* Effect.promise(() => page.goto(`${origin}/en/search`));
      yield* Effect.promise(async () => {
        const search = page
          .locator('[data-sidebar="sidebar"]:visible')
          .getByRole("button", { name: "Search content..." });
        await expect(search).toBeVisible();
        await recordPaints(page, {
          contains: "Search",
          duration: RECORD_MILLISECONDS,
          selector: PALETTE,
        });
        await search.click();
        await expect(page.locator(PALETTE)).toBeVisible();
        await untilRecorded(page);
        await expectFinalFirstFrame(page);
      });
    })
  );
});

test("the chat share dialog shows its options in its first frame", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      yield* ownedChat(page, origin, {
        prompt: CHAT_PROMPT,
        title: CHAT_TITLE,
      });
      yield* Effect.promise(async () => {
        const more = page
          .locator("main main header")
          .getByRole("button", { name: "More actions" });
        await more.click();
        await expect(
          page.getByRole("menuitem", { name: "Share chat" })
        ).toBeVisible();
        await recordPaints(page, {
          contains: "Share chat",
          duration: RECORD_MILLISECONDS,
          selector: DIALOG,
        });
        await page.getByRole("menuitem", { name: "Share chat" }).click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await untilRecorded(page);
        await expectFinalFirstFrame(page);
      });
    })
  );
});

test("the school account menu shows every group in its first frame", async ({
  baseURL,
  browser,
}) => {
  const origin = baseURL ?? "";
  const school = await Effect.runPromise(createSchool());
  const schoolHome = hostAddress(origin, `${school.slug}.localhost`, "/");
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: origin, viewport: viewportSize(desktopViewport) },
      (context) =>
        Effect.gen(function* () {
          yield* signInOwner(context, school.slug, schoolHome);
          const page = yield* Effect.promise(() => context.newPage());
          yield* Effect.promise(() => page.goto(schoolHome));
          yield* Effect.promise(async () => {
            const account = page.getByRole("button", {
              name: "Acceptance Owner",
            });
            await expect(account).toBeVisible();
            await waitUntilTakenOver(account);
            await recordPaints(page, {
              contains: "Back to Nakafa",
              duration: RECORD_MILLISECONDS,
              selector: MENU,
            });
            await account.click();
            await expect(
              page.getByRole("menu").filter({ hasText: "Back to Nakafa" })
            ).toBeVisible();
            await untilRecorded(page);
            await expectFinalFirstFrame(page);
            for (const item of [
              "Account settings",
              "Language",
              "Theme",
              "Learn more",
              "Back to Nakafa",
            ]) {
              await expect(
                page.getByRole("menuitem", { exact: true, name: item })
              ).toBeVisible();
            }
          });
        })
    )
  );
});
