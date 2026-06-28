import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useLayoutEffect,
  useRef,
} from "react";
import {
  type ConversationPendingPlacement,
  getConversationRestorePlacement,
} from "@/components/school/classes/forum/conversation/data/scroll/restore";
import type { RestoreState } from "@/components/school/classes/forum/conversation/hooks/restore/use-state";

export interface TranscriptPlacementState {
  pendingPlacementRef: RefObject<ConversationPendingPlacement | null>;
  pendingScrollOffsetRef: RefObject<number | null>;
  setPendingPlacement: (placement: ConversationPendingPlacement | null) => void;
}

/** Owns pending transcript placement and initial restore placement refs. */
export function usePlacement({
  restoreState,
  setRestoreState,
}: {
  restoreState: RestoreState;
  setRestoreState: Dispatch<SetStateAction<RestoreState>>;
}) {
  const pendingPlacementRef = useRef<ConversationPendingPlacement | null>(null);
  const pendingScrollOffsetRef = useRef<number | null>(null);

  const setPendingPlacement = useCallback(
    (placement: ConversationPendingPlacement | null) => {
      pendingPlacementRef.current = placement;
      const isPendingLatestPlacement = placement?.view.kind === "bottom";

      setRestoreState((current) => {
        if (current.isPendingLatestPlacement === isPendingLatestPlacement) {
          return current;
        }

        return {
          ...current,
          isPendingLatestPlacement,
        };
      });
    },
    [setRestoreState]
  );

  useLayoutEffect(() => {
    const restorePlacement = getConversationRestorePlacement(
      restoreState.target
    );

    if (restorePlacement.kind === "none") {
      return;
    }

    if (restorePlacement.kind === "offset") {
      pendingScrollOffsetRef.current = restorePlacement.offset;
      return;
    }

    setPendingPlacement(restorePlacement.placement);
  }, [restoreState.target, setPendingPlacement]);

  return {
    pendingPlacementRef,
    pendingScrollOffsetRef,
    setPendingPlacement,
  } satisfies TranscriptPlacementState;
}
