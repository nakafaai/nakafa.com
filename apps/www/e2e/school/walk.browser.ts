import {
  type Browser,
  type BrowserContext,
  test as base,
  expect,
} from "@playwright/test";
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

/** How long seeding the walks' school may take: its records and the sign-in of every role. */
const SEED_MILLISECONDS = 5 * 60 * 1000;

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

/** The session a role signed in with, which a context of any width opens again. */
type Session = Awaited<ReturnType<BrowserContext["storageState"]>>;

/**
 * Opens one school with records, a class teacher, a student with a sitting of three more, a forum and a
 * graduation, signs in the Owner, the class teacher and the student, and keeps each one's session.
 */
async function seedRecords(browser: Browser, baseURL: string | undefined) {
  const school = await Effect.runPromise(createSchool());
  const home = hostAddress(baseURL, `${school.slug}.localhost`, "/");
  const owner = await browser.newContext();
  const teacher = await browser.newContext();
  const student = await browser.newContext();
  await Effect.runPromise(signInOwner(owner, school.slug, home));
  await Effect.runPromise(signInClassTeacher(teacher, school.slug, home));
  const learner = `walk-${school.slug}@acceptance.example.test`;
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: home,
      context: student,
      slug: school.slug,
    })
  );
  await Effect.runPromise(grantStudent(school.slug, learner));
  const { examId, sittingId } = await Effect.runPromise(
    seedSitting(school.slug, learner, 3, "upcoming")
  );
  await Effect.runPromise(seedForum(school.slug, 12, 6));
  await Effect.runPromise(seedGraduation(school.slug, learner));
  const sessions: Record<(typeof WALKS)[number]["role"], Session> = {
    owner: await owner.storageState(),
    student: await student.storageState(),
    teacher: await teacher.storageState(),
  };
  await owner.close();
  await teacher.close();
  await student.close();
  return { examId, home, sessions, sittingId };
}

/**
 * A walk opens pages and presses only what opens a popup, and writes nothing, so the walks of one
 * worker share one school and the sessions of its roles: seeding a school with records costs more
 * than a walk of one width.
 */
const test = base.extend<
  object,
  { records: Awaited<ReturnType<typeof seedRecords>> }
>({
  records: [
    async ({ browser }, use, workerInfo) => {
      await use(await seedRecords(browser, workerInfo.project.use.baseURL));
    },
    { scope: "worker", timeout: SEED_MILLISECONDS },
  ],
});

test.describe.configure({ mode: "parallel" });

for (const { role, width } of WALKS) {
  test(`the ${role} of a school with records opens every page and popup at ${width}`, async ({
    browser,
    records,
  }) => {
    test.setTimeout(WALK_MILLISECONDS);
    const context = await browser.newContext({
      storageState: records.sessions[role],
      viewport: { height: 844, width },
    });
    const { examId, sittingId } = records;
    const opened = await walkSchool(context, new URL(records.home).origin, [
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
    await context.close();
  });
}
