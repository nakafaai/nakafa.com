"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { createContext, type ReactNode, use, useRef, useState } from "react";

interface Controls {
  acknowledgeUnreadCue: () => void;
  goToLatest: () => void;
  goToPost: (postId: Id<"schoolClassForumPosts">) => void;
}

interface ControlsContextValue extends Controls {
  registerControls: (controls: Controls) => void;
}

const noopControls: Controls = {
  acknowledgeUnreadCue: () => undefined,
  goToLatest: () => undefined,
  goToPost: () => undefined,
};

const ControlsContext = createContext<ControlsContextValue | null>(null);

/** Provides stable transcript control callbacks without prop drilling. */
export function ControlsProvider({ children }: { children: ReactNode }) {
  const controlsRef = useRef<Controls>(noopControls);
  const [value] = useState<ControlsContextValue>(() => ({
    acknowledgeUnreadCue: () => controlsRef.current.acknowledgeUnreadCue(),
    goToLatest: () => controlsRef.current.goToLatest(),
    goToPost: (postId: Parameters<Controls["goToPost"]>[0]) =>
      controlsRef.current.goToPost(postId),
    registerControls: (controls) => {
      controlsRef.current = controls;
    },
  }));

  return (
    <ControlsContext.Provider value={value}>
      {children}
    </ControlsContext.Provider>
  );
}

/** Reads the shared transcript controls for jump, latest, and back actions. */
export function useControls() {
  const value = use(ControlsContext);

  if (!value) {
    throw new Error("useControls must be used within a ConversationProvider");
  }

  return value;
}
