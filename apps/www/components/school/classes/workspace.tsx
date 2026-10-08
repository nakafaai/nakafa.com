"use client";

import { useMediaQuery, useMounted } from "@mantine/hooks";
import {
  ResizablePanel,
  ResizablePanelGroup,
  useResizableDefaultLayout,
} from "@repo/design-system/components/ui/resizable";
import { createContext, type ReactNode, use } from "react";
import { SCHOOL_CLASSES_DETAIL_PANEL_BREAKPOINT } from "@/components/school/classes/detail";

export const SCHOOL_CLASSES_WORKSPACE_DETAIL_PANEL_ID = "detail";
const SCHOOL_CLASSES_WORKSPACE_MAIN_PANEL_ID = "content";
const SCHOOL_CLASSES_WORKSPACE_MAIN_PANEL_MIN_SIZE = "36rem";
const SCHOOL_CLASSES_WORKSPACE_PANEL_GROUP_ID = "school-classes-workspace-v2";
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
const SCHOOL_CLASSES_WORKSPACE_EMPTY_LAYOUT_STORAGE = {
  getItem() {
    return null;
  },
  setItem() {
    // Ignore layout writes until the client has mounted.
  },
} as const;
const COMPACT_WORKSPACE_MODE = { isCompact: true };
const DESKTOP_WORKSPACE_MODE = { isCompact: false };
type SchoolClassesWorkspaceModeContextValue = typeof COMPACT_WORKSPACE_MODE;
const SchoolClassesWorkspaceModeContext =
  createContext<SchoolClassesWorkspaceModeContextValue | null>(null);

/** Read whether the class workspace is currently in compact mode. */
export function useSchoolClassesWorkspaceIsCompact() {
  const mode = use(SchoolClassesWorkspaceModeContext);

  if (!mode) {
    throw new Error(
      "SchoolClassesWorkspaceShell context not found. Wrap panel content inside the class workspace shell."
    );
  }

  return mode.isCompact;
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
  const hasPanel = panel !== null;

  if (isCompact) {
    return (
      <SchoolClassesWorkspaceModeContext
        key="compact"
        value={COMPACT_WORKSPACE_MODE}
      >
        <div className="flex min-w-0 flex-col">
          {children}
          {panel}
        </div>
      </SchoolClassesWorkspaceModeContext>
    );
  }

  if (!hasPanel) {
    /*
     * `react-resizable-panels` expects the mounted Panel set to match the ids
     * used for saved layouts. The class workspace panel route is optional, so
     * the desktop shell should only mount the two-panel resizable group when
     * the detail panel branch actually exists.
     *
     * References:
     * - react-resizable-panels README, `useDefaultLayout` panelIds guidance
     * - node_modules/.pnpm/react-resizable-panels@4.10.0_react-dom@19.2.5_react@19.2.5__react@19.2.5/node_modules/react-resizable-panels/dist/react-resizable-panels.d.ts
     */
    return (
      <SchoolClassesWorkspaceModeContext
        key="desktop"
        value={DESKTOP_WORKSPACE_MODE}
      >
        <div className="flex min-w-0 flex-col">{children}</div>
      </SchoolClassesWorkspaceModeContext>
    );
  }

  return (
    <SchoolClassesWorkspaceModeContext
      key="desktop"
      value={DESKTOP_WORKSPACE_MODE}
    >
      <SchoolClassesResizableWorkspaceShell panel={panel}>
        {children}
      </SchoolClassesResizableWorkspaceShell>
    </SchoolClassesWorkspaceModeContext>
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
  const isMounted = useMounted();
  const { defaultLayout, onLayoutChanged } = useResizableDefaultLayout({
    id: SCHOOL_CLASSES_WORKSPACE_PANEL_GROUP_ID,
    panelIds: [
      SCHOOL_CLASSES_WORKSPACE_MAIN_PANEL_ID,
      SCHOOL_CLASSES_WORKSPACE_DETAIL_PANEL_ID,
    ],
    // Keep the hydration pass deterministic. Next.js hydration errors happen
    // when server and client first render disagree; the server cannot read
    // browser storage, so we wait until mount before reading the saved panel
    // layout.
    // References:
    // https://nextjs.org/docs/messages/react-hydration-error
    // https://react.dev/reference/react-dom/client/hydrateRoot#handling-different-client-and-server-content
    storage: isMounted
      ? SCHOOL_CLASSES_WORKSPACE_LAYOUT_STORAGE
      : SCHOOL_CLASSES_WORKSPACE_EMPTY_LAYOUT_STORAGE,
  });

  return (
    <ResizablePanelGroup
      className="!overflow-visible min-w-0"
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
