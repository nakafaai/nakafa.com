import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  MEMORY_PROMPT_LIMIT,
  type NinaMemory,
  type NinaMemoryAuthor,
} from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, Order } from "effect";

type Choosable = Pick<
  typeof NinaMemory.Type,
  "author" | "confirmedAt" | "kind" | "lesson" | "validUntil"
>;

type Dated = Pick<Docs["ninaMemories"], "_creationTime" | "confirmedAt">;

/** How early Nina reads each author's memories: the learner's own words come first. */
const AUTHOR_RANK = { learner: 1, nina: 0 } satisfies Record<
  typeof NinaMemoryAuthor.Type,
  number
>;

/** Puts the most recently confirmed memory first, and the newer of two tied memories. */
export const newestFirst: Order.Order<Dated> = Order.combine(
  Order.flip(
    Order.mapInput(Order.Number, (memory: Dated) => memory.confirmedAt)
  ),
  Order.flip(
    Order.mapInput(Order.Number, (memory: Dated) => memory._creationTime)
  )
);

/** Whether a situation's end date has passed. Other memories never end. */
function hasEnded(memory: Choosable, now: number) {
  return (
    memory.kind === "situation" &&
    memory.validUntil !== undefined &&
    memory.validUntil < now
  );
}

/**
 * Puts first what Nina should read first: the learner's own words, then
 * memories about the open lesson, then the most recently confirmed.
 */
function priority(lesson: string | undefined): Order.Order<Choosable> {
  return Order.combineAll([
    Order.mapInput(
      Order.flip(Order.Number),
      (memory: Choosable) => AUTHOR_RANK[memory.author]
    ),
    Order.mapInput(Order.flip(Order.Number), (memory: Choosable) =>
      lesson !== undefined && memory.lesson === lesson ? 1 : 0
    ),
    Order.mapInput(
      Order.flip(Order.Number),
      (memory: Choosable) => memory.confirmedAt
    ),
  ]);
}

/**
 * Chooses the memories Nina reads in one turn: at most `MEMORY_PROMPT_LIMIT`,
 * after dropping the situations that have ended. Without a lesson, no memory
 * ranks above another for being about it.
 */
export function selectMemories<Memory extends Choosable>(
  memories: readonly Memory[],
  {
    lesson,
    now,
  }: { readonly lesson?: string | undefined; readonly now: number }
) {
  return Arr.take(
    Arr.sort(
      Arr.filter(memories, (memory) => !hasEnded(memory, now)),
      priority(lesson)
    ),
    MEMORY_PROMPT_LIMIT
  );
}
