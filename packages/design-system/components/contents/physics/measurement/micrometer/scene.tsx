import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { Micrometer } from "@repo/design-system/components/three/instrument/micrometer";
import {
  PLATE_TOP,
  Plate,
} from "@repo/design-system/components/three/instrument/plate";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";

/** Where the gauge lies on the plate, in scene units. */
const PLACE = [-0.16, 0, -0.14] as const;

/**
 * What the camera frames at every width, in scene units: the ball between
 * the anvil and the spindle, the sleeve and the thimble, which are the
 * subject and both scales of its reading. The rest of the frame may run out
 * of the picture.
 */
const READING = {
  x: { max: PLACE[0] + 0.92, min: PLACE[0] - 0.12 },
  y: { max: PLATE_TOP + 0.18, min: PLATE_TOP },
  z: { max: PLACE[2] + 0.1, min: PLACE[2] - 0.1 },
} as const;

/**
 * A micrometer screw gauge closed on a bearing ball `thickness` millimetres
 * across, lying on the bench, seen from over its sleeve and thimble so both
 * scales can be read.
 *
 * @param thickness - The ball's diameter, in millimetres
 * @param sleeve - The last sleeve mark the thimble has uncovered, in millimetres
 */
export function GaugeScene({
  sleeve,
  thickness,
}: {
  readonly sleeve: number;
  readonly thickness: number;
}) {
  return (
    <group>
      <CameraControls
        cameraPosition={[0.3, PLATE_TOP + 0.87, 0.22]}
        cameraTarget={[0.3, PLATE_TOP + 0.09, -0.14]}
        fov={36}
        framing="content"
        maxPolarAngle={Math.PI * 0.49}
      />
      <CameraBounds bounds={READING}>
        <Plate deep={200} wide={300}>
          <group position={[PLACE[0], PLACE[1], PLACE[2]]}>
            <Micrometer
              pointed={{
                sleeve: [sleeve, PLOT_COLORS.teal],
                thimble: PLOT_COLORS.fuchsia,
              }}
              reading={thickness}
            >
              <mesh castShadow position={[thickness / 2, 0, 0]} receiveShadow>
                <sphereGeometry args={[thickness / 2, 64, 48]} />
                <SurfaceMaterial
                  color={CAR_COLORS.chrome}
                  metalness={1}
                  repeat={[2, 2]}
                  roughness={0.12}
                  surface="brushed"
                />
              </mesh>
            </Micrometer>
          </group>
        </Plate>
      </CameraBounds>
    </group>
  );
}
