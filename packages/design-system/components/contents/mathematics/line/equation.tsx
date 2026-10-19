import { LineEquationProvider } from "@repo/design-system/components/contents/mathematics/line/context";
import { DeferredLineScene } from "@repo/design-system/components/contents/mathematics/line/deferred";
import { LineFacts } from "@repo/design-system/components/contents/mathematics/line/facts";
import {
  type LineSceneConfig,
  resolveLineScene,
} from "@repo/design-system/components/contents/mathematics/line/resolve";
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
  data: readonly AuthoredLine[];
  showZAxis?: boolean;
}

interface Props extends SceneProps {
  description: ReactNode;
  title: ReactNode;
}

interface CardProps extends SceneProps {
  /** The card's header. A graph that builds its own title and description passes it here. */
  header: ReactNode;
}

/**
 * The line-equation card under the header its caller builds: the scene with its actions, and
 * the readouts of the scene in the footer. The footer is drawn on the server, so its math
 * never reaches the browser; the scene parts read the scene from `LineEquationProvider`.
 */
function LineEquationFrame({
  config,
  header,
}: {
  config: LineSceneConfig;
  header: ReactNode;
}) {
  return (
    <LineEquationProvider config={config}>
      <VisualCard>
        {header}
        <DeferredLineScene />
        <CoordinateControls />
        <VisualCardFooter>
          <LineFacts lines={config.lines} />
        </VisualCardFooter>
      </VisualCard>
    </LineEquationProvider>
  );
}

/** The line-equation card of authored content, with the title and description of its lesson. */
export function LineEquation({
  cameraPosition,
  cameraTarget,
  data,
  description,
  showZAxis,
  title,
}: Props) {
  const config = resolveLineScene({
    cameraPosition,
    cameraTarget,
    data,
    showZAxis,
  });

  return (
    <LineEquationFrame
      config={config}
      header={<VisualCardHeader description={description} title={title} />}
    />
  );
}

/** The line-equation card under a header its caller builds, as the unit-circle card takes one. */
export function LineEquationCard({
  cameraPosition,
  cameraTarget,
  data,
  header,
  showZAxis,
}: CardProps) {
  const config = resolveLineScene({
    cameraPosition,
    cameraTarget,
    data,
    showZAxis,
  });

  return <LineEquationFrame config={config} header={header} />;
}
