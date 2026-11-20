import { useRequired } from "@repo/design-system/hooks/required";
import type { ReactNode } from "react";
import { createContext, useState } from "react";
import type { StoreApi } from "zustand";
import { useStore } from "zustand";
import type { RoomState } from "@/components/marketing/school/features/room";
import { createRoomStore } from "@/components/marketing/school/features/room";

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
