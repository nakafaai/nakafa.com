import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { loginAddress } from "@repo/backend/confect/identity/address";
import { resend } from "@repo/backend/confect/emails/client";
import {
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { insertTestPage } from "@repo/backend/test/content/page";
import { insertRuntimeRelease } from "@repo/backend/test/content/runtime";
import { MASCOT } from "@repo/backend/test/mascot";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const posts = refs.public.classroom.posts;
const notice = refs.internal.emails.notice.internal;

/**
 * Two Persons the notice cannot email: one who holds no account yet, and one whose account is a
 * school login with a placeholder address.
 */
const unreachable = (fixture: Effect.Success<typeof keyedFixture>) =>
  fixture.run(
    Effect.gen(function* () {
      const writer = yield* DatabaseWriter;
      const userId = yield* writer.table("users").insert({
        authId: "card-login",
        credits: 0,
        creditsResetAt: 0,
        email: loginAddress("raka"),
        mascot: MASCOT,
        name: "Raka",
        plan: "free",
      });
      const carded = yield* writer.table("tenantPeople").insert({
        account: { claimedAt: TENANCY_NOW, method: "invite", state: "claimed", userId },
        kind: "member",
        name: "Raka",
        status: "active",
        tenantId: fixture.tenants.nf,
      });
      const unclaimed = yield* writer.table("tenantPeople").insert({
        account: { state: "unclaimed" },
        kind: "member",
        name: "Sari",
        status: "active",
        tenantId: fixture.tenants.nf,
      });
      return [carded, unclaimed];
    })
  );

/** The signed legal Pages of every language, as the production release holds them. */
const signedPages = Effect.gen(function* () {
  const ctx = yield* MutationCtx;
  yield* Effect.promise(async () => {
    await insertRuntimeRelease(ctx, ["page"]);
    for (const locale of ACTIVE_APP_LOCALE_CODES) {
      await insertTestPage(ctx, locale, "privacy-policy", `privacy-${locale}`);
      await insertTestPage(ctx, locale, "terms-of-service", `terms-${locale}`);
    }
  });
});

describe("emails/notice/internal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "emails each member of the class a link to the class when the teacher chose email, and nothing for a removed announcement",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        yield* fixture.run(signedPages);
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-1");
        const posted = yield* fixture.as("teacher").mutation(posts.publish, {
          classId: forum.classId,
          clientKey: "emailed-post",
          email: true,
          slug: nf,
          text: "Besok libur.",
        });
        const input = yield* fixture.internal.query(notice.readInput, {
          postId: posted.id,
          recipients: [
            fixture.people.student.personId,
            fixture.people.teacher.personId,
            ...(yield* unreachable(fixture)),
          ],
        });
        expect(input?.input).toMatchObject({
          classUrl: "http://nf.localhost:3000/classes/fisika-x-1",
          locale: "id",
        });
        expect(input?.addresses).toHaveLength(2);
        const send = vi.spyOn(resend, "sendEmail");
        yield* fixture.internal.mutation(notice.enqueue, {
          addresses: input?.addresses ?? [],
          html: "<p>Buka kelas</p>",
          postId: posted.id,
          subject: "Pengumuman baru di kelasmu",
          text: "Buka kelas",
        });
        expect(send).toHaveBeenCalledTimes(2);
        yield* fixture.as("teacher").mutation(posts.remove, {
          classId: forum.classId,
          postId: posted.id,
          slug: nf,
        });
        expect(
          yield* fixture.internal.query(notice.readInput, {
            postId: posted.id,
            recipients: [fixture.people.student.personId],
          })
        ).toBeNull();
        yield* fixture.internal.action(notice.send, {
          postId: posted.id,
          recipients: [fixture.people.student.personId],
        });
        expect(send).toHaveBeenCalledTimes(2);

        // A new emailed announcement reaches the student through the fan-out and the send.
        yield* fixture.as("teacher").mutation(posts.publish, {
          classId: forum.classId,
          clientKey: "fanned-post",
          email: true,
          slug: nf,
          text: "Lusa ulangan.",
        });
        yield* fixture.finishScheduled();
        expect(send).toHaveBeenCalledTimes(3);
        expect(send.mock.calls[2]?.[1]).toMatchObject({
          subject: "Pengumuman baru di kelasmu",
        });
      })
  );
});
