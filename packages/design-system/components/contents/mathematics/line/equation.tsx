import { DeferredLineScene } from "@repo/design-system/components/contents/mathematics/line/deferred";
import { resolveAuthoredLines } from "@repo/design-system/components/contents/mathematics/line/resolve";
import type { AuthoredLine } from "@repo/design-system/components/contents/mathematics/line/spec";
import {
  CoordinateControls,
  CoordinateProvider,
} from "@repo/design-system/components/three/controls";
import {
  VisualCard,
  VisualCardBody,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import type { ReactNode } from "react";

const DEFAULT_CAMERA_POSITION_X = 10;
const DEFAULT_CAMERA_POSITION_Y = 6;
const DEFAULT_CAMERA_POSITION_Z = 10;

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
  cameraPosition = [
    DEFAULT_CAMERA_POSITION_X,
    DEFAULT_CAMERA_POSITION_Y,
    DEFAULT_CAMERA_POSITION_Z,
  ],
  cameraTarget,
  showZAxis = true,
}: Props) {
  const lines = resolveAuthoredLines(data);

  return (
    <CoordinateProvider>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <VisualCardBody>
          <DeferredLineScene
            cameraPosition={cameraPosition}
            {...(cameraTarget === undefined ? {} : { cameraTarget })}
            lines={lines}
            showZAxis={showZAxis}
          />
        </VisualCardBody>
        <CoordinateControls />
      </VisualCard>
    </CoordinateProvider>
  );
}
