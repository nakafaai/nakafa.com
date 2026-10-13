import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { endOfDay } from "@repo/backend/confect/nina/memory/day";
import { syncKeys } from "@repo/backend/confect/nina/memory/keys";
import { sameWords } from "@repo/backend/confect/nina/memory/match";
import {
  MEMORY_FIELD,
  type Opened,
  openWith,
} from "@repo/backend/confect/nina/memory/seal";
import {
  isUnchanged,
  lostSeen,
  readNamed,
} from "@repo/backend/confect/nina/memory/seen";
import {
  confirmedAfterClear,
  readMemoryState,
} from "@repo/backend/confect/nina/memory/store";
import {
  MEMORY_TOPIC_LIMIT,
  type NinaMemoryCandidate,
  type NinaMemorySeen,
} from "@repo/backend/confect/nina/memory.spec";
import { requestPortrait } from "@repo/backend/confect/nina/portrait/store";
import { ensureLearnerKeys } from "@repo/backend/confect/vault/keys";
import { sealText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Clock, Effect, HashSet, Option } from "effect";

type UserId = Docs["users"]["_id"];
type Candidate = typeof NinaMemoryCandidate.Type;
type Seen = typeof NinaMemorySeen.Type;
type LearnerKeys = Effect.Success<ReturnType<typeof ensureLearnerKeys>>;

/**
 * Whether a memory can be of a candidate's kind: it is of that kind, or it has
 * none. Only a memory the learner wrote has none, and a chat that restates it
 * gives it one. A situation's end day never lands on a goal this way.
 */
function takesKind(memory: Pick<Opened, "kind">, kind: Candidate["kind"]) {
  return memory.kind === undefined || memory.kind === kind;
}

/**
 * Says a memory again: it was confirmed now. The candidate's words replace the
 * memory's only when Nina wrote the memory, they are not the same words in
 * another case, punctuation or spacing (`sameWords`), and nobody changed the
 * memory since the call read it. Words the learner wrote are never replaced. A
 * memory that nobody changed since takes the candidate's kind, which is how a
 * memory the learner wrote gets one, and a situation takes a new end date. The
 * memory is also linked to the topics of the open pages that it is not linked
 * to yet, up to `MEMORY_TOPIC_LIMIT`. Its keys follow in every case: they take
 * the new words and topics and the time of this confirmation, so a memory that
 * is said again stays among the first a lookup meets.
 */
const confirmMemory = Effect.fn("nina.memory.write.confirm")(function* ({
  candidate,
  changed,
  keys,
  memory,
  now,
  topics,
  validUntil,
}: {
  readonly candidate: Candidate;
  readonly changed: boolean;
  readonly keys: LearnerKeys;
  readonly memory: Opened;
  readonly now: number;
  readonly topics: readonly string[];
  readonly validUntil: Option.Option<number>;
}) {
  const mayRewrite = !changed;
  const rewrites =
    mayRewrite &&
    memory.author === "nina" &&
    !sameWords(memory.text, candidate.text);
  const linked = Arr.take(
    Arr.union(memory.topics ?? [], topics),
    MEMORY_TOPIC_LIMIT
  );
  const gains = Arr.length(linked) > Arr.length(memory.topics ?? []);
  yield* (yield* DatabaseWriter)
    .table("ninaMemories")
    .patch(memory._id, {
      confirmedAt: now,
      ...(rewrites
        ? { text: yield* sealText(keys, MEMORY_FIELD, candidate.text) }
        : {}),
      // A memory the learner wrote has no kind until a chat says it again. One
      // that has a kind is only ever confirmed by that kind.
      ...(mayRewrite ? { kind: candidate.kind } : {}),
      ...(mayRewrite && Option.isSome(validUntil)
        ? { validUntil: validUntil.value }
        : {}),
      ...(gains ? { topics: linked } : {}),
    })
    .pipe(Effect.orDie);
  yield* syncKeys(keys, memory._id, {
    confirmedAt: now,
    text: rewrites ? candidate.text : memory.text,
    title: memory.title,
    topics: linked,
  });
});

/** Writes a new memory for Nina, linked to the topics of the open pages, and its keys. */
const createMemory = Effect.fn("nina.memory.write.create")(function* ({
  candidate,
  keys,
  now,
  topics,
  validUntil,
}: {
  readonly candidate: Candidate;
  readonly keys: LearnerKeys;
  readonly now: number;
  readonly topics: readonly string[];
  readonly validUntil: Option.Option<number>;
}) {
  const id = yield* (yield* DatabaseWriter)
    .table("ninaMemories")
    .insert({
      author: "nina",
      confirmedAt: now,
      kind: candidate.kind,
      text: yield* sealText(keys, MEMORY_FIELD, candidate.text),
      ...(Arr.isReadonlyArrayNonEmpty(topics) ? { topics: [...topics] } : {}),
      userId: keys.userId,
      ...(Option.isSome(validUntil) ? { validUntil: validUntil.value } : {}),
    })
    .pipe(Effect.orDie);
  yield* syncKeys(keys, id, {
    confirmedAt: now,
    text: candidate.text,
    topics,
  });
  return id;
});

/**
 * The candidates a write keeps, in their order. Candidates that hold the same
 * words (`sameWords`), the same kind and the same name are one candidate, the
 * first, because a call that settles a memory settles it once.
 */
function distinct(candidates: readonly Candidate[]) {
  return Arr.dedupeWith(
    candidates,
    (first: Candidate, second: Candidate) =>
      first.kind === second.kind &&
      first.known === second.known &&
      sameWords(first.text, second.text)
  );
}

/**
 * Writes one candidate: it confirms the memory it names, when that memory is on
 * the list the call read and can take the candidate's kind, and otherwise
 * becomes a new memory of Nina's. The model decides which memory a candidate
 * restates, so no comparison of words looks for another one. The named memory
 * is read as it stands now, so it includes what the call wrote before this
 * candidate, and it is never a memory that "Delete all" took (confirmed at or
 * before `clearedAt`), which a confirmation would bring back. It returns the
 * memory it wrote or confirmed.
 */
const writeCandidate = Effect.fn("nina.memory.write.candidate")(function* ({
  candidate,
  clearedAt,
  keys,
  now,
  seen,
  topics,
}: {
  readonly candidate: Candidate;
  readonly clearedAt: number | undefined;
  readonly keys: LearnerKeys;
  readonly now: number;
  readonly seen: readonly Seen[];
  readonly topics: readonly string[];
}) {
  // A situation ends at the end of its last day, which its Schema says is a
  // real day (`NinaMemoryDay`). Any other kind has no end.
  const validUntil =
    candidate.kind === "situation" ? endOfDay(candidate.until) : Option.none();
  const named = yield* openWith(
    keys,
    Arr.fromOption(
      yield* readNamed(keys.userId, seen, candidate.known, clearedAt)
    )
  );
  const target = Arr.findFirst(named, (memory) =>
    takesKind(memory, candidate.kind)
  );
  if (Option.isNone(target)) {
    return yield* createMemory({ candidate, keys, now, topics, validUntil });
  }
  yield* confirmMemory({
    candidate,
    changed: !isUnchanged(seen, target.value),
    keys,
    memory: target.value,
    now,
    topics,
    validUntil,
  });
  return target.value._id;
});

/**
 * Writes what one capture call found the learner saying about themself, and
 * returns how many memories it wrote or confirmed, which it also stores in the
 * turn. A candidate that names a memory the call read (by its place on the
 * list the call gave the model) and that can take the candidate's kind
 * confirms that memory, and any other candidate is a new memory. The model
 * says which memory a candidate restates: no comparison of words finds one.
 * Candidates of one call that hold the same words, the same kind and the same
 * name are one candidate (`distinct`). The model read the message some time
 * ago, so the write first checks what could have changed meanwhile: paused
 * memory, a deleted turn, or a memory the learner removed or deleted with
 * "Delete all" writes nothing, and a memory changed since the call read it
 * keeps its words, its kind and its end date. It looks up the at most 12
 * memories the call read, so it touches a bounded number of documents whatever
 * the learner keeps (besides the one row of the learner's memory state it reads
 * first): a candidate reads at most one memory to find its target and touches
 * at most 419 to write it (the memory and at most 416 key rows read, deleted,
 * moved or inserted), so three candidates touch at most about 1,260. When it
 * wrote or confirmed a memory it also asks for a build of the learner's
 * portrait, which waits (`requestPortrait`): one row read and written, and one
 * job scheduled.
 */
export const writeMemories = Effect.fn("nina.memory.write")(function* (args: {
  readonly candidates: readonly Candidate[];
  readonly seen: readonly Seen[];
  readonly topics: readonly string[];
  readonly turnId: Docs["ninaTurns"]["_id"];
  readonly userId: UserId;
}) {
  const turn = yield* (yield* DatabaseReader)
    .table("ninaTurns")
    .get(args.turnId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  const { clearedAt, paused } = yield* readMemoryState(args.userId);
  if (!turn || paused) {
    return 0;
  }
  if (yield* lostSeen(args.userId, args.seen, clearedAt)) {
    return 0;
  }
  const now = confirmedAfterClear(yield* Clock.currentTimeMillis, clearedAt);
  const keys = yield* ensureLearnerKeys(args.userId);
  const written = yield* Effect.forEach(
    distinct(args.candidates),
    (candidate) =>
      writeCandidate({
        candidate,
        clearedAt,
        keys,
        now,
        seen: args.seen,
        topics: args.topics,
      })
  );
  const remembered = HashSet.size(HashSet.fromIterable(written));
  if (remembered > 0) {
    yield* (yield* DatabaseWriter)
      .table("ninaTurns")
      .patch(turn._id, { remembered })
      .pipe(Effect.orDie);
    yield* requestPortrait({ paused, reset: false, userId: args.userId });
  }
  return remembered;
}, Effect.orDie);
