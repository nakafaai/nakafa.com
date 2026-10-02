import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import { ObjectRef } from "@repo/backend/confect/access/catalog";
import spec from "@repo/backend/confect/journal/audit.spec";
import { Actor } from "@repo/backend/confect/journal/schema";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import {
  Array as Arr,
  Effect,
  HashMap,
  Layer,
  Number as Num,
  Struct,
} from "effect";

/** The largest page one request reads. */
const PAGE_LIMIT = 100;

/**
 * The member's tenant entries, newest first. Each Person named as an actor or
 * a subject on the page is read once.
 */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("journal.audit.list")(function* ({ paginationOpts }) {
    const { tenant } = yield* Member;
    const reader = yield* DatabaseReader;
    const entries = yield* reader
      .table("journalEntries")
      .index(
        "by_owner_tenantId",
        (query) => query.eq("owner.tenantId", tenant._id),
        "desc"
      )
      .paginate(
        Struct.assign(paginationOpts, {
          numItems: Num.min(paginationOpts.numItems, PAGE_LIMIT),
        })
      )
      .pipe(Effect.orDie);
    const people = Arr.dedupe(
      Arr.flatMap(entries.page, (entry) =>
        Arr.appendAll(
          Actor.matchOrElse(
            entry.actor,
            { person: (actor) => [actor.id] },
            () => []
          ),
          ObjectRef.matchOrElse(
            entry.subject,
            { person: (subject) => [subject.id] },
            () => []
          )
        )
      )
    );
    const names = HashMap.fromIterable(
      Arr.zip(
        people,
        yield* Effect.forEach(people, (id) =>
          reader
            .table("tenantPeople")
            .get(id)
            .pipe(
              Effect.orDie,
              Effect.map((person) => person.name)
            )
        )
      )
    );
    const nameOf = Effect.fnUntraced(function* (id: (typeof people)[number]) {
      return yield* Effect.fromOption(HashMap.get(names, id)).pipe(
        Effect.orDie
      );
    });
    const page = yield* Effect.forEach(entries.page, (entry) =>
      Effect.all({
        actor: Actor.match(entry.actor, {
          person: (actor) =>
            Effect.map(nameOf(actor.id), (name) =>
              Struct.assign(actor, { name })
            ),
          system: (actor) => Effect.succeed(actor),
          user: (actor) => Effect.succeed({ kind: actor.kind }),
        }),
        subjectName: ObjectRef.matchOrElse(
          entry.subject,
          { person: (subject) => Effect.asSome(nameOf(subject.id)) },
          () => Effect.succeedNone
        ),
      }).pipe(
        Effect.map(({ actor, subjectName }) => ({
          actor,
          at: entry._creationTime,
          change: entry.change,
          id: entry._id,
          subject: entry.subject,
          subjectName,
        }))
      )
    );
    return Struct.assign(entries, { page });
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
