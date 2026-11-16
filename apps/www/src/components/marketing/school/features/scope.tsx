import { useRequired } from "@repo/design-system/hooks/required";
import { createContext, type ReactNode, useState } from "react";
import { type StoreApi, useStore } from "zustand";
import {
  createRoomStore,
  type RoomState,
} from "@/components/marketing/school/features/room";

/** The store of the demo forum, which its part provides. */
const RoomContext = createContext<StoreApi<RoomState> | null>(null);

/** The store of the demo forum, made once for the part, which its list, its chat and its composer share. */
export function RoomProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createRoomStore);

  return <RoomContext value={store}>{children}</RoomContext>;
}

/** Reads one part of the demo forum's state. */
export function useRoom<T>(selector: (state: RoomState) => T) {
  const store = useRequired(RoomContext, "useRoom");
  return useStore(store, selector);
}
