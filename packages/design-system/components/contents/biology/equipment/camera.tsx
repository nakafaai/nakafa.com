import { useReducedMotion } from "@mantine/hooks";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import type { Flight } from "@repo/design-system/components/contents/biology/equipment/framing";
import {
  between,
  easeInOut,
  focusPose,
  overviewPose,
} from "@repo/design-system/components/contents/biology/equipment/framing";
import { usePick } from "@repo/design-system/components/contents/biology/equipment/pick";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { useCameraPlay } from "@repo/design-system/components/three/camera/play";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import type { ComponentRef } from "react";
import { useEffect, useRef, useState } from "react";
import { Vector3 } from "three";

/** The lens's vertical field of view, in degrees. */
const FOV = 40;

/** How long the camera takes to turn to a picked item, in seconds. */
const FLIGHT = 1.1;

/** The orbit's sweep round its target, in radians from looking straight at the back wall: it stays inside the room. */
const AZIMUTH = { max: 1.75, min: -0.35 } as const;

/**
 * The camera of the laboratory corner. It opens on the whole corner, and each
 * time the learner picks an item it turns to that item in one smooth move,
 * easing in and out, or at once for a reader who asks for reduced motion.
 * The card's first-view action flies it back to the whole corner. The
 * learner may orbit and zoom at any time, which stops a move in progress.
 * The house camera controls keep the orbit within a few times its first
 * distance, which a camera that travels from the room to a 26 mm slide
 * cannot keep, so this lab owns its orbit controls.
 */
export function EquipmentCamera() {
  const { current, visit } = usePick();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const invalidate = useThree((state) => state.invalidate);
  const aspect = useThree(
    (state) => state.size.width / Math.max(state.size.height, 1)
  );
  const [first] = useState(() => {
    const pose = overviewPose(FOV, aspect);
    return {
      position: new Vector3(...pose.position),
      target: new Vector3(...pose.target),
    };
  });
  const playing = useCameraPlay();
  const view = useVisualScene((state) => state.view, 0);
  const calm = useReducedMotion(undefined, { getInitialValueInEffect: false });
  const flight = useRef<Flight | null>(null);
  const elapsed = useRef(0);
  const seen = useRef({ view, visit });

  // A pick or the first-view action changes no object of the scene, so it asks for the frame that starts the move.
  useEffect(() => {
    if (seen.current.visit !== visit || seen.current.view !== view) {
      invalidate();
    }
  }, [invalidate, view, visit]);

  useEffect(() => {
    const previous = canvas.style.cursor;
    canvas.style.cursor = "grab";
    return () => {
      canvas.style.cursor = previous;
    };
  }, [canvas]);

  useFrame((state, delta) => {
    const rig = controls.current;
    if (rig === null) {
      return;
    }
    if (seen.current.visit !== visit || seen.current.view !== view) {
      elapsed.current = 0;
      flight.current = {
        from: {
          position: camera.position.toArray(),
          target: rig.target.toArray(),
        },
        to:
          seen.current.visit === visit
            ? overviewPose(FOV, aspect)
            : focusPose(current, FOV, aspect),
      };
      seen.current = { view, visit };
    }
    const move = flight.current;
    if (move === null) {
      return;
    }
    elapsed.current += simulationStep(delta);
    const share = calm ? 1 : easeInOut(elapsed.current / FLIGHT);
    camera.position.set(
      ...between(move.from.position, move.to.position, share)
    );
    rig.target.set(...between(move.from.target, move.to.target, share));
    camera.lookAt(rig.target);
    if (share >= 1) {
      flight.current = null;
      return;
    }
    state.invalidate();
  });

  return (
    <>
      <PerspectiveCamera
        far={40}
        fov={FOV}
        makeDefault
        near={0.02}
        position={first.position}
      />
      <OrbitControls
        autoRotate={playing}
        autoRotateSpeed={0.5}
        dampingFactor={0.08}
        enableDamping
        makeDefault
        maxAzimuthAngle={AZIMUTH.max}
        maxDistance={9}
        maxPolarAngle={Math.PI * 0.48}
        minAzimuthAngle={AZIMUTH.min}
        minDistance={0.1}
        onEnd={() => {
          canvas.style.cursor = "grab";
        }}
        onStart={() => {
          flight.current = null;
          canvas.style.cursor = "grabbing";
        }}
        ref={controls}
        target={first.target}
      />
    </>
  );
}
