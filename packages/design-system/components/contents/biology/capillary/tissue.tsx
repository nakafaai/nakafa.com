import {
  FLATTEN,
  tissueCells,
} from "@repo/design-system/components/contents/biology/capillary/cells";
import {
  hashUnit,
  valueNoise,
} from "@repo/design-system/components/contents/simulation/grain";
import { CAPILLARY_COLORS } from "@repo/design-system/lib/material/capillary";
import { Array as Arr } from "effect";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import { Euler, Matrix4, Quaternion, SphereGeometry, Vector3 } from "three";

/**
 * A soft unit body, swollen and dented by smooth noise of low frequency as a
 * living cell or nucleus is, never a true sphere: `amount` is how far its
 * surface strays, as a share of its radius.
 */
function useBlob(seed: number, amount: number) {
  const geometry = useMemo(() => {
    const blob = new SphereGeometry(1, 56, 40);
    const position = blob.getAttribute("position");
    const point = new Vector3();
    for (const index of Arr.range(0, position.count - 1)) {
      point.fromBufferAttribute(position, index);
      const broad = valueNoise(
        point.x * 1.7 + seed,
        point.y * 1.7 + point.z * 1.3,
        64
      );
      const fine = valueNoise(
        point.x * 4.1 - seed,
        point.z * 4.1 + point.y * 2.7,
        64
      );
      point.multiplyScalar(
        1 + amount * (broad - 0.5) + 0.25 * amount * (fine - 0.5)
      );
      position.setXYZ(index, point.x, point.y, point.z);
    }
    blob.computeVertexNormals();
    return blob;
  }, [amount, seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * The tissue cells: soft, flattened bodies resting among the vessels, their
 * cytoplasm translucent enough to show the dark nucleus inside each.
 */
export function TissueCells() {
  const cells = useMemo(() => tissueCells(), []);
  const body = useBlob(3, 0.16);
  const kernel = useBlob(8, 0.08);
  const bodies = useRef<InstancedMesh>(null);
  const nuclei = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const outerMesh = bodies.current;
    const innerMesh = nuclei.current;
    if (outerMesh === null || innerMesh === null) {
      return;
    }
    const matrix = new Matrix4();
    const turn = new Quaternion();
    const point = new Vector3();
    const size = new Vector3();
    Arr.forEach(cells, (cell, index) => {
      turn.setFromEuler(new Euler(0, hashUnit(cell.seed, 13) * Math.PI, 0));
      const height = cell.radius * FLATTEN;
      point.set(cell.x, height, cell.z);
      size.set(
        cell.radius,
        height,
        cell.radius * (0.62 + 0.36 * hashUnit(cell.seed, 17))
      );
      outerMesh.setMatrixAt(index, matrix.compose(point, turn, size));
      const nucleus = 0.35 + 0.04 * hashUnit(cell.seed, 19);
      point.set(
        cell.x + 0.12 * (hashUnit(cell.seed, 23) - 0.5),
        height * 1.05,
        cell.z
      );
      size.set(
        nucleus * 1.1,
        Math.min(nucleus * 0.7, height * 0.62),
        nucleus * 0.9
      );
      innerMesh.setMatrixAt(index, matrix.compose(point, turn, size));
    });
    outerMesh.instanceMatrix.needsUpdate = true;
    innerMesh.instanceMatrix.needsUpdate = true;
    outerMesh.computeBoundingSphere();
    innerMesh.computeBoundingSphere();
  }, [cells]);
  return (
    <group>
      <instancedMesh
        args={[kernel, undefined, cells.length]}
        castShadow
        ref={nuclei}
      >
        <meshPhysicalMaterial
          clearcoat={0.4}
          color={CAPILLARY_COLORS.nucleus}
          roughness={0.45}
        />
      </instancedMesh>
      <instancedMesh
        args={[body, undefined, cells.length]}
        castShadow
        receiveShadow
        ref={bodies}
      >
        <meshPhysicalMaterial
          clearcoat={0.55}
          clearcoatRoughness={0.35}
          color={CAPILLARY_COLORS.cytoplasm}
          depthWrite={false}
          opacity={0.5}
          roughness={0.42}
          transparent
        />
      </instancedMesh>
    </group>
  );
}
