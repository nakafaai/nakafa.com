import { expect, test } from "@playwright/test";
import { Effect, MutableList } from "effect";
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

test("a sign-in without the username or password answers at once and asks the server nothing", async ({
  page,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const signIns = MutableList.make<string>();
  page.on("request", (request) => {
    if (request.url().includes("/api/auth/sign-in/")) {
      MutableList.append(signIns, request.url());
    }
  });
  await page.goto(
    hostAddress(baseURL, `${school.slug}.localhost`, "/?masuk=username")
  );
  await waitUntilTakenOver(page.getByRole("button", { name: "Sign in" }));

  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "Type your school username and password."
  );

  await page.getByLabel("School username").fill("siswa.uji");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "Type your school username and password."
  );
  expect(MutableList.toArray(signIns)).toEqual([]);
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
    page.getByRole("heading", { name: "Not a member" })
  ).toBeVisible();
  await expect(
    page.getByText(`Acceptance Learner is not a member of ${school.name}.`)
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Switch account" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in with a card" })
  ).toBeVisible();
  await context.close();
});
