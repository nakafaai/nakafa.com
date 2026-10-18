import { DeferredLineScene } from "@repo/design-system/components/contents/mathematics/line/deferred";
import { LineFacts } from "@repo/design-system/components/contents/mathematics/line/facts";
import { CoordinateControls } from "@repo/design-system/components/three/controls";
import {
  VisualCard,
  VisualCardFooter,
} from "@repo/design-system/components/visual/card";
import type { ReactNode } from "react";

/**
 * The frame of one line-equation card: its header, then the scene with its
 * actions, then the readouts of the scene in the footer. The card's parts read
 * the scene from the surrounding `LineEquationProvider`.
 */
export function LineSceneCard({ children }: { children: ReactNode }) {
  return (
    <VisualCard>
      {children}
      <DeferredLineScene />
      <CoordinateControls />
      <VisualCardFooter>
        <LineFacts />
      </VisualCardFooter>
    </VisualCard>
  );
}
