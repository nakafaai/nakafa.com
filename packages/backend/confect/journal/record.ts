import type { GenericId } from "@confect/core";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import type {
  ChangeOf,
  ResourceKind,
  SubjectOf,
} from "@repo/backend/confect/access/catalog";
import { registry } from "@repo/backend/confect/access/registry";
import type { Actor } from "@repo/backend/confect/journal/schema";
import { Effect } from "effect";

/**
 * Records one audited change in the caller's transaction, so a failed or
 * retried mutation leaves no entry. The subject is the loaded row, usually
 * the one the kind's access middleware provided; the entry's reference and
 * owner come from the kind's authority, never from the caller, so an entry is
 * filed only under its subject's space. One insert and no reads, so
 * concurrent mutations never conflict here.
 */
export const record = Effect.fn("journal.record")(function* <
  K extends ResourceKind,
>(entry: {
  readonly actor: Actor;
  readonly change: ChangeOf<K>;
  readonly subject: { readonly kind: K; readonly row: SubjectOf<K> };
}): Effect.fn.Return<
  GenericId.GenericId<"journalEntries">,
  never,
  DatabaseWriter
> {
  const authority = registry[entry.subject.kind];
  return yield* (yield* DatabaseWriter)
    .table("journalEntries")
    .insert({
      actor: entry.actor,
      change: entry.change,
      owner: {
        kind: "tenant",
        tenantId: authority.tenantOf(entry.subject.row),
      },
      subject: authority.ref(entry.subject.row),
    })
    .pipe(Effect.orDie);
});
