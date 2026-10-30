import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

test("a student who scans an old code sees it refused in the field, and the room's code takes them into the paper", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `scan-${school.slug}@acceptance.example.test`;
  const studentContext = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context: studentContext,
      slug: school.slug,
    })
  );
  // The seed records its exam as made by the school's Owner, who must have signed in first.
  const proctorContext = await browser.newContext();
  await Effect.runPromise(
    signInOwner(proctorContext, school.slug, address("/"))
  );
  const sitting = await Effect.runPromise(seedSitting(school.slug, learner));
  await proctorContext.close();

  // A code the proctor has changed since enters by itself, is refused, and stays in the field.
  const student = await studentContext.newPage();
  await student.goto(address(`/sittings/${sitting.sittingId}#zzzz22`));
  await expect(
    student.getByText("The token does not match, so check it and try again.")
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await expect(
    student.getByPlaceholder("Enter the token from your proctor")
  ).toHaveValue("ZZZZ22");

  // A scan of the room's own code opens a new tab, which enters at once with no press.
  const scanned = await studentContext.newPage();
  await scanned.goto(
    address(`/sittings/${sitting.sittingId}#${sitting.token}`)
  );
  await expect(
    scanned.getByRole("heading", { name: "Question 1" })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await studentContext.close();
});

test("a signed-out student who scans the room's code signs in over the room and lands in the paper", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `scan-out-${school.slug}@acceptance.example.test`;
  // The invite signs the learner in elsewhere; the scanning tab starts signed out and takes this session later.
  const invited = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context: invited,
      slug: school.slug,
    })
  );
  const session = await invited.cookies();
  await invited.close();
  const proctorContext = await browser.newContext();
  await Effect.runPromise(
    signInOwner(proctorContext, school.slug, address("/"))
  );
  const sitting = await Effect.runPromise(seedSitting(school.slug, learner));
  await proctorContext.close();

  const scanner = await browser.newContext();
  const student = await scanner.newPage();
  const room = `/sittings/${sitting.sittingId}`;
  await student.goto(address(`${room}#${sitting.token}`));
  await expect(
    student.getByRole("heading", { name: `Sign in to ${school.name}` })
  ).toBeVisible();
  // The username form opens over the room, so its sign-in returns there.
  const username = student.getByRole("button", {
    name: "Sign in with a username",
  });
  await waitUntilTakenOver(username);
  await expect(username).toHaveAttribute("href", `${room}?masuk=username`);

  // A sign-in returns this tab to the room without its code, which waited in the tab.
  await scanner.addCookies(session);
  await student.goto(address(room));
  await expect(
    student.getByRole("heading", { name: "Question 1" })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await scanner.close();
});
