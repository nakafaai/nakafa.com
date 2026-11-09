"use client";

import { useMutation } from "@confect/react";
import island from "@repo/backend/confect/_generated/refs/island";
import { BUILD_BATCH } from "@repo/backend/confect/island/mutations.spec";
import { useRouter } from "@tanstack/react-router";
import { Array as Arr, DateTime, Effect, Result } from "effect";
import { use } from "react";
import { type GameStoreApi, GameStoreContext } from "@/components/island/store";

/** How long the learner's building rests before its edits go to the server. */
const QUIET = 600;

/** How many waiting edits send a batch at once, without waiting for quiet. */
const EAGER = 32;

/**
 * Keeps the server's copy of the island in step with the game (ADR 0047, D6):
 * it opens the island in the learner's zone as they enter, and sends the edits
 * they make in batches, each built on the version the last one returned. The
 * world changes at once in the browser; a refused batch is taken back, and
 * edits another device made first reload the island.
 */
export function IslandSync() {
  const store = use(GameStoreContext);
  const build = useMutation(island.mutations.build);
  const open = useMutation(island.mutations.open);
  const router = useRouter();
  if (store === null) {
    throw new Error("IslandSync must be used within the island game");
  }
  return (
    <span
      hidden
      ref={(node) => {
        if (node === null) {
          return;
        }
        Effect.runFork(
          Effect.tryPromise(() => open({ timeZone: DateTime.zoneMakeLocal() }))
        );
        return startSync(store, build, () => router.invalidate());
      }}
    />
  );
}

/** Sends the store's waiting edits until the returned cleanup stops it. */
function startSync(
  store: GameStoreApi,
  build: ReturnType<typeof useMutation<typeof island.mutations.build>>,
  reload: () => void
) {
  let sending = false;
  let timer = 0;

  const send = () => {
    const { pending, version } = store.getState();
    if (sending || pending.length === 0) {
      return;
    }
    sending = true;
    const batch = Arr.take(pending, BUILD_BATCH);
    Effect.runFork(
      Effect.tryPromise(() =>
        build({
          edits: Arr.map(batch, ({ after, x, y, z }) => ({
            block: after,
            x,
            y,
            z,
          })),
          version,
        })
      ).pipe(
        Effect.map((result) =>
          Result.match(result, {
            onFailure: (error) => {
              store.getState().rollback();
              store
                .getState()
                .setNotice(error._tag === "IslandStale" ? "stale" : "refused");
              if (error._tag === "IslandStale") {
                reload();
              }
            },
            onSuccess: (built) => {
              store.getState().settle(batch.length, built.version);
            },
          })
        ),
        Effect.catch(() =>
          Effect.sync(() => {
            store.getState().rollback();
            store.getState().setNotice("refused");
          })
        ),
        Effect.ensuring(
          Effect.sync(() => {
            sending = false;
            if (store.getState().pending.length > 0) {
              window.clearTimeout(timer);
              timer = window.setTimeout(send, QUIET);
            }
          })
        )
      )
    );
  };

  const unsubscribe = store.subscribe((state, previous) => {
    if (state.pending.length <= previous.pending.length) {
      return;
    }
    window.clearTimeout(timer);
    if (state.pending.length >= EAGER) {
      send();
      return;
    }
    timer = window.setTimeout(send, QUIET);
  });

  return () => {
    unsubscribe();
    window.clearTimeout(timer);
    send();
  };
}
