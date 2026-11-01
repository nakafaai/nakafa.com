import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { type BrowserContext, expect, type Page } from "@playwright/test";
import {
  CardFixture,
  ForumFixture,
  GraduationFixture,
  SchoolFixture,
  SessionCookie,
  SittingFixture,
} from "@repo/backend/scripts/content/acceptance/fixture";
import { Array as Arr, Effect, FileSystem, Schema } from "effect";
import { runAcceptanceCommand } from "@/e2e/support/acceptance";
import { addSessionCookie } from "@/e2e/support/context";

/**
 * Opens a new school in the running local acceptance runtime and reads its
 * address and name back. No account holds the school's Owner address yet, so
 * the school has no member until `signInOwner` signs its Owner in. Opening can
 * time out under a busy machine, the same way a learner can (see
 * `signInLearner`), and a school that a failed run left behind is harmless
 * because every run opens a new one.
 */
export const createSchool = Effect.fn("NakafaE2E.createSchool")(
  function* () {
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* fs.makeTempDirectoryScoped({
      prefix: "nakafa-school-",
    });
    const output = `${directory}/school.json`;
    yield* runAcceptanceCommand("school", output).pipe(
      Effect.retry({ times: 2 })
    );
    return yield* fs
      .readFileString(output)
      .pipe(Effect.flatMap(Schema.decodeEffect(SchoolFixture)));
  },
  Effect.scoped,
  Effect.provide(nodeServicesLayer)
);

/**
 * Signs in a member of a school that `createSchool` opened, through the acceptance
 * command of its kind (`owner` or `teacher`), and returns its session cookie. The
 * command holds the member's address and claims the school's invite before the
 * cookie is returned, so the member is a member when the cookie is used. Each
 * command runs once per school: a second run would open the same account again.
 */
const createMemberCookie = Effect.fn("NakafaE2E.createMemberCookie")(
  function* (kind: "owner" | "teacher" | "class-teacher", slug: string) {
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* fs.makeTempDirectoryScoped({
      prefix: `nakafa-${kind}-`,
    });
    const output = `${directory}/cookie.json`;
    yield* runAcceptanceCommand(kind, slug, output);
    return yield* fs
      .readFileString(output)
      .pipe(Effect.flatMap(Schema.decodeEffect(SessionCookie)));
  },
  Effect.scoped,
  Effect.provide(nodeServicesLayer)
);

/**
 * Fills a school that `createSchool` opened with the records of a real one, a thousand students
 * and the rest (`FULL_SCHOOL`). The school's Owner must have signed in first.
 */
export const fillSchool = Effect.fn("NakafaE2E.fillSchool")(function* (
  slug: string
) {
  yield* runAcceptanceCommand("full", slug);
}, Effect.provide(nodeServicesLayer));

/** Signs the Owner of a school into one browser context, for the school host at `address`. */
export const signInOwner = Effect.fn("NakafaE2E.signInOwner")(function* (
  context: BrowserContext,
  slug: string,
  address: string
) {
  const cookie = yield* createMemberCookie("owner", slug);
  yield* addSessionCookie(context, cookie, address);
});

/**
 * Signs the Teacher of a school into one browser context, for the school host at
 * `address`. A Teacher is a member without the school's management rights, so the
 * school settings answer not found for it.
 */
export const signInTeacher = Effect.fn("NakafaE2E.signInTeacher")(function* (
  context: BrowserContext,
  slug: string,
  address: string
) {
  const cookie = yield* createMemberCookie("teacher", slug);
  yield* addSessionCookie(context, cookie, address);
});

/**
 * Signs the Teacher of one class into one browser context, for the school host at `address`.
 * The acceptance runtime opens the school's active period, creates the class `Fisika X-1` in
 * it, and makes the Teacher teach that class, so the Teacher sees the class in the sidebar.
 * The command runs once per school, because a second run would add another class.
 */
export const signInClassTeacher = Effect.fn("NakafaE2E.signInClassTeacher")(
  function* (context: BrowserContext, slug: string, address: string) {
    const cookie = yield* createMemberCookie("class-teacher", slug);
    yield* addSessionCookie(context, cookie, address);
  }
);

/**
 * Invites a learner into a school that `createSchool` opened, and signs the learner into
 * one browser context. The local acceptance runtime invites the address into the school,
 * creates the learner's account with that address, claims the invitation for the account,
 * and waits until the inbox holds the row. With `expired`, the invite ends before the
 * account signs in, as its term ending does, so the learner signs in as no member of the
 * school. The command runs once, because a second run would invite the same address again.
 */
export const inviteLearner = Effect.fn("NakafaE2E.inviteLearner")(
  function* (learner: {
    readonly address: string;
    readonly baseURL: string;
    readonly context: BrowserContext;
    readonly expired?: boolean;
    readonly slug: string;
  }) {
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* fs.makeTempDirectoryScoped({
      prefix: "nakafa-invite-",
    });
    const output = `${directory}/cookie.json`;
    yield* runAcceptanceCommand(
      "invite",
      learner.slug,
      learner.address,
      output,
      ...(learner.expired === true ? ["expired"] : [])
    );
    const cookie = yield* fs
      .readFileString(output)
      .pipe(Effect.flatMap(Schema.decodeEffect(SessionCookie)));
    yield* addSessionCookie(learner.context, cookie, learner.baseURL);
  },
  Effect.scoped,
  Effect.provide(nodeServicesLayer)
);

/**
 * Gives a learner that `inviteLearner` invited a student grant in the first active unit of a
 * school, so the school can place the learner in a cohort. An invite gives no grant by itself,
 * and the learner must already be a member of the school.
 */
export const grantStudent = Effect.fn("NakafaE2E.grantStudent")(function* (
  slug: string,
  learnerAddress: string
) {
  yield* runAcceptanceCommand("student", slug, learnerAddress);
});

/**
 * Seeds one proctored sitting of a keyed exam in a school that `createSchool` opened, for a
 * learner who is already a member of it, and returns the exam, the sitting, and its token. The
 * sitting opens now and closes an hour later, and the learner gets a student grant in the
 * school's first active unit. A `crowd` seats that many extra students with attempts in
 * progress first, so the learner's own attempt lands on a later dashboard page. `upcoming` also
 * schedules a room of the same exam for the next day, which the owner's home lists as upcoming,
 * `essay` adds an essay that the student writes and the teacher grades, `prose` ends the exam with a
 * third question whose prompt holds every block and mark once, and `templates` adds a question of
 * every other template, each written and keyed, and the essay. Each call seeds a new exam and sitting.
 */
export const seedSitting = Effect.fn("NakafaE2E.seedSitting")(
  function* (
    slug: string,
    learnerAddress: string,
    crowd = 0,
    extra?: "essay" | "prose" | "templates" | "upcoming"
  ) {
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* fs.makeTempDirectoryScoped({
      prefix: "nakafa-sitting-",
    });
    const output = `${directory}/sitting.json`;
    yield* runAcceptanceCommand(
      "sitting",
      slug,
      learnerAddress,
      output,
      String(crowd),
      ...(extra === undefined ? [] : [extra])
    );
    return yield* fs
      .readFileString(output)
      .pipe(Effect.flatMap(Schema.decodeEffect(SittingFixture)));
  },
  Effect.scoped,
  Effect.provide(nodeServicesLayer)
);

/**
 * Seeds one new student in a school that `createSchool` opened, with a student grant and a login card,
 * and returns the school login name that the student types and the card's plain code. The card is
 * not redeemed yet, so a browser test redeems it through the school's own form.
 */
/**
 * Seeds a graduation for the learner with the address (ADR 0033, S6): a class group of the last
 * grade of the school's first active unit with the learner placed in it, a NISN on file, the
 * unit's NPSN, and the learner's report card approved, whose PDF the runtime draws next. Each
 * call seeds a new class group.
 */
export const seedGraduation = Effect.fn("NakafaE2E.seedGraduation")(
  function* (slug: string, learnerAddress: string) {
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* fs.makeTempDirectoryScoped({
      prefix: "nakafa-graduation-",
    });
    const output = `${directory}/graduation.json`;
    yield* runAcceptanceCommand("graduation", slug, learnerAddress, output);
    return yield* fs
      .readFileString(output)
      .pipe(Effect.flatMap(Schema.decodeEffect(GraduationFixture)));
  },
  Effect.scoped,
  Effect.provide(nodeServicesLayer)
);

export const seedCard = Effect.fn("NakafaE2E.seedCard")(
  function* (slug: string) {
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* fs.makeTempDirectoryScoped({
      prefix: "nakafa-card-",
    });
    const output = `${directory}/card.json`;
    yield* runAcceptanceCommand("card", slug, output);
    return yield* fs
      .readFileString(output)
      .pipe(Effect.flatMap(Schema.decodeEffect(CardFixture)));
  },
  Effect.scoped,
  Effect.provide(nodeServicesLayer)
);

/**
 * Seeds the history of the general channel of the class `signInClassTeacher` seeds, in a school
 * that `createSchool` opened: `count` messages from a classmate, a minute apart and ending now,
 * and the class teacher's read mark after the first `read` of them. It returns the channel and the
 * messages, oldest first. Each call adds a new classmate and its messages.
 */
export const seedForum = Effect.fn("NakafaE2E.seedForum")(
  function* (slug: string, count: number, read: number) {
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* fs.makeTempDirectoryScoped({
      prefix: "nakafa-forum-",
    });
    const output = `${directory}/forum.json`;
    yield* runAcceptanceCommand(
      "forum",
      slug,
      String(count),
      String(read),
      output
    );
    return yield* fs
      .readFileString(output)
      .pipe(Effect.flatMap(Schema.decodeEffect(ForumFixture)));
  },
  Effect.scoped,
  Effect.provide(nodeServicesLayer)
);

/**
 * Records the bank transfer of a school invoice in the running local acceptance runtime,
 * as an operator does once the money arrives, so the school's billing shows it paid.
 */
export const recordTransfer = Effect.fn("NakafaE2E.recordTransfer")(function* (
  number: string,
  reference: string
) {
  yield* runAcceptanceCommand("transfer", number, reference);
});

/** The address of a path on a host under the same server as the test's base address. */
export function hostAddress(
  baseURL: string | undefined,
  hostname: string,
  path: string
) {
  const address = new URL(path, String(baseURL));
  address.hostname = hostname;
  return address.href;
}

/**
 * Finishes the questionnaire on its last question and lands on the new school's host. The school
 * shows at once, then its own address opens. The page opens that host at SITE_URL's port. A verify
 * run may serve the site on another port, where that navigation commits the browser's error page,
 * so this waits for the page's own navigation to commit, on either, before it opens the host at the
 * port this run serves. The account's session then reaches the school's host as it does in
 * production.
 */
export const finishSchoolStart = Effect.fn("NakafaE2E.finishSchoolStart")(
  function* (
    page: Page,
    baseURL: string | undefined,
    school: Record<"name" | "slug", string>
  ) {
    const schoolHome = hostAddress(
      baseURL,
      `${school.slug}.localhost`,
      "/setup"
    );
    yield* Effect.tryPromise(async () => {
      const opened = page.waitForEvent("framenavigated", {
        predicate: (frame) => {
          const url = new URL(frame.url());
          return (
            frame === page.mainFrame() &&
            (url.hostname === `${school.slug}.localhost` ||
              url.protocol === "chrome-error:")
          );
        },
        timeout: 0,
      });
      await page.getByRole("button", { name: "Open school" }).click();
      await expect(page.getByText(school.name, { exact: true })).toBeVisible();
      await opened;
      await page.goto(schoolHome);
      const cookies = await page.context().cookies(String(baseURL));
      await page.context().addCookies(
        Arr.map(cookies, (cookie) => ({
          httpOnly: cookie.httpOnly,
          name: cookie.name,
          sameSite: cookie.sameSite,
          url: schoolHome,
          value: cookie.value,
        }))
      );
      await page.reload();
    });
  }
);
