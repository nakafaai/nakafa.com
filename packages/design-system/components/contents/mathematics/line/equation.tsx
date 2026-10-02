import { LineCard } from "@repo/design-system/components/contents/mathematics/line/card";
import { packLines } from "@repo/design-system/components/contents/mathematics/line/pack";
import type { AuthoredLine } from "@repo/design-system/components/contents/mathematics/line/spec";
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

/**
 * Renders one interactive line-equation card. The server render packs the
 * authored points, so the RSC payload carries them compactly to the card.
 */
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
  return (
    <LineCard
      cameraPosition={cameraPosition}
      {...(cameraTarget === undefined ? {} : { cameraTarget })}
      description={description}
      lines={packLines(data)}
      showZAxis={showZAxis}
      title={title}
    />
  );
}
