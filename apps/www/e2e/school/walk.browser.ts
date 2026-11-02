import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  grantStudent,
  hostAddress,
  inviteLearner,
  seedForum,
  seedGraduation,
  seedSitting,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";
import { walkSchool } from "@/e2e/support/walk";

/** How long a whole walk may take: every page of a school, and every popup of each. */
const WALK_MILLISECONDS = 15 * 60 * 1000;

/** Each role at the widths a reader of it uses, so the walks cover six widths between them. */
const WALKS = [
  { role: "owner", width: 1440 },
  { role: "owner", width: 390 },
  { role: "teacher", width: 1280 },
  { role: "teacher", width: 1024 },
  { role: "teacher", width: 320 },
  { role: "student", width: 768 },
  { role: "student", width: 390 },
] as const;

test.describe.configure({ mode: "parallel" });

for (const { role, width } of WALKS) {
  test(`the ${role} of a school with records opens every page and popup at ${width}`, async ({
    baseURL,
    browser,
  }) => {
    test.setTimeout(WALK_MILLISECONDS);
    const school = await Effect.runPromise(createSchool());
    const home = hostAddress(baseURL, `${school.slug}.localhost`, "/");
    const viewport = { height: 844, width };
    const contexts = {
      owner: await browser.newContext({ viewport }),
      student: await browser.newContext({ viewport }),
      teacher: await browser.newContext({ viewport }),
    };
    await Effect.runPromise(signInOwner(contexts.owner, school.slug, home));
    await Effect.runPromise(
      signInClassTeacher(contexts.teacher, school.slug, home)
    );
    const learner = `walk-${school.slug}@acceptance.example.test`;
    await Effect.runPromise(
      inviteLearner({
        address: learner,
        baseURL: home,
        context: contexts.student,
        slug: school.slug,
      })
    );
    await Effect.runPromise(grantStudent(school.slug, learner));
    const { examId, sittingId } = await Effect.runPromise(
      seedSitting(school.slug, learner, 3, "upcoming")
    );
    await Effect.runPromise(seedForum(school.slug, 12, 6));
    await Effect.runPromise(seedGraduation(school.slug, learner));

    const opened = await walkSchool(contexts[role], new URL(home).origin, [
      "/sittings",
      `/sittings/${sittingId}`,
      `/exams/${examId}`,
      `/exams/${examId}/sittings/${sittingId}`,
      `/exams/${examId}/sittings/${sittingId}/results`,
      "/grades",
      "/cards",
      "/family",
    ]);
    expect(opened.length).toBeGreaterThan(8);
  });
}
