import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { resend } from "@repo/backend/confect/emails/client";
import { CODE_TERM } from "@repo/backend/confect/guardians/schema";
import { hashGuardianCode } from "@repo/backend/confect/identity/secret";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { nf } from "@repo/backend/test/classroom";
import {
  asStaffSchool,
  type Fixture,
  IBU,
  knownCode,
  redeem,
  startLink,
} from "@repo/backend/test/guardians";
import {
  journal,
  slugOf,
  suspend,
  actedAt,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect, Predicate, Schema } from "effect";

const { send } = refs.public.guardians.codes;
const DEVICE = "6f2b0f3e-3a39-4f25-9a51-6a7f6f1d2c11";
const SIX_DIGITS = /\b(\d{6})\b/;
const AYAH = Schema.decodeSync(Email)("ayah@example.com");

/** The answer to a request made at `at`: a code that expires one term later. */
const answerAt = (at: number) => ({
  expiresAt: at + Duration.toMillis(CODE_TERM),
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TENANCY_NOW);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** The live code rows of the school. */
const codeRows = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("guardianCodes").index("by_creation_time").take(20)
);

/** Asks for a code at the school's host, as the parent page does. */
const ask = (
  fixture: Fixture,
  email: typeof Email.Type = IBU,
  deviceId: string = DEVICE,
  slug = nf
) => fixture.anonymous.mutation(send, { deviceId, email, locale: "id", slug });

describe("guardians/codes send", () => {
  it.effect(
    "mails a six-digit code to a linked address, keeps only its keyed hash, and signs the guardian in with it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        const link = yield* startLink(fixture);
        const mail = vi.spyOn(resend, "sendEmail");
        vi.setSystemTime(actedAt());
        const answer = yield* ask(fixture);
        expect(answer).toEqual(answerAt(actedAt()));
        expect(mail).toHaveBeenCalledTimes(1);
        const message = mail.mock.calls[0]?.[1];
        expect(message).toMatchObject({
          subject: "Kode masuk Nakafa Anda",
          to: IBU,
        });
        const text =
          Predicate.hasProperty(message, "text") &&
          Predicate.isString(message.text)
            ? message.text
            : "";
        const code = SIX_DIGITS.exec(text)?.[1] ?? "";
        expect(code).toHaveLength(6);
        const [row] = yield* fixture.run(codeRows);
        expect(row).not.toHaveProperty("code");
        expect(row?.codeHash).toBe(
          yield* hashGuardianCode(fixture.tenants.nf, IBU, code)
        );
        const signedIn = yield* redeem(fixture, code);
        expect(signedIn).toMatchObject({ outcome: "signedIn" });
        expect(yield* fixture.run(codeRows)).toEqual([]);
        const guardian = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantPeople").get(link.guardian.id)
          )
        );
        expect(guardian.account).toMatchObject({
          method: "code",
          state: "claimed",
        });
        const user = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("users").get("by_email", IBU)
          )
        );
        expect(signedIn).toEqual({ authId: user.authId, outcome: "signedIn" });
        const entry = Arr.last(yield* fixture.run(journal));
        expect(entry).toMatchObject({
          _tag: "Some",
          value: { change: { method: "code", type: "person.claimed" } },
        });
      })
  );

  it.effect(
    "answers the same and sends nothing for an address without a live link, an unknown school, or a suspended one",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        yield* startLink(fixture);
        const mail = vi.spyOn(resend, "sendEmail");
        const unlinked = actedAt(0);
        const unknown = actedAt(1);
        const suspended = actedAt(2);
        vi.setSystemTime(unlinked);
        expect(yield* ask(fixture, AYAH)).toEqual(answerAt(unlinked));
        vi.setSystemTime(unknown);
        expect(yield* ask(fixture, IBU, DEVICE, slugOf("missing"))).toEqual(
          answerAt(unknown)
        );
        yield* fixture.run(suspend(fixture.tenants.nf));
        vi.setSystemTime(suspended);
        expect(yield* ask(fixture)).toEqual(answerAt(suspended));
        expect(mail).not.toHaveBeenCalled();
        expect(yield* fixture.run(codeRows)).toEqual([]);
      })
  );

  it.effect(
    "replaces the code of an address, and stops at the request limit",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        yield* startLink(fixture);
        const mail = vi.spyOn(resend, "sendEmail");
        for (const _ of Arr.makeBy(5, (index) => index)) {
          yield* ask(fixture);
        }
        const rows = yield* fixture.run(codeRows);
        expect(rows).toHaveLength(1);
        yield* ask(fixture);
        expect(mail).toHaveBeenCalledTimes(5);
        expect(yield* fixture.run(codeRows)).toEqual(rows);
        const other = "0d0f9c39-6c43-4b4e-8f6d-3d3c1f8b6a77";
        yield* ask(fixture, IBU, other);
        expect(mail).toHaveBeenCalledTimes(5);
      })
  );
});

describe("guardians/codes redeem", () => {
  it.effect(
    "voids a code on the third wrong try, and refuses an expired one",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        yield* startLink(fixture);
        yield* knownCode(fixture, "111111");
        expect(yield* redeem(fixture, "222222")).toEqual({
          outcome: "refused",
        });
        expect(yield* redeem(fixture, "333333")).toEqual({
          outcome: "refused",
        });
        expect((yield* fixture.run(codeRows))[0]?.tries).toBe(2);
        expect(yield* redeem(fixture, "444444")).toEqual({
          outcome: "refused",
        });
        expect(yield* fixture.run(codeRows)).toEqual([]);
        expect(yield* redeem(fixture, "111111")).toEqual({
          outcome: "refused",
        });
        yield* knownCode(fixture, "555555");
        vi.setSystemTime(TENANCY_NOW + Duration.toMillis(CODE_TERM));
        expect(yield* redeem(fixture, "555555")).toEqual({
          outcome: "refused",
        });
        expect(yield* fixture.run(codeRows)).toEqual([]);
      })
  );

  it.effect(
    "binds the guardian to the account that holds the address, and keeps a claimed guardian's account",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        yield* startLink(fixture);
        const account = yield* fixture.account("ibu", IBU, true);
        yield* knownCode(fixture, "123456");
        expect(yield* redeem(fixture, "123456")).toEqual({
          authId: account.authUserId,
          outcome: "signedIn",
        });
        yield* knownCode(fixture, "654321");
        expect(yield* redeem(fixture, "654321")).toEqual({
          authId: account.authUserId,
          outcome: "signedIn",
        });
      })
  );

  it.effect(
    "refuses an address whose link ended, a removed guardian, and a malformed request",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        const link = yield* startLink(fixture);
        expect(yield* redeem(fixture, "123456", "not an address")).toEqual({
          outcome: "refused",
        });
        for (const slug of ["Not A Slug", "missing"]) {
          expect(
            yield* fixture.internal.mutation(
              refs.internal.guardians.codes.redeem,
              { code: "123456", email: IBU, slug }
            )
          ).toEqual({ outcome: "refused" });
        }
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenantPeople").patch(link.guardian.id, {
              status: "removed",
            })
          )
        );
        yield* knownCode(fixture, "123456");
        expect(yield* redeem(fixture, "123456")).toEqual({
          outcome: "refused",
        });
        yield* fixture
          .as("counselor")
          .mutation(refs.public.guardians.links.revoke, {
            linkId: link.id,
            slug: nf,
          });
        yield* knownCode(fixture, "222222");
        expect(yield* redeem(fixture, "222222")).toEqual({
          outcome: "refused",
        });
      })
  );

  it.effect(
    "stops an address at the sign-in limit, even with the right code",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        yield* startLink(fixture);
        for (const _ of Arr.makeBy(10, (index) => index)) {
          yield* redeem(fixture, "000000");
        }
        yield* knownCode(fixture, "123456");
        expect(yield* redeem(fixture, "123456")).toEqual({
          outcome: "refused",
        });
      })
  );
});

describe("guardians/codes sweep", () => {
  it.effect("deletes the codes that expired unused, and keeps live ones", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* knownCode(fixture, "111111");
      const later = TENANCY_NOW + Duration.toMillis(CODE_TERM);
      vi.setSystemTime(later);
      yield* knownCode(fixture, "222222", AYAH, later);
      expect(
        yield* fixture.internal.mutation(
          refs.internal.guardians.codes.sweep,
          {}
        )
      ).toBeNull();
      const rows = yield* fixture.run(codeRows);
      expect(Arr.map(rows, (row) => row.email)).toEqual(["ayah@example.com"]);
    })
  );
});
