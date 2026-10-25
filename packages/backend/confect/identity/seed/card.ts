import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  firstActiveUnit,
  required,
  tenantOf,
} from "@repo/backend/confect/acceptance/lookup";
import { requireAcceptanceSeed } from "@repo/backend/confect/acceptance/seed";
import { activeOwners, assignRole } from "@repo/backend/confect/access/grant";
import { writeCard } from "@repo/backend/confect/identity/card";
import { claimLoginName } from "@repo/backend/confect/identity/logins";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { personAuthority } from "@repo/backend/confect/tenancy/authority";
import { Array as Arr, Effect, Option } from "effect";

/** The school login name of the seeded student, which a browser test types on the school host. */
const LOGIN_NAME = "siswa.uji";

/** The name of the seeded student, which its account takes, so a browser test can read it back. */
const STUDENT_NAME = "Siswa Uji";

/**
 * Seeds one new student of a school that `createSchool` opened, the way the school's Owner adds
 * one: a Person with a student grant in the first active unit, its school login name, and its first
 * card. The card records the Owner as its issuer, and the journal records the seed as the system.
 * The student has no account yet, so redeeming the card makes one (ADR 0009). It returns the login
 * name and the plain code, which the card shows once.
 */
export const seedCard = Effect.fn("identity.seed.card")(function* (args: {
  readonly slug: string;
}) {
  yield* requireAcceptanceSeed();
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const tenant = yield* tenantOf(args.slug);
  const unit = yield* firstActiveUnit(tenant._id);
  const owner = yield* required(
    Arr.head(yield* activeOwners(tenant._id)),
    "The school has no Owner."
  );
  const issuer = yield* reader
    .table("tenantPeople")
    .get(owner.personId)
    .pipe(Effect.orDie);
  const personId = yield* writer
    .table("tenantPeople")
    .insert({
      account: { state: "unclaimed" },
      kind: "member",
      name: STUDENT_NAME,
      status: "active",
      tenantId: tenant._id,
    })
    .pipe(Effect.orDie);
  const person = yield* reader
    .table("tenantPeople")
    .get(personId)
    .pipe(Effect.orDie);
  yield* assignRole(systemActor, person, "student", {
    kind: "unit",
    unitId: unit._id,
  }).pipe(Effect.orDie);
  yield* claimLoginName(person, LOGIN_NAME).pipe(Effect.orDie);
  const card = yield* writeCard(person, issuer, Option.none());
  yield* personAuthority.record(systemActor, person, {
    card: card.cardId,
    type: "card.issued",
  });
  return { code: card.code, loginName: LOGIN_NAME };
});
