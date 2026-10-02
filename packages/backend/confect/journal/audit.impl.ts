import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import spec from "@repo/backend/confect/journal/audit.spec";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer } from "effect";

/** The largest page one request reads. */
const PAGE_LIMIT = 100;

/**
 * The member's tenant entries, newest first. Persons named as actors or
 * subjects are read once per page each.
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
      .paginate({
        ...paginationOpts,
        numItems: Math.min(paginationOpts.numItems, PAGE_LIMIT),
      })
      .pipe(Effect.orDie);
    const names = new Map<GenericId.GenericId<"tenantPeople">, string>();
    const nameOf = Effect.fnUntraced(function* (
      id: GenericId.GenericId<"tenantPeople">
    ) {
      const name =
        names.get(id) ??
        (yield* reader
          .table("tenantPeople")
          .get(id)
          .pipe(
            Effect.orDie,
            Effect.map((person) => person.name)
          ));
      names.set(id, name);
      return name;
    });
    const page = yield* Effect.forEach(entries.page, (entry) =>
      Effect.gen(function* () {
        const actor =
          entry.actor.kind === "person"
            ? { ...entry.actor, name: yield* nameOf(entry.actor.id) }
            : { kind: entry.actor.kind };
        return {
          actor,
          at: entry._creationTime,
          change: entry.change,
          id: entry._id,
          subject: entry.subject,
          subjectName:
            entry.subject.kind === "person"
              ? yield* nameOf(entry.subject.id)
              : null,
        };
      })
    );
    return { ...entries, page };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
