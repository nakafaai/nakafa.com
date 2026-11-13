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
  VisualCardFooter,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { Effect } from "effect";
import type { ReactNode } from "react";

/**
 * One authored circle arc. Its label holds React nodes, which no Schema can
 * describe, so the shape lives beside the `data` prop that takes it.
 */
export interface CircleArcLineProps extends CircleArcFields {
  readonly label?: Omit<ResolvedLineLabel, "at"> & CircleArcLabelFields;
}

interface SceneProps {
  cameraPosition?: [number, number, number];
  cameraTarget?: [number, number, number];
  /**
   * The lines of the scene. A line may declare its `curve` instead of its points:
   * `y = amplitude * f(frequency * x + phase) + shift` over a domain, where `f` is
   * sin, cos or tan. Its points are computed here on a grid of `samples` (at least 200,
   * default 200), and a tangent is split at each asymptote and clipped to its y limit
   * (see `line/curve.ts`). A label's `at` on a curve indexes that grid.
   */
  data: readonly AuthoredLine[];
  showZAxis?: boolean;
}

interface Props extends SceneProps {
  description: NonNullable<ReactNode>;
  /** The scene's readouts, drawn where the card is composed (`LineFacts`), so their math stays there. */
  facts: ReactNode;
  title: NonNullable<ReactNode>;
}

/**
 * The line-equation card of authored content: its title and description, the scene with its actions, and the readouts
 * of the scene in the footer. A lesson draws the readouts on the server, so their math never reaches the browser; the
 * scene parts read the scene from `LineEquationProvider`.
 */
export function LineEquation({
  cameraPosition,
  cameraTarget,
  data,
  description,
  facts,
  showZAxis,
  title,
}: Props) {
  const config = Effect.runSync(
    resolveLineScene({
      cameraPosition,
      cameraTarget,
      data,
      showZAxis,
    })
  );

  return (
    <LineEquationProvider config={config}>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <DeferredLineScene />
        <CoordinateControls />
        <VisualCardFooter>{facts}</VisualCardFooter>
      </VisualCard>
    </LineEquationProvider>
  );
}
