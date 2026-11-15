import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { Recipient } from "@repo/backend/confect/emails/unsubscribe/schema";
import { tokenOf } from "@repo/backend/confect/emails/unsubscribe/token";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { confirm } = refs.public.emails.unsubscribe.requests;

/** The email switches a fixture holds, each as the kind it holds off. */
const emailSwitches = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("noticePreferences").index("by_creation_time").collect()
).pipe(Effect.orDie);

/** The suppressed addresses a fixture holds. */
const suppressions = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("emailSuppressions").index("by_creation_time").collect()
).pipe(Effect.orDie);

/** Posts a mail client's one-click unsubscribe with a token, as RFC 8058 sends it. */
const postOneClick = (
  fixture: Effect.Success<typeof tenancyFixture>,
  token: string
) =>
  Effect.promise(() =>
    fixture.fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`, {
      body: "List-Unsubscribe=One-Click",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    })
  );

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("emails/unsubscribe/requests", () => {
  it.effect(
    "switches the email of an account's notices off with no session, and confirming again writes nothing more",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const recipient: typeof Recipient.Type = {
          _tag: "Account",
          userId: fixture.users.owner.userId,
        };
        const token = yield* tokenOf(recipient);
        yield* fixture.anonymous.mutation(confirm, { token });
        yield* fixture.anonymous.mutation(confirm, { token });
        const switches = yield* fixture.run(emailSwitches);
        expect(
          Arr.map(switches, ({ channel, kind }) => ({ channel, kind }))
        ).toEqual([
          { channel: "email", kind: "commentReply" },
          { channel: "email", kind: "tryoutReminder" },
        ]);
      })
  );

  it.effect(
    "switches the email of every kind a Person of a school can switch off, and never the invitation's",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const recipient: typeof Recipient.Type = {
          _tag: "Person",
          personId: fixture.people.student.personId,
          tenantId: fixture.tenants.nf,
        };
        yield* fixture.anonymous.mutation(confirm, {
          token: yield* tokenOf(recipient),
        });
        const kinds = Arr.map(
          yield* fixture.run(emailSwitches),
          ({ kind }) => kind
        );
        expect(kinds).toEqual([
          "forumMention",
          "classAnnouncement",
          "taskPublished",
          "gradeReleased",
          "taskMissed",
          "examStart",
          "examGuardianReminder",
        ]);
      })
  );

  it.effect(
    "keeps an address that holds no account once, from the page and from a mail client's one-click post alike",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const token = yield* tokenOf({
          _tag: "Address",
          address: " Wali@Example.test",
        });
        yield* fixture.anonymous.mutation(confirm, { token });
        const response = yield* postOneClick(fixture, token);
        expect(response.status).toBe(200);
        expect(
          Arr.map(yield* fixture.run(suppressions), ({ address }) => address)
        ).toEqual(["wali@example.test"]);
      })
  );

  it.effect(
    "refuses a token no Nakafa email carried, on the page and in a one-click post",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const failure = yield* fixture.anonymous
          .mutation(confirm, { token: "forged.token" })
          .pipe(Effect.flip);
        expect(failure).toMatchObject({ code: "UNSUBSCRIBE_TOKEN_INVALID" });
        const response = yield* postOneClick(fixture, "forged.token");
        expect(response.status).toBe(400);
        // A post that carries no token at all is refused the same way.
        const tokenless = yield* Effect.promise(() =>
          fixture.fetch("/email/unsubscribe", {
            body: "List-Unsubscribe=One-Click",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            method: "POST",
          })
        );
        expect(tokenless.status).toBe(400);
        expect(yield* fixture.run(suppressions)).toEqual([]);
      })
  );
});
