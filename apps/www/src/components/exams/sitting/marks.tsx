import { Effect } from "effect";
import { createContext, type ReactNode, use, useState } from "react";
import { useStore } from "zustand";
import {
  createFlagStore,
  type FlagStore,
} from "@/components/exams/sitting/flags";
import { keepFlag, readKept } from "@/components/exams/sitting/keep";
import { sittingStorage } from "@/components/exams/sitting/storage";
import { reportClientException } from "@/lib/analytics/client";

const FlagStoreContext = createContext<ReturnType<
  typeof createFlagStore
> | null>(null);

/**
 * Gives one attempt's screen its flags. The store starts from the flags the browser kept, and each change
 * is written to the browser as the store shows it. A browser that refuses storage shows the flags for
 * this visit only, and the refusal is reported.
 */
export function SittingFlagProvider({
  attemptId,
  children,
  sittingId,
}: {
  readonly attemptId: string;
  readonly children: ReactNode;
  readonly sittingId: string;
}) {
  const [store] = useState(() =>
    createFlagStore({
      flagged: Effect.runSync(
        readKept(sittingId, attemptId).pipe(
          Effect.map((kept) => kept.flagged),
          Effect.provide(sittingStorage),
          Effect.catchTag("KeyValueStoreError", (error) =>
            reportClientException(error, {
              source: "components/exams/sitting/flags",
            }).pipe(Effect.as([]))
          )
        )
      ),
      keep: (questionId, flagged) => {
        Effect.runSync(
          keepFlag(sittingId, attemptId, questionId, flagged).pipe(
            Effect.provide(sittingStorage),
            Effect.catchTag("KeyValueStoreError", (error) =>
              reportClientException(error, {
                source: "components/exams/sitting/flags",
              })
            )
          )
        );
      },
    })
  );

  return <FlagStoreContext value={store}>{children}</FlagStoreContext>;
}

/** Reads one part of the flags of the attempt. It throws outside the attempt's provider. */
export function useFlags<Selected>(selector: (state: FlagStore) => Selected) {
  const store = use(FlagStoreContext);
  if (store === null) {
    throw new Error("useFlags must be used within SittingFlagProvider.");
  }
  return useStore(store, selector);
}
