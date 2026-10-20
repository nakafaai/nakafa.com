import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { type Changes, trackChanges } from "../support/changes";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInOwner,
} from "../support/school";
import { readinessTimeoutMilliseconds } from "../support/timeout";

/**
 * Opens a page and waits until the server answered each of its reads, which all need
 * the session.
 */
async function openAnswered(
  page: Page,
  changes: Changes,
  address: string,
  reads: readonly string[]
) {
  await page.goto(address);
  for (const read of reads) {
    await expect
      .poll(() => changes.hasAnswered(read), {
        timeout: readinessTimeoutMilliseconds,
      })
      .toBe(true);
  }
}

test("the exam pages of a school ask for their reads only once the page has signed in", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `student-${school.slug}@acceptance.example.test`;
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
  const ownerContext = await browser.newContext();
  await Effect.runPromise(signInOwner(ownerContext, school.slug, address("/")));
  const sitting = await Effect.runPromise(seedSitting(school.slug, learner));

  // The server drew each page with the session from the cookie, but the page's own
  // connection signs in a moment later: a read asked before then is answered as signed
  // out, and the page would show a refusal until the answer for the session arrives.
  const owner = await ownerContext.newPage();
  const ownerChanges = await Effect.runPromise(trackChanges(owner, []));
  const ownerReads = [
    {
      path: "/exams",
      reads: ["exams/exams:list", "tenancy/viewer:get"],
    },
    { path: `/exams/${sitting.examId}/edit`, reads: ["exams/exams:open"] },
    {
      path: `/exams/${sitting.examId}/sittings/${sitting.sittingId}`,
      reads: ["exams/sittings:dashboard"],
    },
  ];
  for (const { path, reads } of ownerReads) {
    await openAnswered(owner, ownerChanges, address(path), reads);
    for (const read of reads) {
      expect(ownerChanges.askedSignedOut(read)).toBe(false);
    }
  }

  const student = await studentContext.newPage();
  const studentChanges = await Effect.runPromise(trackChanges(student, []));
  await openAnswered(
    student,
    studentChanges,
    address(`/sittings/${sitting.sittingId}`),
    ["exams/sittings:student"]
  );
  expect(studentChanges.askedSignedOut("exams/sittings:student")).toBe(false);

  await studentContext.close();
  await ownerContext.close();
});
