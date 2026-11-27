import { useFrame } from "@react-three/fiber";
import {
  hyacinthRaft,
  raftAlong,
  raftLanes,
  raftShown,
} from "@repo/design-system/components/contents/physics/kinematics/river/raft";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { BOAT_COLORS } from "@repo/design-system/lib/material/boat";
import { useEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Object3D,
} from "three";

/** How many rafts drift on the river. */
const RAFTS = 46;

/**
 * Rafts of water hyacinth riding the current: every raft moves downstream
 * at the water's own speed, bobbing and slowly turning, so the learner sees
 * the current the boat has to cross. The river runs along x with its water
 * at height zero.
 *
 * @param current - The speed of the current, in m/s
 * @param width - The river's width, in metres
 */
export function Flotsam({
  current,
  width,
}: {
  readonly current: number;
  readonly width: number;
}) {
  const rafts = useRef<InstancedMesh>(null);
  const water = useRef({ place: new Object3D(), time: 0 });
  const lanes = useMemo(() => raftLanes(width, RAFTS), [width]);
  const geometry = useMemo(() => {
    const raft = hyacinthRaft();
    const built = new BufferGeometry();
    built.setAttribute(
      "position",
      new Float32BufferAttribute(raft.positions, 3)
    );
    built.setIndex(raft.indices);
    built.computeVertexNormals();
    return built;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    const mesh = rafts.current;
    if (mesh === null) {
      return;
    }
    const { place } = water.current;
    water.current.time += simulationStep(delta);
    const { time } = water.current;
    for (let index = 0; index < lanes.length; index += 1) {
      const lane = lanes[index];
      if (lane === undefined) {
        continue;
      }
      const along = raftAlong(lane.start, time, current, width);
      place.position.set(along, 0.012 * Math.sin(time * 1.6 + index), lane.z);
      place.rotation.set(
        0.02 * Math.sin(time * 1.1 + index * 2),
        index + time * lane.spin,
        0.02 * Math.sin(time * 1.4 + index * 3)
      );
      place.scale.setScalar(lane.scale * raftShown(along, width));
      place.updateMatrix();
      mesh.setMatrixAt(index, place.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <CameraBounds exclude>
      <instancedMesh
        args={[geometry, undefined, RAFTS]}
        castShadow
        frustumCulled={false}
        receiveShadow
        ref={rafts}
      >
        <Matter color={BOAT_COLORS.hyacinth} of="wax" side={DoubleSide} />
      </instancedMesh>
    </CameraBounds>
  );
}
