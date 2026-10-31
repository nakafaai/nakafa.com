import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import recordsInternal from "@repo/backend/confect/_generated/refs/records.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
  QueryRunner,
  StorageActionWriter,
} from "@repo/backend/confect/_generated/services";
import type { PrintableLetter } from "@repo/backend/confect/records/letter";
import { drawLetterPdf } from "@repo/backend/confect/records/letters/pdf";
import spec from "@repo/backend/confect/records/letters.spec";
import {
  openNisn,
  rosterEntryOf,
  schoolKeys,
} from "@repo/backend/confect/roster/entry";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { cohortAuthority } from "@repo/backend/confect/tenancy/authority";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Clock, Effect, Layer, Struct } from "effect";

/** The PDF's media type. */
const PDF_TYPE = "application/pdf";

/** The issued letter a print names. Only an issue schedules a print, so another state is a defect. */
const issuedLetter = Effect.fn("records.letters.issued")(function* (
  letterId: GenericId.GenericId<"graduationLetters">
) {
  const letter = yield* (yield* DatabaseReader)
    .table("graduationLetters")
    .get(letterId)
    .pipe(Effect.orDie);
  if (letter.state !== "issued") {
    return yield* Effect.die("A print names a letter that is not issued.");
  }
  return letter;
});

/**
 * The printable copy of an issued SKL: its decision, its school with its NPSN, its class
 * group and period, the student's name and NISN, the copy of the transcript taken at issue,
 * and the public check's address of its hash, in the language of the unit's pages. Only a
 * student with a NISN on file in a unit with an NPSN gets a letter, so a missing one is a
 * defect.
 */
const printable = FunctionImpl.make(
  databaseSchema,
  spec,
  "printable",
  Effect.fn("records.letters.printable")(function* ({ letterId }) {
    const letter = yield* issuedLetter(letterId);
    const reader = yield* DatabaseReader;
    const [graduation, cohort, period, unit, person, entry, keys] =
      yield* Effect.all([
        reader.table("graduations").get(letter.graduationId).pipe(Effect.orDie),
        reader.table("tenantCohorts").get(letter.cohortId).pipe(Effect.orDie),
        reader.table("tenantPeriods").get(letter.periodId).pipe(Effect.orDie),
        reader.table("tenantUnits").get(letter.unitId).pipe(Effect.orDie),
        reader.table("tenantPeople").get(letter.personId).pipe(Effect.orDie),
        rosterEntryOf(letter.personId).pipe(
          Effect.flatMap(Effect.fromOption),
          Effect.orDie
        ),
        schoolKeys(letter.tenantId),
      ]);
    const [nisn, npsn] = yield* Effect.all([
      openNisn(keys, entry),
      Effect.fromNullishOr(unit.npsn),
    ]).pipe(Effect.orDie);
    const locale = unit.contentLanguage;
    const copy: typeof PrintableLetter.Type = {
      ...Struct.pick(graduation, ["date", "decision", "head", "nip", "place"]),
      average: letter.average,
      cohort: cohort.name,
      hash: letter.hash,
      locale,
      nisn,
      npsn,
      number: letter.number,
      period: period.name,
      school: unit.name,
      student: person.name,
      subjects: letter.subjects,
      verifyUrl: new URL(`/${locale}/verify/${letter.hash}`, SITE_ORIGIN).href,
    };
    return copy;
  })
);

/** Draws an issued SKL's PDF, stores it, and locks the letter with it. */
const draw = FunctionImpl.make(
  databaseSchema,
  spec,
  "draw",
  Effect.fn("records.letters.draw")(function* ({ letterId }) {
    const copy = yield* (yield* QueryRunner)
      .runQuery(recordsInternal.letters.printable, { letterId })
      .pipe(Effect.orDie);
    const bytes = yield* drawLetterPdf(copy);
    const storageId = yield* (yield* StorageActionWriter).store(
      new Blob([bytes], { type: PDF_TYPE })
    );
    yield* (yield* MutationRunner)
      .runMutation(recordsInternal.letters.lock, { letterId, storageId })
      .pipe(Effect.orDie);
    return null;
  })
);

/**
 * Locks an issued SKL with its stored PDF, and journals the lock on its class group with the
 * letter's ID and hash, as the principal who issued it (ADR 0033, S6).
 */
const lock = FunctionImpl.make(
  databaseSchema,
  spec,
  "lock",
  Effect.fn("records.letters.lock")(function* ({ letterId, storageId }) {
    const letter = yield* issuedLetter(letterId);
    const now = yield* Clock.currentTimeMillis;
    yield* (yield* DatabaseWriter)
      .table("graduationLetters")
      .replace(letterId, {
        ...Struct.omit(letter, ["_creationTime", "_id"]),
        lockedAt: now,
        state: "locked",
        storageId,
      })
      .pipe(Effect.orDie);
    const reader = yield* DatabaseReader;
    const [cohort, issuer] = yield* Effect.all([
      reader.table("tenantCohorts").get(letter.cohortId).pipe(Effect.orDie),
      reader.table("tenantPeople").get(letter.issuedBy).pipe(Effect.orDie),
    ]);
    yield* cohortAuthority.record(personActor(issuer), cohort, {
      hash: letter.hash,
      letter: letterId,
      type: "letter.locked",
    });
    return null;
  })
);

/** The drawing of issued SKL's PDFs and their lock. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(printable),
  Layer.provide(draw),
  Layer.provide(lock),
  GroupImpl.finalize
);
