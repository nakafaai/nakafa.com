import { expect, test } from "@playwright/test";
import { Deferred, Effect } from "effect";
import { signInLearner } from "@/e2e/support/learner";
import { createSchool, hostAddress } from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The entry address that holds the school username form alone. */
const USERNAME_ADDRESS = /masuk=username/;

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
