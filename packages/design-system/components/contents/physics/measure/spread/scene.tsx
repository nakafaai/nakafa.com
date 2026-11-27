import { spreadSheet } from "@repo/design-system/components/contents/physics/measure/spread/plot";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { Clipboard } from "@repo/design-system/components/three/instrument/clipboard";
import { MILLIMETRE } from "@repo/design-system/components/three/instrument/scale";
import { usePrintNumber } from "@repo/design-system/components/three/print/number";
import { useMemo } from "react";

/** How thick the board is, in scene units: it lies on its back. */
const BACK = 3 * MILLIMETRE;

/** How far up the board the sheet starts, from the board's bottom edge, in millimetres. */
const FOOT = 8;

/**
 * The results board of the class, lying on the bench: every student's
 * readings as dots on one row of a shared scale, with the actual value as a
 * dashed line and the chosen student's row picked out. The camera frames
 * the sheet, whatever its size, across the width of the card, and the board
 * and its clip run out of the picture around it.
 *
 * @param students - Each student's name and readings, in centimetres
 * @param actual - The actual value they measured, in centimetres
 * @param chosen - Which student's row is picked out
 * @param label - The actual value as it is printed over its line
 */
export function BoardScene({
  actual,
  chosen,
  label,
  students,
}: {
  readonly actual: number;
  readonly chosen: number;
  readonly label: string;
  readonly students: Parameters<typeof spreadSheet>[0];
}) {
  const format = usePrintNumber();
  const sheet = useMemo(
    () => spreadSheet(students, actual, chosen, label, format),
    [actual, chosen, format, label, students]
  );

  const half = (sheet.width / 2) * MILLIMETRE;

  return (
    <group>
      <CameraControls
        cameraPosition={[0, 2.8, 0.4]}
        cameraTarget={[0, 0, (-FOOT - sheet.height / 2) * MILLIMETRE]}
        fov={36}
        framing="content"
        maxPolarAngle={Math.PI * 0.49}
      />
      <CameraBounds
        bounds={{
          x: { max: half, min: -half },
          y: { max: BACK, min: 0 },
          z: {
            max: -FOOT * MILLIMETRE,
            min: (-FOOT - sheet.height) * MILLIMETRE,
          },
        }}
      >
        <group position={[0, BACK, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <Clipboard sheet={sheet} />
        </group>
      </CameraBounds>
    </group>
  );
}
