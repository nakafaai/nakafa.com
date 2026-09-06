import type { ParsedHeading } from "@repo/contents/_types/toc";
import type { ComponentProps } from "react";
import {
  SidebarRight,
  SidebarRightPanel,
} from "@/components/shared/sidebar-right";
import { SidebarTree } from "@/components/shared/sidebar-tree";

interface LayoutMaterialTocProps {
  chapters: {
    label: string;
    data: ParsedHeading[];
  };
  githubUrl?: ComponentProps<typeof SidebarRight>["githubUrl"];
  header?: ComponentProps<typeof SidebarRight>["header"];
  references?: ComponentProps<typeof SidebarRight>["references"];
  showComments?: ComponentProps<typeof SidebarRight>["showComments"];
}

/**
 * Renders the right-hand table of contents and material page actions.
 */
export function LayoutMaterialToc({
  chapters,
  header,
  githubUrl,
  references,
  showComments,
}: LayoutMaterialTocProps) {
  return (
    <SidebarRight
      githubUrl={githubUrl}
      header={header}
      references={references}
      showComments={showComments}
    >
      <SidebarTree data={chapters.data} title={chapters.label} />
    </SidebarRight>
  );
}

/** Outline panel for pages that compose their trigger in the content header. */
export function MaterialOutline({
  chapters,
  ...props
}: LayoutMaterialTocProps) {
  return (
    <SidebarRightPanel {...props}>
      <SidebarTree data={chapters.data} title={chapters.label} />
    </SidebarRightPanel>
  );
}
