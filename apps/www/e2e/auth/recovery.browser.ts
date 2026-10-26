import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import standalone from "@repo/internationalization/dictionaries/standalone/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { trackChanges } from "@/e2e/support/changes";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const SESSION_READ = "**/api/auth/get-session*";
const CONVEX_AUTH_READ = "**/api/auth/convex/token*";

/** The words of every state that says a read failed, was refused, or found nothing. */
const ERROR_STATES = [
  en.Common["load-error"],
  en.Common["load-error-retry"],
  standalone.Error.title,
  standalone.NotFound.title,
];

/** The sentence an invitation row shows in English. */
const INVITATION = "You have been invited to join this school.";

/** The first session read gets no answer, as on a network that drops it. */
const DROPPED_SESSION = {
  answer: "none",
  route: SESSION_READ,
  times: 1,
} as const;

/** Every attempt of the first session read fails: the browser reads it three times on the shared schedule. */
const UNAVAILABLE_SESSION = {
  answer: "unavailable",
  route: SESSION_READ,
  times: 3,
} as const;

/** Convex's first token request and the one it sends when that fails both get no answer. */
const DROPPED_AUTH_READS = {
  answer: "none",
  route: CONVEX_AUTH_READ,
  times: 2,
} as const;

/** How the first requests to one Better Auth route fail. */
type Failure =
  | typeof DROPPED_SESSION
  | typeof DROPPED_AUTH_READS
  | typeof UNAVAILABLE_SESSION;

/** Records, from the first paint on, every error state the page shows. */
async function watchErrorStates(page: Page) {
  await page.addInitScript((states) => {
    const seen: string[] = [];
    Reflect.set(window, "nakafaErrorStates", seen);
    new MutationObserver(() => {
      const text = document.body?.innerText ?? "";
      for (const state of states) {
        if (text.includes(state) && !seen.includes(state)) {
          seen.push(state);
        }
      }
    }).observe(document, {
      characterData: true,
      childList: true,
      subtree: true,
    });
  }, ERROR_STATES);
}

/** Every error state the page has shown since it opened. */
function errorStatesSeen(page: Page) {
  return page.evaluate(() => Reflect.get(window, "nakafaErrorStates"));
}

/** Fails the first requests to a route as `failure` says, and counts them. */
async function failFirst(page: Page, failure: Failure) {
  const failed = { count: 0 };
  await page.route(failure.route, async (route) => {
    if (failed.count >= failure.times) {
      await route.continue();
      return;
    }
    failed.count += 1;
    await (failure.answer === "none"
      ? route.abort("failed")
      : route.fulfill({ body: "", status: 503 }));
  });
  return failed;
}

/**
 * Opens a page of a signed-in viewer while the first requests to a Better Auth
 * route fail, and checks that no error state ever shows: the page asks Convex
 * for `read` only once its connection has signed in, and Convex answers it.
 * When every attempt of the first session read fails, the page waits for the
 * session and settles when the network returns.
 */
async function opensWithoutError(
  context: BrowserContext,
  address: string,
  read: string,
  failure: Failure
) {
  const page = await context.newPage();
  await watchErrorStates(page);
  const changes = await Effect.runPromise(trackChanges(page, []));
  const failed = await failFirst(page, failure);

  await page.goto(address);
  await expect.poll(() => failed.count).toBe(failure.times);
  if (failure.answer === "unavailable") {
    // Every attempt of the read failed: Better Auth asks again when the
    // network returns, and until then the page waits as it renders.
    await page.waitForTimeout(1000);
    expect(changes.askedSignedOut(read)).toBe(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
  }
  await expect
    .poll(() => changes.hasAnswered(read), {
      timeout: readinessTimeoutMilliseconds,
    })
    .toBe(true);

  expect(changes.askedSignedOut(read)).toBe(false);
  expect(await errorStatesSeen(page)).toStrictEqual([]);
  expect(page.url()).toBe(address);
  return page;
}

for (const width of [390, 1440]) {
  test.describe(`A failed session read at ${width}px`, () => {
    test.use({ viewport: { height: 900, width } });

    test("leaves a school member's page waiting for the session, never showing an error", async ({
      baseURL,
      browser,
    }) => {
      const school = await Effect.runPromise(createSchool());
      const home = hostAddress(baseURL, `${school.slug}.localhost`, "/");
      const context = await browser.newContext();
      await Effect.runPromise(signInOwner(context, school.slug, home));

      for (const failure of [
        DROPPED_SESSION,
        UNAVAILABLE_SESSION,
        DROPPED_AUTH_READS,
      ]) {
        const page = await opensWithoutError(
          context,
          home,
          "tenancy/viewer:get",
          failure
        );
        await expect(
          page.getByRole("button", { name: "Create exam" })
        ).toBeVisible();
        await page.close();
      }
      await context.close();
    });

    test("leaves a learner's inbox waiting for the session, never showing an error", async ({
      baseURL,
      browser,
    }) => {
      const origin = await Effect.runPromise(Effect.fromNullishOr(baseURL));
      const school = await Effect.runPromise(createSchool());
      const context = await browser.newContext();
      await Effect.runPromise(
        inviteLearner({
          address: `learner-${school.slug}@acceptance.example.test`,
          baseURL: origin,
          context,
          slug: school.slug,
        })
      );

      const page = await opensWithoutError(
        context,
        new URL("/en/notifications", origin).href,
        "notifications/inbox:list",
        DROPPED_SESSION
      );
      await expect(page.getByRole("link", { name: INVITATION })).toBeVisible();
      await context.close();
    });
  });
}
