"use client";

import { useMediaQuery } from "@mantine/hooks";
import {
  ResizablePanel,
  ResizablePanelGroup,
  useResizableDefaultLayout,
} from "@repo/design-system/components/ui/resizable";
import type { ReactNode } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { SCHOOL_CLASSES_DETAIL_PANEL_BREAKPOINT } from "@/components/school/classes/detail-panel";

interface SchoolClassesWorkspaceModeContextValue {
  isCompact: boolean;
}

export const SCHOOL_CLASSES_WORKSPACE_DETAIL_PANEL_ID = "detail";
const SCHOOL_CLASSES_WORKSPACE_MAIN_PANEL_ID = "content";
const SCHOOL_CLASSES_WORKSPACE_MAIN_PANEL_MIN_SIZE = "36rem";
const SCHOOL_CLASSES_WORKSPACE_PANEL_GROUP_ID = "school-classes-workspace";
const SCHOOL_CLASSES_WORKSPACE_RESIZE_TARGET_MINIMUM_SIZE = {
  coarse: 28,
  fine: 12,
} as const;
const SCHOOL_CLASSES_WORKSPACE_LAYOUT_STORAGE = {
  getItem(key: string) {
    if (typeof window === "undefined") {
      return null;
    }

    return window.localStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(key, value);
  },
} as const;
const SchoolClassesWorkspaceModeContext =
  createContext<SchoolClassesWorkspaceModeContextValue | null>(null);

/** Read whether the class workspace is currently in compact mode. */
export function useSchoolClassesWorkspaceIsCompact() {
  const context = useContextSelector(
    SchoolClassesWorkspaceModeContext,
    (value) => value
  );

  if (!context) {
    throw new Error(
      "SchoolClassesWorkspaceShell context not found. Wrap panel content inside the class workspace shell."
    );
  }

  return context.isCompact;
}

/**
 * Render the class workspace with an optional detail panel beside the main
 * class application surface.
 */
export function SchoolClassesWorkspaceShell({
  children,
  panel,
}: {
  children: ReactNode;
  panel: ReactNode;
}) {
  const isCompact = useMediaQuery(
    `(max-width: ${SCHOOL_CLASSES_DETAIL_PANEL_BREAKPOINT - 1}px)`
  );

  if (isCompact) {
    return (
      <SchoolClassesWorkspaceModeContext.Provider
        key="compact"
        value={{ isCompact: true }}
      >
        <div className="flex min-w-0 flex-col">
          {children}
          {panel}
        </div>
      </SchoolClassesWorkspaceModeContext.Provider>
    );
  }

  return (
    <SchoolClassesWorkspaceModeContext.Provider
      key="desktop"
      value={{ isCompact: false }}
    >
      <SchoolClassesResizableWorkspaceShell panel={panel}>
        {children}
      </SchoolClassesResizableWorkspaceShell>
    </SchoolClassesWorkspaceModeContext.Provider>
  );
}

/** Render the desktop class workspace with a persisted resizable detail panel. */
function SchoolClassesResizableWorkspaceShell({
  children,
  panel,
}: {
  children: ReactNode;
  panel: ReactNode;
}) {
  const { defaultLayout, onLayoutChanged } = useResizableDefaultLayout({
    id: SCHOOL_CLASSES_WORKSPACE_PANEL_GROUP_ID,
    panelIds: [
      SCHOOL_CLASSES_WORKSPACE_MAIN_PANEL_ID,
      SCHOOL_CLASSES_WORKSPACE_DETAIL_PANEL_ID,
    ],
    storage: SCHOOL_CLASSES_WORKSPACE_LAYOUT_STORAGE,
  });

  return (
    <ResizablePanelGroup
      className="min-w-0"
      defaultLayout={defaultLayout}
      id={SCHOOL_CLASSES_WORKSPACE_PANEL_GROUP_ID}
      onLayoutChanged={onLayoutChanged}
      orientation="horizontal"
      resizeTargetMinimumSize={
        SCHOOL_CLASSES_WORKSPACE_RESIZE_TARGET_MINIMUM_SIZE
      }
    >
      <ResizablePanel
        className="min-w-0"
        id={SCHOOL_CLASSES_WORKSPACE_MAIN_PANEL_ID}
        minSize={SCHOOL_CLASSES_WORKSPACE_MAIN_PANEL_MIN_SIZE}
      >
        <div className="min-w-0">{children}</div>
      </ResizablePanel>

      {panel}
    </ResizablePanelGroup>
  );
}
