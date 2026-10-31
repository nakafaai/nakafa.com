import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { revokeRole } from "@/e2e/support/roles";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInOwner,
  signInTeacher,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The Teacher grant over the whole school that the acceptance runtime gives its Teacher, which the Owner revokes. */
const TEACHER_GRANT = {
  person: "Acceptance Teacher",
  role: "Teacher",
} as const;

/** The heading of the school's not-found page, which a reload answers to a viewer without the grant. */
const NOT_FOUND = "We can't find this page";

test("a teacher whose role ends while proctoring a room sees what a reload shows, and the room's actions go with it", async ({
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
  await studentContext.close();
  const ownerContext = await browser.newContext();
  await Effect.runPromise(signInOwner(ownerContext, school.slug, address("/")));
  const teacherContext = await browser.newContext();
  await Effect.runPromise(
    signInTeacher(teacherContext, school.slug, address("/"))
  );
  // The Owner made the seeded exam, so the Teacher proctors its room by the Teacher grant alone.
  const sitting = await Effect.runPromise(seedSitting(school.slug, learner));

  const teacher = await teacherContext.newPage();
  const room = address(
    `/exams/${sitting.examId}/sittings/${sitting.sittingId}`
  );
  await teacher.goto(room);
  const changeToken = teacher
    .locator('[data-slot="page-header"]')
    .getByRole("button", { name: "Change token" });
  await waitUntilTakenOver(changeToken);

  // The Owner ends the Teacher's role elsewhere while the room is open.
  const owner = await ownerContext.newPage();
  await owner.goto(address("/settings/roles"));
  await revokeRole(owner, TEACHER_GRANT);

  // The open room closes itself as a reload would: the page says it is not found, and its actions are gone.
  const notFound = teacher.getByRole("heading", { level: 1, name: NOT_FOUND });
  await expect(notFound).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await expect(changeToken).toHaveCount(0);
  await expect(teacher).toHaveURL(room);
  await teacher.reload();
  await expect(notFound).toBeVisible({ timeout: readinessTimeoutMilliseconds });

  await ownerContext.close();
  await teacherContext.close();
});
