"use client";

import { useMutation } from "@confect/react";
import island from "@repo/backend/confect/_generated/refs/island";
import { CHANGE_BATCH } from "@repo/backend/confect/island/mutations.spec";
import { useRequired } from "@repo/design-system/hooks/required";
import { Array as Arr, DateTime, Effect, Option, Result } from "effect";
import { IslandRegions } from "@/components/island/regions";
import type { GameStoreApi } from "@/components/island/store";
import { GameStoreContext, useGame } from "@/components/island/store";

/** How long the learner's building rests before its operations go to the server. */
const QUIET = 800;

/** How long a batch the network dropped waits before it is sent again. */
const RETRY = 4000;

/**
 * Keeps the server's copy of the world in step with the game (ADR 0050, W3
 * and W4): it opens the world in the learner's zone as they enter, reads the
 * stored chunks of each region the camera nears, once, and sends the
 * operations the learner makes in batches. The world changes at once in the
 * browser and is never taken back by a reload: an operation the server
 * refuses is told in a line, and its region is read again so the world shows
 * what the server holds.
 */
export function IslandSync() {
  const store = useRequired(GameStoreContext, "IslandSync");
  const change = useMutation(island.mutations.change);
  const open = useMutation(island.mutations.open);
  const wanted = useGame((state) => state.wanted);
  const loaded = useGame((state) => state.loaded);
  const username = useGame((state) => state.host?.username ?? null);
  const land = useGame((state) => state.land);
  const arrive = useGame((state) => state.arrive);
  return (
    <>
      <span
        hidden
        ref={(node) => {
          if (node === null || store.getState().host !== null) {
            return;
          }
          Effect.runFork(
            Effect.tryPromise(() =>
              open({ timeZone: DateTime.zoneMakeLocal() })
            ).pipe(
              Effect.map((result) =>
                Result.map(result, (opened) => {
                  store.getState().setEntered(opened.entered);
                  if (opened.entered === null) {
                    store.getState().welcome();
                  }
                })
              ),
              Effect.ignore
            )
          );
          return startSync(store, change);
        }}
      />
      <IslandRegions
        land={land}
        loaded={loaded}
        onArrive={arrive}
        username={username}
        wanted={wanted}
      />
    </>
  );
}

/** Sends the store's waiting operations until the returned cleanup stops it. */
function startSync(
  store: GameStoreApi,
  change: ReturnType<typeof useMutation<typeof island.mutations.change>>
) {
  let sending = false;
  let timer = 0;

  const later = (wait: number) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(send, wait);
  };

  const send = () => {
    const { pending } = store.getState();
    if (sending || pending.length === 0) {
      return;
    }
    sending = true;
    const batch = Arr.take(pending, CHANGE_BATCH);
    Effect.runFork(
      Effect.tryPromise(() => change({ ops: batch })).pipe(
        Effect.map((result) =>
          Result.match(result, {
            // The server refused the learner, whose session ended: the batch stays queued and nothing is sent again by itself, since the page sends them to sign-in.
            onFailure: () => {
              store.getState().setNotice("refused");
              return Option.none<number>();
            },
            onSuccess: (outcomes) => {
              store.getState().settle(batch.length);
              if (Arr.some(outcomes, (outcome) => outcome !== "done")) {
                store
                  .getState()
                  .setNotice(
                    Arr.contains(outcomes, "full") ? "full" : "refused"
                  );
              }
              return Option.some(QUIET);
            },
          })
        ),
        // The network dropped the batch: it stays queued and goes again after a rest.
        Effect.orElseSucceed(() => Option.some(RETRY)),
        Effect.tap((wait) =>
          Effect.sync(() => {
            sending = false;
            if (Option.isSome(wait) && store.getState().pending.length > 0) {
              later(wait.value);
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
    if (state.pending.length >= CHANGE_BATCH) {
      send();
      return;
    }
    later(QUIET);
  });

  return () => {
    unsubscribe();
    window.clearTimeout(timer);
    send();
  };
}
