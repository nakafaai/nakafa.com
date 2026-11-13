import { OrthographicCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { MATERIAL } from "@repo/design-system/lib/material";
import { type ReactNode, useEffect, useMemo } from "react";
import { DataTexture } from "three";

/**
 * The circle of light a learner sees through a microscope's eyepiece, about
 * 120 µm across at 1000×: warm bright-field light that dims toward the rim of
 * the field, and the dark of the tube around it. The scene's units are
 * micrometres, with the slide in the x–z plane and the camera looking down.
 */
const FIELD_RADIUS = 60;

/** How the light falls off toward the rim of the field, from the centre out. */
function createVignette() {
  const size = 512;
  const data = new Uint8Array(size * size * 4);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const x = (column + 0.5) / size - 0.5;
      const y = (row + 0.5) / size - 0.5;
      const distance = Math.hypot(x, y) * 2;
      const rim = Math.min(1, Math.max(0, (1 - distance) / 0.03));
      const light = rim * (1 - 0.38 * Math.min(1, distance) ** 3);
      const value = Math.round(255 * light);
      data.set([value, value, value, 255], (row * size + column) * 4);
    }
  }
  const texture = new DataTexture(data, size, size);
  texture.needsUpdate = true;
  return texture;
}

/**
 * The eyepiece view: the bright field, its dark surround, and whatever lies on
 * the slide, seen from above through an orthographic camera that frames the
 * whole circle with a little dark around it.
 */
export function MicroscopeField({
  children,
}: {
  readonly children: ReactNode;
}) {
  const vignette = useMemo(createVignette, []);
  const size = useThree((state) => state.size);
  useEffect(() => () => vignette.dispose(), [vignette]);
  const zoom = Math.min(size.width, size.height) / (2 * FIELD_RADIUS * 1.08);

  return (
    <>
      <OrthographicCamera
        far={400}
        makeDefault
        near={0.1}
        position={[0, 200, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        zoom={zoom}
      />
      <mesh position={[0, -0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[FIELD_RADIUS * 6, FIELD_RADIUS * 6]} />
        <meshBasicMaterial color={MATERIAL.microscopeDark} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[FIELD_RADIUS * 1.01, 256]} />
        <meshBasicMaterial
          color={MATERIAL.microscopeLight}
          map={vignette}
          toneMapped={false}
        />
      </mesh>
      {children}
    </>
  );
}
