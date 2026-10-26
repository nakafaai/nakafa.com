import { expect, test } from "@playwright/test";
import { Deferred, Effect } from "effect";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { createSchool, hostAddress, seedCard } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The entry address that holds the school username form alone. */
const USERNAME_ADDRESS = /masuk=username/;

test("a wrong card code is refused with one message that does not say whether the username exists", async ({
  page,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  await page.goto(hostAddress(baseURL, `${school.slug}.localhost`, "/"));

  await page.getByRole("button", { name: "Sign in with a username" }).click();
  await page.waitForURL(USERNAME_ADDRESS);
  await waitUntilTakenOver(page.getByRole("button", { name: "Sign in" }));
  await page.getByLabel("School username").fill("guru.tidak");
  await page.getByLabel("Card code").fill("ABCDE-FGHJK");
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "The username or card code is not right."
  );
});

test("a student whose card an Admin printed signs in with the school username, the code, and a new password", async ({
  page,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const card = await Effect.runPromise(seedCard(school.slug));
  await page.goto(hostAddress(baseURL, `${school.slug}.localhost`, "/"));

  await page.getByRole("button", { name: "Sign in with a username" }).click();
  await page.waitForURL(USERNAME_ADDRESS);
  await waitUntilTakenOver(page.getByRole("button", { name: "Sign in" }));
  await page.getByLabel("School username").fill(card.loginName);
  await page.getByLabel("Card code").fill(card.code);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Siswa Uji").first()).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(
    page.getByRole("button", { name: "Sign in with a username" })
  ).toHaveCount(0, { timeout: readinessTimeoutMilliseconds });
});

test("a signed-in learner who is not a member of an existing school sees the outsider page", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const schoolHome = hostAddress(baseURL, `${school.slug}.localhost`, "/");
  const context = await browser.newContext();
  await Effect.runPromise(signInLearner(context, schoolHome));
  const page = await context.newPage();

  const response = await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.promise(async () => {
        const answer = await page.goto(schoolHome);
        // React takes over the page that the server sent, with no hydration error.
        await waitUntilTakenOver(
          page.getByRole("button", { name: "Switch account" })
        );
        return answer;
      })
    )
  );

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: `Not a member of ${school.name}` })
  ).toBeVisible();
  await expect(
    page.getByText(
      "You are signed in as Acceptance Learner, which has no invite here yet."
    )
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Switch account" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in with a card" })
  ).toBeVisible();
  await context.close();
});

test("a signed-in learner who is not a member gets the card form at once, while the account signs out", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const schoolHome = hostAddress(baseURL, `${school.slug}.localhost`, "/");
  const context = await browser.newContext();
  await Effect.runPromise(signInLearner(context, schoolHome));
  const page = await context.newPage();
  const released = Effect.runSync(Deferred.make<void>());
  await page.route("**/api/auth/sign-out", (route) =>
    Effect.runPromise(
      Deferred.await(released).pipe(
        Effect.andThen(() => Effect.promise(() => route.continue()))
      )
    )
  );
  await page.goto(schoolHome);
  const card = page.getByRole("button", { name: "Sign in with a card" });
  await waitUntilTakenOver(card);

  await card.click();
  await expect(page.getByLabel("School username")).toBeVisible();
  await expect(page).toHaveURL(USERNAME_ADDRESS);

  Effect.runSync(Deferred.succeed(released, undefined));
  await expect(page.getByLabel("School username")).toBeVisible();
  await page.goto(schoolHome);
  await expect(
    page.getByRole("button", { name: "Continue with Google" })
  ).toBeVisible();
  await context.close();
});

test("a sign-out that fails returns the outsider to the not-member page with its toast", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const schoolHome = hostAddress(baseURL, `${school.slug}.localhost`, "/");
  const context = await browser.newContext();
  await Effect.runPromise(signInLearner(context, schoolHome));
  const page = await context.newPage();
  await page.route("**/api/auth/sign-out", (route) =>
    route.fulfill({ status: 500 })
  );
  await page.goto(schoolHome);
  const switchAccount = page.getByRole("button", { name: "Switch account" });
  await waitUntilTakenOver(switchAccount);

  await switchAccount.click();

  await expect(page.getByText("We could not sign you out.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: `Not a member of ${school.name}` })
  ).toBeVisible();
  await context.close();
});
