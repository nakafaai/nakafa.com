import type { Seed } from "@repo/design-system/components/contents/biology/respirometer/pile";
import { settlePile } from "@repo/design-system/components/contents/biology/respirometer/pile";
import {
  hashUnit,
  valueNoise,
} from "@repo/design-system/components/contents/simulation/grain";
import { RESPIROMETER_COLORS } from "@repo/design-system/lib/material/respirometer";
import { Array as Arr } from "effect";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import {
  CapsuleGeometry,
  Color,
  Float32BufferAttribute,
  LatheGeometry,
  Matrix4,
  Quaternion,
  Vector2,
  Vector3,
} from "three";

/**
 * A mung bean (Vigna radiata) seed, in metres: 4.21 mm long, 3.17 mm wide
 * and 3.08 mm thick (Nimkar and Chattopadhyay 2001, Journal of Agricultural
 * Engineering Research 80(2)), and a radicle just broken out of one end,
 * drawn shorter than the 8 to 9.5 mm it reaches by the second day of
 * germination (Minh 2022, Plant Science Today).
 */
const MUNG = {
  length: 0.004_21,
  radicle: 0.0022,
  thickness: 0.003_08,
  width: 0.003_17,
} as const;

/** The capsule a seed and its radicle fill together, which the pile keeps apart. */
const PACKED = {
  length: MUNG.length + MUNG.radicle,
  width: MUNG.width + 0.0002,
} as const;

/** The world's up, along which the seed's long axis is modelled before it is laid on its side. */
const ALONG = new Vector3(0, 1, 0);

/**
 * A mung bean's body along its own y axis: an oblong capsule flattened a
 * little and dimpled by smooth noise, its dull green coat mottled darker and
 * paler, with the white hilum running along one side.
 */
function useSeedBody() {
  const geometry = useMemo(() => {
    const body = new CapsuleGeometry(
      MUNG.width / 2,
      MUNG.length - MUNG.width,
      6,
      16
    );
    const position = body.getAttribute("position");
    const colors = new Float32Array(position.count * 3);
    const point = new Vector3();
    const dark = new Color(RESPIROMETER_COLORS.coatDark);
    const pale = new Color(RESPIROMETER_COLORS.coatPale);
    const scar = new Color(RESPIROMETER_COLORS.hilum);
    const coat = new Color(RESPIROMETER_COLORS.coat);
    const shade = new Color();
    Arr.forEach(Arr.range(0, position.count - 1), (index) => {
      point.fromBufferAttribute(position, index);
      const across = Math.hypot(point.x, point.z) / (MUNG.width / 2);
      const dent =
        1 +
        0.06 *
          (valueNoise(point.x * 900 + 3, point.y * 900 + point.z * 700, 64) -
            0.5);
      point.set(
        point.x * dent,
        point.y,
        point.z * dent * (MUNG.thickness / MUNG.width)
      );
      position.setXYZ(index, point.x, point.y, point.z);
      const onScar =
        point.x > (MUNG.width / 2) * 0.86 &&
        Math.abs(point.y) < MUNG.length * 0.22 &&
        across > 0.8;
      shade
        .copy(dark)
        .lerp(
          coat,
          valueNoise(point.y * 700 + 11, point.z * 700 - point.x * 500, 64)
        )
        .lerp(pale, 0.25 * valueNoise(point.y * 2600, point.z * 2600 + 5, 64));
      const color = onScar ? scar : shade;
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    });
    body.setAttribute("color", new Float32BufferAttribute(colors, 3));
    body.computeVertexNormals();
    return body;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** The radicle's outline from its base to its blunt root cap: a short tapering root. */
const RADICLE_OUTLINE = Arr.map(Arr.range(0, 12), (step) => {
  const share = step / 12;
  const radius = 0.000_42 * Math.sqrt(1 - share ** 3) + 0.000_06;
  return new Vector2(radius, share * MUNG.radicle);
});

/** A young radicle along its own y axis, bending a little as it grows. */
function useRadicle() {
  const geometry = useMemo(() => {
    const root = new LatheGeometry(RADICLE_OUTLINE, 12);
    const position = root.getAttribute("position");
    Arr.forEach(Arr.range(0, position.count - 1), (index) => {
      const y = position.getY(index);
      position.setX(
        index,
        position.getX(index) + (y / MUNG.radicle) ** 2 * 0.0004
      );
    });
    root.computeVertexNormals();
    return root;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** How many of the seeds have broken their coats and shown a radicle after a day, as a share. */
const SPROUTED = 0.7;

/** The matrix that lays a seed of the pile on its side, `shift` along its long axis from the pile's capsule middle. */
function seedMatrix(seed: Seed, shift: number, scale: number) {
  const lie = new Quaternion().setFromAxisAngle(
    new Vector3(0, 0, 1),
    -Math.PI / 2
  );
  const roll = new Quaternion().setFromAxisAngle(ALONG, seed.roll);
  const yaw = new Quaternion().setFromAxisAngle(ALONG, -seed.yaw);
  const turn = yaw.multiply(lie).multiply(roll);
  const offset = new Vector3(0, shift, 0).applyQuaternion(turn);
  return new Matrix4().compose(
    new Vector3(seed.x + offset.x, seed.y + offset.y, seed.z + offset.z),
    turn,
    new Vector3(scale, scale, scale)
  );
}

/**
 * The germinating mung beans of one respirometer, tipped onto its wire
 * gauze at height `floor` in a tube of inner radius `radius`: each seed body
 * and its radicle drawn as two instanced meshes, every seed resting on the
 * gauze or on the seeds below it without cutting into any.
 */
export function SeedPile({
  ceiling,
  count,
  floor,
  radius,
  salt,
}: {
  readonly ceiling: number;
  readonly count: number;
  readonly floor: number;
  readonly radius: number;
  readonly salt: number;
}) {
  const body = useSeedBody();
  const radicle = useRadicle();
  const bodies = useRef<InstancedMesh>(null);
  const radicles = useRef<InstancedMesh>(null);
  const seeds = useMemo(
    () =>
      settlePile({
        ceiling,
        count,
        floor,
        length: PACKED.length,
        radius,
        salt,
        width: PACKED.width,
      }),
    [ceiling, count, floor, radius, salt]
  );

  useLayoutEffect(() => {
    const seedMesh = bodies.current;
    const rootMesh = radicles.current;
    if (seedMesh === null || rootMesh === null) {
      return;
    }
    const shade = new Color();
    Arr.forEach(seeds, (seed, index) => {
      const grain = hashUnit(index, salt + 17);
      const growth = hashUnit(index + 41, salt);
      seedMesh.setMatrixAt(index, seedMatrix(seed, -MUNG.radicle / 2, 1));
      seedMesh.setColorAt(index, shade.setScalar(0.8 + 0.25 * grain));
      rootMesh.setMatrixAt(
        index,
        seedMatrix(
          seed,
          MUNG.length / 2 - MUNG.radicle / 2 - 0.0004,
          growth < SPROUTED ? 0.55 + (0.45 * growth) / SPROUTED : 0
        )
      );
    });
    seedMesh.instanceMatrix.needsUpdate = true;
    if (seedMesh.instanceColor !== null) {
      seedMesh.instanceColor.needsUpdate = true;
    }
    rootMesh.instanceMatrix.needsUpdate = true;
    seedMesh.computeBoundingSphere();
    rootMesh.computeBoundingSphere();
  }, [salt, seeds]);

  return (
    <group>
      <instancedMesh
        args={[body, undefined, seeds.length]}
        castShadow
        receiveShadow
        ref={bodies}
      >
        <meshPhysicalMaterial
          clearcoat={0.35}
          clearcoatRoughness={0.4}
          roughness={0.55}
          vertexColors
        />
      </instancedMesh>
      <instancedMesh
        args={[radicle, undefined, seeds.length]}
        castShadow
        ref={radicles}
      >
        <meshPhysicalMaterial
          clearcoat={0.7}
          clearcoatRoughness={0.25}
          color={RESPIROMETER_COLORS.radicle}
          roughness={0.5}
        />
      </instancedMesh>
    </group>
  );
}
