import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { endOfDay } from "@repo/backend/confect/nina/memory/check";
import { saysSame } from "@repo/backend/confect/nina/memory/match";
import { MEMORY_FIELD, openWith } from "@repo/backend/confect/nina/memory/seal";
import {
  addSource,
  deleteMemory,
  readMemories,
  readPaused,
} from "@repo/backend/confect/nina/memory/store";
import {
  MEMORY_LIMIT,
  type NinaMemoryCandidate,
} from "@repo/backend/confect/nina/memory.spec";
import { ensureLearnerKeys } from "@repo/backend/confect/vault/keys";
import { sealText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Clock, Effect, HashSet, Option, Order } from "effect";

type ChatId = Docs["chats"]["_id"];
type UserId = Docs["users"]["_id"];
type Candidate = typeof NinaMemoryCandidate.Type;
type Opened = Effect.Success<ReturnType<typeof openWith>>[number];
type LearnerKeys = Effect.Success<ReturnType<typeof ensureLearnerKeys>>;

/** The memory confirmed longest ago comes first. */
const oldestFirst = Order.mapInput(
  Order.Number,
  (memory: Opened) => memory.confirmedAt
);

/**
 * The memory a candidate confirms: the known memory it names, or else the first
 * memory of its kind that says the same. A known memory of another kind does not
 * count, so a situation's date never lands on a goal.
 */
function findTarget(memories: readonly Opened[], candidate: Candidate) {
  return Arr.findFirst(
    memories,
    (memory) => memory._id === candidate.known && memory.kind === candidate.kind
  ).pipe(
    Option.orElse(() =>
      Arr.findFirst(
        memories,
        (memory) =>
          memory.kind === candidate.kind &&
          saysSame(memory.text, candidate.text)
      )
    )
  );
}

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
 * Says a memory again: it was confirmed now, its words are replaced when they
 * differ, and a situation takes the new end date. The learner keeps authorship
 * of words they wrote. The chat becomes one more source.
 */
const confirmMemory = Effect.fn("nina.memory.write.confirm")(function* ({
  candidate,
  chatId,
  keys,
  memory,
  now,
  validUntil,
}: {
  readonly candidate: Candidate;
  readonly chatId: ChatId;
  readonly keys: LearnerKeys;
  readonly memory: Opened;
  readonly now: number;
  readonly validUntil: Option.Option<number>;
}) {
  yield* (yield* DatabaseWriter)
    .table("ninaMemories")
    .patch(memory._id, {
      confirmedAt: now,
      ...(memory.text === candidate.text
        ? {}
        : { text: yield* sealText(keys, MEMORY_FIELD, candidate.text) }),
      ...(Option.isSome(validUntil) ? { validUntil: validUntil.value } : {}),
    })
    .pipe(Effect.orDie);
  yield* addSource({ id: memory._id, userId: memory.userId }, chatId);
});

/**
 * Writes a new memory for Nina, with the chat as its source. At the limit the
 * memory Nina confirmed longest ago leaves for it; when the learner wrote them
 * all, nothing is written.
 */
const createMemory = Effect.fn("nina.memory.write.create")(function* ({
  candidate,
  chatId,
  keys,
  lesson,
  memories,
  now,
  userId,
  validUntil,
}: {
  readonly candidate: Candidate;
  readonly chatId: ChatId;
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
  yield* addSource({ id, userId }, chatId);
  return Option.some(id);
});

/**
 * Writes one candidate against the memories as they stand, which include what
 * the call wrote before it. It returns the memory it wrote or confirmed, or
 * nothing when it dropped the candidate.
 */
const writeCandidate = Effect.fn("nina.memory.write.candidate")(function* ({
  candidate,
  chatId,
  keys,
  lesson,
  now,
  userId,
}: {
  readonly candidate: Candidate;
  readonly chatId: ChatId;
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
      chatId,
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
    chatId,
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
 * kind already says, confirms that memory. Any other candidate is a new memory.
 * Paused memory, a deleted chat, or a deleted turn writes nothing.
 */
export const writeMemories = Effect.fn("nina.memory.write")(function* (args: {
  readonly candidates: readonly Candidate[];
  readonly chatId: ChatId;
  readonly lesson?: string | undefined;
  readonly turnId: Docs["ninaTurns"]["_id"];
  readonly userId: UserId;
}) {
  const reader = yield* DatabaseReader;
  const chat = yield* reader
    .table("chats")
    .get(args.chatId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  const turn = yield* reader
    .table("ninaTurns")
    .get(args.turnId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (!(chat && turn) || (yield* readPaused(args.userId))) {
    return 0;
  }
  const now = yield* Clock.currentTimeMillis;
  const keys = yield* ensureLearnerKeys(args.userId);
  const written = yield* Effect.forEach(args.candidates, (candidate) =>
    writeCandidate({
      candidate,
      chatId: args.chatId,
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
