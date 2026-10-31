import { FunctionImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import {
  GraduationDateInvalid,
  GraduationIssued,
  GraduationNotFinal,
  GraduationUndecided,
} from "@repo/backend/confect/records/errors";
import type { GraduationDecision } from "@repo/backend/confect/records/graduation";
import {
  finalUnit,
  graduationOf,
  graduationView,
  lineOf,
} from "@repo/backend/confect/records/graduations/facts";
import spec from "@repo/backend/confect/records/graduations.spec";
import { LetterContent } from "@repo/backend/confect/records/letter";
import { Cohort, Period } from "@repo/backend/confect/tenancy/access";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { periodAuthority } from "@repo/backend/confect/tenancy/authority";
import { parseCivilDate } from "@repo/backend/confect/tenancy/period";
import { lastGradeOf } from "@repo/backend/confect/tenancy/promotion/destination";
import { sha256Hex } from "@repo/utilities/digest";
import {
  Array as Arr,
  Clock,
  Duration,
  Effect,
  Option,
  Schema,
  String as Str,
  Struct,
} from "effect";

/**
 * The students one call of `issue` reads. Each reads its person, roster row, report cards,
 * and letter, so a batch stays far under a mutation's read limit; the page calls again with
 * the cursor until the class group is done.
 */
const ISSUE_BATCH = 25;

/** The digits of a letter's place in its period, as `{decision}/{001}` writes it. */
const NUMBER_DIGITS = 3;

/** The JSON text of an SKL's content, its keys in the order of the schema's fields. */
const encodeContent = Schema.encodeEffect(Schema.fromJsonString(LetterContent));

/** The SHA-256 of an SKL's content as JSON text, which its PDF and QR code carry. */
const letterHash = Effect.fn("records.graduations.hash")(function* (
  content: typeof LetterContent.Type
) {
  return yield* sha256Hex(yield* encodeContent(content));
}, Effect.orDie);

/**
 * Records the head's decision on graduation for a unit's period: its number, its date, which
 * must be a day of the unit's calendar, the place of issue, and the head's name and NIP. It
 * changes until the first letter is issued, which keeps the number and date of every letter.
 * Each record is journaled on the period with no text (ADR 0016).
 */
export const decide = FunctionImpl.make(
  databaseSchema,
  spec,
  "decide",
  Effect.fn("records.graduations.decide")(function* (args) {
    const period = yield* Period;
    const { person } = yield* Member;
    const unit = yield* (yield* DatabaseReader)
      .table("tenantUnits")
      .get(period.unitId)
      .pipe(Effect.orDie);
    if (Option.isNone(lastGradeOf(unit.level))) {
      return yield* new GraduationNotFinal();
    }
    if (Option.isNone(parseCivilDate(args.date, unit.timeZone))) {
      return yield* new GraduationDateInvalid();
    }
    const existing = yield* graduationOf(period._id);
    if (Option.exists(existing, (found) => found.issued > 0)) {
      return yield* new GraduationIssued();
    }
    const decision: typeof GraduationDecision.Type = Struct.pick(args, [
      "date",
      "decision",
      "head",
      "nip",
      "place",
    ]);
    const now = yield* Clock.currentTimeMillis;
    const writer = yield* DatabaseWriter;
    const id = yield* Option.match(existing, {
      onNone: () =>
        writer.table("graduations").insert({
          ...decision,
          createdAt: now,
          decidedBy: person._id,
          issued: 0,
          periodId: period._id,
          tenantId: period.tenantId,
          unitId: period.unitId,
          updatedAt: now,
        }),
      onSome: (found) =>
        writer
          .table("graduations")
          .replace(found._id, {
            ...Struct.omit(found, ["_creationTime", "_id", "nip"]),
            ...decision,
            decidedBy: person._id,
            updatedAt: now,
          })
          .pipe(Effect.as(found._id)),
    }).pipe(Effect.orDie);
    yield* periodAuthority.record(personActor(person), period, {
      type: "graduation.decided",
    });
    const row = yield* (yield* DatabaseReader)
      .table("graduations")
      .get(id)
      .pipe(Effect.orDie);
    return graduationView(row);
  })
);

/**
 * Issues the SKL of one batch of a graduating class group's students, from `cursor` on. A
 * student with nothing missing who holds no letter yet gets one: the next number of the
 * period, the transcript data their locked report cards give, and the hash of that content.
 * Its PDF is drawn next, which locks it. A student with something missing is skipped, and the
 * page lists why. The decision then counts its letters, which freezes it.
 */
export const issue = FunctionImpl.make(
  databaseSchema,
  spec,
  "issue",
  Effect.fn("records.graduations.issue")(function* ({ cursor }) {
    const row = yield* Cohort;
    const { person } = yield* Member;
    const unit = yield* finalUnit(row);
    const graduation = yield* graduationOf(row.periodId);
    if (Option.isNone(graduation)) {
      return yield* new GraduationUndecided();
    }
    const decided = graduation.value;
    const page = yield* (yield* DatabaseReader)
      .table("tenantCohortMembers")
      .index("by_cohortId_and_personId", (query) =>
        query.eq("cohortId", row._id)
      )
      .paginate({ cursor, numItems: ISSUE_BATCH })
      .pipe(Effect.orDie);
    const lines = yield* Effect.forEach(page.page, (placement) =>
      lineOf(row, unit, graduation, placement.personId)
    );
    const open = Arr.filter(lines, ({ line }) => line.letter === null);
    const ready = Arr.getSomes(
      Arr.map(open, ({ line, transcript }) =>
        Arr.isReadonlyArrayEmpty(line.missing)
          ? Option.map(transcript, (found) => ({ found, line }))
          : Option.none()
      )
    );
    const now = yield* Clock.currentTimeMillis;
    const writer = yield* DatabaseWriter;
    const scheduler = yield* Scheduler;
    yield* Effect.forEach(
      ready,
      ({ found, line }, index) =>
        Effect.gen(function* () {
          const number = `${decided.decision}/${Str.padStart(
            NUMBER_DIGITS,
            "0"
          )(String(decided.issued + index + 1))}`;
          const hash = yield* letterHash({
            average: found.average,
            date: decided.date,
            decision: decided.decision,
            graduationId: decided._id,
            issuedAt: now,
            number,
            personId: line.student.id,
            subjects: found.subjects,
          });
          const letterId = yield* writer
            .table("graduationLetters")
            .insert({
              ...found,
              cohortId: row._id,
              graduationId: decided._id,
              hash,
              issuedAt: now,
              issuedBy: person._id,
              number,
              periodId: row.periodId,
              personId: line.student.id,
              state: "issued",
              tenantId: row.tenantId,
              unitId: row.unitId,
            })
            .pipe(Effect.orDie);
          yield* scheduler
            .runAfter(Duration.zero, refs.internal.records.letters.draw, {
              letterId,
            })
            .pipe(Effect.orDie);
        }),
      { discard: true }
    );
    if (Arr.isReadonlyArrayNonEmpty(ready)) {
      yield* writer
        .table("graduations")
        .replace(decided._id, {
          ...Struct.omit(decided, ["_creationTime", "_id"]),
          issued: decided.issued + ready.length,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
    }
    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      issued: ready.length,
      skipped: open.length - ready.length,
    };
  })
);
