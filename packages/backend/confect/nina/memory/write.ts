import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { endOfDay } from "@repo/backend/confect/nina/memory/check";
import { findTarget, sameWords } from "@repo/backend/confect/nina/memory/match";
import {
  MEMORY_FIELD,
  type Opened,
  openWith,
} from "@repo/backend/confect/nina/memory/seal";
import {
  changedSince,
  lostMemory,
} from "@repo/backend/confect/nina/memory/seen";
import {
  deleteMemory,
  readMemories,
  readPaused,
} from "@repo/backend/confect/nina/memory/store";
import {
  MEMORY_LIMIT,
  type NinaMemoryCandidate,
  type NinaMemorySeen,
} from "@repo/backend/confect/nina/memory.spec";
import { ensureLearnerKeys } from "@repo/backend/confect/vault/keys";
import { sealText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Clock, Effect, HashSet, Option, Order } from "effect";

type MemoryId = Docs["ninaMemories"]["_id"];
type UserId = Docs["users"]["_id"];
type Candidate = typeof NinaMemoryCandidate.Type;
type Seen = typeof NinaMemorySeen.Type;
type LearnerKeys = Effect.Success<ReturnType<typeof ensureLearnerKeys>>;

/** The memory confirmed longest ago comes first. */
const oldestFirst = Order.mapInput(
  Order.Number,
  (memory: Opened) => memory.confirmedAt
);

/** The memory Nina wrote and confirmed longest ago, which leaves first at the limit. */
function oldestByNina(memories: readonly Opened[]) {
  return Arr.head(
    Arr.sort(
      Arr.filter(memories, (memory) => memory.author === "nina"),
      oldestFirst
    )
  );
}

/** The end of a situation's last day. Any other kind has none. */
function endOf(candidate: Candidate) {
  return candidate.kind === "situation"
    ? Option.fromUndefinedOr(candidate.until).pipe(Option.flatMap(endOfDay))
    : Option.none();
}

/**
 * Says a memory again: it was confirmed now. The candidate's words replace the
 * memory's, with Nina as their author, only when they say something new and
 * nobody changed the memory since the call read it. On the same terms the
 * memory takes the candidate's kind, which is how a memory the learner wrote
 * gets one, and a situation takes a new end date.
 */
const confirmMemory = Effect.fn("nina.memory.write.confirm")(function* ({
  candidate,
  changed,
  keys,
  memory,
  now,
  validUntil,
}: {
  readonly candidate: Candidate;
  readonly changed: boolean;
  readonly keys: LearnerKeys;
  readonly memory: Opened;
  readonly now: number;
  readonly validUntil: Option.Option<number>;
}) {
  const mayRewrite = !changed;
  const rewrites = mayRewrite && !sameWords(memory.text, candidate.text);
  yield* (yield* DatabaseWriter)
    .table("ninaMemories")
    .patch(memory._id, {
      confirmedAt: now,
      ...(rewrites
        ? {
            author: "nina" as const,
            text: yield* sealText(keys, MEMORY_FIELD, candidate.text),
          }
        : {}),
      // A memory the learner wrote has no kind until a chat says it again. One
      // that has a kind is only ever confirmed by that kind.
      ...(mayRewrite ? { kind: candidate.kind } : {}),
      ...(mayRewrite && Option.isSome(validUntil)
        ? { validUntil: validUntil.value }
        : {}),
    })
    .pipe(Effect.orDie);
});

/**
 * Writes a new memory for Nina. At the limit the memory Nina confirmed longest
 * ago leaves for it; when the learner wrote them all, nothing is written.
 */
const createMemory = Effect.fn("nina.memory.write.create")(function* ({
  candidate,
  keys,
  lesson,
  memories,
  now,
  userId,
  validUntil,
}: {
  readonly candidate: Candidate;
  readonly keys: LearnerKeys;
  readonly lesson: string | undefined;
  readonly memories: readonly Opened[];
  readonly now: number;
  readonly userId: UserId;
  readonly validUntil: Option.Option<number>;
}) {
  if (Arr.length(memories) >= MEMORY_LIMIT) {
    const oldest = oldestByNina(memories);
    if (Option.isNone(oldest)) {
      return Option.none();
    }
    yield* deleteMemory(oldest.value._id);
  }
  const id = yield* (yield* DatabaseWriter)
    .table("ninaMemories")
    .insert({
      author: "nina",
      confirmedAt: now,
      kind: candidate.kind,
      ...(lesson === undefined ? {} : { lesson }),
      text: yield* sealText(keys, MEMORY_FIELD, candidate.text),
      userId,
      ...(Option.isSome(validUntil) ? { validUntil: validUntil.value } : {}),
    })
    .pipe(Effect.orDie);
  return Option.some(id);
});

/**
 * Writes one candidate against the memories as they stand, which include what
 * the call wrote before it. It returns the memory it wrote or confirmed, or
 * nothing when it dropped the candidate.
 */
const writeCandidate = Effect.fn("nina.memory.write.candidate")(function* ({
  candidate,
  changedIds,
  keys,
  lesson,
  now,
  userId,
}: {
  readonly candidate: Candidate;
  readonly changedIds: HashSet.HashSet<MemoryId>;
  readonly keys: LearnerKeys;
  readonly lesson: string | undefined;
  readonly now: number;
  readonly userId: UserId;
}) {
  const validUntil = endOf(candidate);
  if (candidate.kind === "situation" && Option.isNone(validUntil)) {
    return Option.none();
  }
  const memories = yield* openWith(keys, yield* readMemories(userId));
  const target = findTarget(memories, candidate);
  if (Option.isNone(target)) {
    return yield* createMemory({
      candidate,
      keys,
      lesson,
      memories,
      now,
      userId,
      validUntil,
    });
  }
  yield* confirmMemory({
    candidate,
    changed: HashSet.has(changedIds, target.value._id),
    keys,
    memory: target.value,
    now,
    validUntil,
  });
  return Option.some(target.value._id);
});

/**
 * Writes what one capture call found the learner saying about themself, and
 * returns how many memories it wrote or confirmed, which it also stores in the
 * turn. A candidate that names a known memory, or says what a memory of its
 * kind (or a memory without a kind) already says, confirms that memory. Any
 * other candidate is a new memory. The model read the message some time ago, so
 * the write first checks what could have changed meanwhile: paused memory, a
 * deleted turn, or a memory the learner removed writes nothing, and a memory
 * changed since keeps its words, its kind and its end date.
 */
export const writeMemories = Effect.fn("nina.memory.write")(function* (args: {
  readonly candidates: readonly Candidate[];
  readonly lesson?: string | undefined;
  readonly seen: readonly Seen[];
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
  const current = yield* readMemories(args.userId);
  if (lostMemory(args.seen, current)) {
    return 0;
  }
  const changedIds = changedSince(args.seen, current);
  const now = yield* Clock.currentTimeMillis;
  const keys = yield* ensureLearnerKeys(args.userId);
  const written = yield* Effect.forEach(args.candidates, (candidate) =>
    writeCandidate({
      candidate,
      changedIds,
      keys,
      lesson: args.lesson,
      now,
      userId: args.userId,
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
