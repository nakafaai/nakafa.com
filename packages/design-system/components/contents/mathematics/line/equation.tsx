import { LineEquationProvider } from "@repo/design-system/components/contents/mathematics/line/context";
import { DeferredLineScene } from "@repo/design-system/components/contents/mathematics/line/deferred";
import { resolveLineScene } from "@repo/design-system/components/contents/mathematics/line/resolve";
import type {
  AuthoredLine,
  CircleArcFields,
  CircleArcLabelFields,
  ResolvedLineLabel,
} from "@repo/design-system/components/contents/mathematics/line/spec";
import { CoordinateControls } from "@repo/design-system/components/three/controls";
import {
  VisualCard,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import type { ReactNode } from "react";

/**
 * One authored circle arc. Its label holds React nodes, which no Schema can
 * describe, so the shape lives beside the `data` prop that takes it.
 */
export interface CircleArcLineProps extends CircleArcFields {
  readonly label?: Omit<ResolvedLineLabel, "at"> & CircleArcLabelFields;
}

interface Props {
  cameraPosition?: [number, number, number];
  cameraTarget?: [number, number, number];
  data: readonly AuthoredLine[];
  description: ReactNode;
  showZAxis?: boolean;
  title: ReactNode;
}

/** Renders one interactive line-equation card. */
export function LineEquation({
  title,
  description,
  data,
  cameraPosition,
  cameraTarget,
  showZAxis,
}: Props) {
  const config = resolveLineScene({
    cameraPosition,
    cameraTarget,
    data,
    showZAxis,
  });

  return (
    <LineEquationProvider config={config}>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <DeferredLineScene />
        <CoordinateControls />
      </VisualCard>
    </LineEquationProvider>
  );
}
