import { spreadSheet } from "@repo/design-system/components/contents/physics/measure/spread/plot";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { Clipboard } from "@repo/design-system/components/three/instrument/clipboard";
import { MILLIMETRE } from "@repo/design-system/components/three/instrument/scale";
import { usePrintNumber } from "@repo/design-system/components/three/print/number";
import { useMemo } from "react";

/** How thick the board is, in scene units: it lies on its back. */
const BACK = 3 * MILLIMETRE;

/** How far the board runs past its sheet to either side, and from its bottom edge to its top, in millimetres. */
const BOARD = { side: 8, tall: 32 } as const;

/**
 * The results board of the class, lying on the bench: every student's
 * readings as dots on one row of a shared scale, with the actual value as a
 * dashed line and the chosen student's row picked out.
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
  const wide = (sheet.width / 2 + BOARD.side) * MILLIMETRE;
  const tall = (sheet.height + BOARD.tall) * MILLIMETRE;

  return (
    <group>
      <CameraControls
        cameraPosition={[0, 2.6, 0.75]}
        cameraTarget={[0, 0, -tall / 2]}
        fov={36}
        framing="content"
        maxPolarAngle={Math.PI * 0.49}
      />
      <CameraBounds
        bounds={{
          x: { max: wide, min: -wide },
          y: { max: 0.08, min: 0 },
          z: { max: 0, min: -tall },
        }}
      >
        <group position={[0, BACK, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <Clipboard sheet={sheet} />
        </group>
      </CameraBounds>
    </group>
  );
}
