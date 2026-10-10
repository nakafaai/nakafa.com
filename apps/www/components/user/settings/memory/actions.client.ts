"use client";

import { useMutation } from "@confect/react";
import type * as OptimisticLocalStore from "@confect/react/OptimisticLocalStore";
import nina from "@repo/backend/confect/_generated/refs/nina";
import {
  MEMORY_LIMIT,
  NinaMemoryRejected,
} from "@repo/backend/confect/nina/memory.spec";
import { randomUuid } from "@repo/utilities/uuid";
import {
  DateTime,
  Duration,
  Effect,
  Option,
  type Result,
  Schema,
} from "effect";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  addMemory,
  clearMemories,
  editMemory,
  learnerMemory,
  type Memory,
  type MemoryDraft,
  type MemoryList,
  pauseMemories,
  pendingId,
  removeMemory,
} from "@/components/user/settings/memory/list";
import { useMemoryPage } from "@/components/user/settings/memory/provider";
import { reportClientException } from "@/lib/analytics/client";

/** How long a removed memory can still be brought back. */
const UNDO = Duration.seconds(5);

/**
 * Tells the learner a change failed, in the words that fit: `limit` when they
 * already keep as many memories as the page allows, `missing` when the memory
 * was deleted somewhere else, and `other` for anything else. A refusal the
 * server explains is a normal answer; only a failure nobody expected goes to
 * analytics.
 */
const fail = Effect.fn("memory.fail")(function* (
  error: unknown,
  messages: Record<"limit" | "missing" | "other", string>
) {
  if (Schema.is(NinaMemoryRejected)(error)) {
    const message =
      error.reason === "limit" ? messages.limit : messages.missing;

    yield* Effect.sync(() => {
      toast.error(message);
    });
    return;
  }

  yield* reportClientException(error, {
    source: "components/user/settings/memory",
  });
  yield* Effect.sync(() => {
    toast.error(messages.other);
  });
});

/**
 * Applies one change to the page the browser holds, when it holds one. Convex
 * runs this again until the server answers, then drops it, so a change that
 * fails rolls back by itself.
 */
function patch(
  store: OptimisticLocalStore.OptimisticLocalStore,
  change: (list: MemoryList) => MemoryList
) {
  const cached = store.getQuery(nina.memory.list, {});

  if (Option.isSome(cached) && cached.value !== null) {
    store.setQuery(nina.memory.list, {}, Option.some(change(cached.value)));
  }
}

/**
 * The changes the learner makes on the Memory page. Each one shows at once,
 * and a failure shows a toast while the page rolls back.
 */
export function useMemoryActions() {
  const t = useTranslations("Memory");
  const other = useTranslations("Common")("action-error");
  const hide = useMemoryPage((state) => state.hide);
  const restore = useMemoryPage((state) => state.restore);
  const addDraft = useMutation(nina.memory.add);
  const editDraft = useMutation(nina.memory.edit);
  const removeById = useMutation(nina.memory.remove).withOptimisticUpdate(
    (store, { id }) => patch(store, (list) => removeMemory(list, id))
  );
  const pauseTo = useMutation(nina.memory.pause).withOptimisticUpdate(
    (store, { paused }) => patch(store, (list) => pauseMemories(list, paused))
  );
  const clearAll = useMutation(nina.memory.clear).withOptimisticUpdate(
    (store) => patch(store, clearMemories)
  );
  const messages = {
    limit: t("limit", { count: MEMORY_LIMIT }),
    missing: t("missing"),
    other,
  };

  /** Sends one change from an event, and tells the learner when it fails. */
  function settle<A, E>(send: () => Promise<Result.Result<A, E>>) {
    Effect.runFork(
      Effect.tryPromise(send).pipe(
        Effect.flatMap(Effect.fromResult),
        Effect.matchEffect({
          onFailure: (error) => fail(error, messages),
          onSuccess: () => Effect.void,
        })
      )
    );
  }

  /** Writes a new memory in the learner's own words. */
  function add(draft: MemoryDraft) {
    const now = DateTime.toEpochMillis(DateTime.nowUnsafe());
    const memory = learnerMemory(
      draft,
      pendingId(Effect.runSync(randomUuid)),
      now
    );

    settle(() =>
      addDraft.withOptimisticUpdate((store) =>
        patch(store, (list) => addMemory(list, memory))
      )(draft)
    );
  }

  /** Rewrites one memory in the learner's own words. */
  function edit(draft: MemoryDraft & Pick<Memory, "id">) {
    const now = DateTime.toEpochMillis(DateTime.nowUnsafe());

    settle(() =>
      editDraft.withOptimisticUpdate((store, args) =>
        patch(store, (list) => editMemory(list, args, now))
      )(draft)
    );
  }

  /**
   * Hides a memory at once and offers an Undo. The memory is deleted when the
   * toast closes without one.
   */
  function remove(memory: Memory) {
    hide(memory.id);

    /** Deletes the memory, unless an Undo brought it back or it is gone. */
    const claim = () => {
      if (restore(memory.id)) {
        settle(() => removeById({ id: memory.id }));
      }
    };

    toast(t("deleted"), {
      action: {
        label: t("undo"),
        onClick: () => {
          restore(memory.id);
        },
      },
      duration: Duration.toMillis(UNDO),
      onAutoClose: claim,
      onDismiss: claim,
    });
  }

  /** Pauses memory, or resumes it. Nothing is deleted either way. */
  function pause(paused: boolean) {
    settle(() => pauseTo({ paused }));
  }

  /** Deletes every memory. */
  function clear() {
    settle(() => clearAll());
  }

  return { add, clear, edit, pause, remove };
}
