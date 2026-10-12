import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { endOfDay } from "@repo/backend/confect/nina/memory/check";
import { syncKeys } from "@repo/backend/confect/nina/memory/keys";
import { findTarget, sameWords } from "@repo/backend/confect/nina/memory/match";
import {
  MEMORY_FIELD,
  type Opened,
  openWith,
} from "@repo/backend/confect/nina/memory/seal";
import { searchMemories } from "@repo/backend/confect/nina/memory/search";
import {
  isUnchanged,
  lostSeen,
  readNamed,
} from "@repo/backend/confect/nina/memory/seen";
import { readPaused } from "@repo/backend/confect/nina/memory/store";
import {
  MEMORY_TOPIC_LIMIT,
  type NinaMemoryCandidate,
  type NinaMemorySeen,
} from "@repo/backend/confect/nina/memory.spec";
import { ensureLearnerKeys } from "@repo/backend/confect/vault/keys";
import { sealText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Clock, Effect, HashSet, Option } from "effect";

type UserId = Docs["users"]["_id"];
type Candidate = typeof NinaMemoryCandidate.Type;
type Seen = typeof NinaMemorySeen.Type;
type LearnerKeys = Effect.Success<ReturnType<typeof ensureLearnerKeys>>;

/** Memories searched for the one a candidate says again, besides the one it names. */
const TARGET_LIMIT = 8;

/** The end of a situation's last day. Any other kind has none. */
function endOf(candidate: Candidate) {
  return candidate.kind === "situation"
    ? Option.fromUndefinedOr(candidate.until).pipe(Option.flatMap(endOfDay))
    : Option.none();
}

/**
 * Says a memory again: it was confirmed now. The candidate's words replace the
 * memory's only when Nina wrote the memory, they say something new, and nobody
 * changed the memory since the call read it. Words the learner wrote are never
 * replaced. A memory that nobody changed since takes the candidate's kind,
 * which is how a memory the learner wrote gets one, and a situation takes a new
 * end date. The memory is also linked to the topics of the open pages that it
 * is not linked to yet, up to `MEMORY_TOPIC_LIMIT`. Its keys follow in every
 * case: they take the new words and topics and the time of this confirmation,
 * so a memory that is said again stays among the first a lookup meets.
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
 * Writes one candidate against the memories it can say again: the one it names,
 * when the call read it, and the `TARGET_LIMIT` that match its words and the
 * open pages best. Both are read as they stand, so they include what the call
 * wrote before this candidate. It returns the memory it wrote or confirmed, or
 * nothing when it dropped the candidate.
 */
const writeCandidate = Effect.fn("nina.memory.write.candidate")(function* ({
  candidate,
  keys,
  now,
  seen,
  topics,
}: {
  readonly candidate: Candidate;
  readonly keys: LearnerKeys;
  readonly now: number;
  readonly seen: readonly Seen[];
  readonly topics: readonly string[];
}) {
  const validUntil = endOf(candidate);
  if (candidate.kind === "situation" && Option.isNone(validUntil)) {
    return Option.none();
  }
  const named = yield* openWith(
    keys,
    Arr.fromOption(yield* readNamed(keys.userId, seen, candidate.known))
  );
  const matches = yield* searchMemories({
    limit: TARGET_LIMIT,
    now,
    text: candidate.text,
    topics,
    userId: keys.userId,
  });
  // What the learner wrote is theirs: the target is such a memory only when the
  // candidate says the same. Otherwise the candidate confirms a memory that
  // says it, or becomes a memory of Nina's.
  const target = findTarget(Arr.appendAll(named, matches), candidate);
  if (Option.isNone(target)) {
    return Option.some(
      yield* createMemory({ candidate, keys, now, topics, validUntil })
    );
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
  return Option.some(target.value._id);
});

/**
 * Writes what one capture call found the learner saying about themself, and
 * returns how many memories it wrote or confirmed, which it also stores in the
 * turn. A candidate that names a memory the call read, or says what a memory of
 * its kind (or a memory without a kind) already says, confirms that memory. A
 * memory the learner wrote counts only when the candidate says the same as it,
 * so naming one that says something else confirms nothing by that name. Any
 * other candidate is a new memory. The model read the message some time ago, so
 * the write first checks what could have changed meanwhile: paused memory, a
 * deleted turn, or a memory the learner removed writes nothing, and a memory
 * changed since the call read it, or one the call never read, keeps its words,
 * its kind and its end date. It looks up the at most 12 memories the call read
 * and searches for the others, so it touches a bounded number of documents
 * whatever the learner keeps: a candidate reads at most 411 to find its target
 * (the one it names and a search of 410) and touches at most 419 to write it
 * (the memory and at most 416 key rows read, deleted, moved or inserted), so
 * three candidates touch at most about 2,500.
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
  if (!turn || (yield* readPaused(args.userId))) {
    return 0;
  }
  if (yield* lostSeen(args.userId, args.seen)) {
    return 0;
  }
  const now = yield* Clock.currentTimeMillis;
  const keys = yield* ensureLearnerKeys(args.userId);
  const written = yield* Effect.forEach(args.candidates, (candidate) =>
    writeCandidate({
      candidate,
      keys,
      now,
      seen: args.seen,
      topics: args.topics,
    })
  );
  const remembered = HashSet.size(HashSet.fromIterable(Arr.getSomes(written)));
  if (remembered > 0) {
    yield* (yield* DatabaseWriter)
      .table("ninaTurns")
      .patch(turn._id, { remembered })
      .pipe(Effect.orDie);
  }
  return remembered;
}, Effect.orDie);
