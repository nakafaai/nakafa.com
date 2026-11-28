import { useFrame } from "@react-three/fiber";
import type { Segment } from "@repo/design-system/components/contents/biology/hyphae/growth";
import { TEMPEH } from "@repo/design-system/components/contents/biology/hyphae/growth";
import {
  BEAN,
  beanPoint,
  beansOf,
  reliefAt,
  shownBy,
  stalksOf,
  threadPlacements,
} from "@repo/design-system/components/contents/biology/hyphae/tray";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { fractalAt } from "@repo/design-system/components/three/field/noise";
import {
  SurfaceMaterial,
  useSurfaceMaps,
} from "@repo/design-system/components/three/surface/material";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { ECOLOGY_COLORS } from "@repo/design-system/lib/material/ecology";
import { Array as Arr } from "effect";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import {
  BufferAttribute,
  Color,
  Euler,
  MathUtils,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";

/** Played, the 36 hours pass in 18 seconds. */
const HOURS_PER_SECOND = 2;

/** Growth is shown a quarter of an hour at a time. */
const STEP_HOURS = 0.25;

/** How many hours after a sporangium forms it has darkened with ripe spores. */
const RIPENING = 6;

/** One millimetre of the tray in the stage's metres. */
const MILLIMETRE = 0.001;

/**
 * The room the beans and their mould take up, in millimetres: what the
 * camera frames, whatever hour is shown.
 */
const PATCH = {
  x: { max: TEMPEH.size / 2 + 1, min: -TEMPEH.size / 2 - 1 },
  y: { max: 3.6, min: 0 },
  z: { max: TEMPEH.size / 2 + 1, min: -TEMPEH.size / 2 - 1 },
} as const;

/** How far from the tray's middle the leaf starts to wave, and where it waves fully, in millimetres. */
const FLAT = { from: 19, to: 55 } as const;

/** How far the leaf's middle lies under the beans, so its vein ridges just touch them, in millimetres. */
const LEAF_DROP = 0.07;

/** How thick a spore stalk and how wide the sporangium on its tip is drawn. */
const STALK = { head: 0.2, radius: 0.028 } as const;

/**
 * The banana leaf the tempeh is made on: a wide blade whose parallel veins
 * run across it as fine ridges, flat under the beans and gently waved
 * farther out, as a cut leaf lies on a table.
 */
function Leaf() {
  const geometry = useMemo(() => {
    const blade = new PlaneGeometry(150, 110, 300, 24);
    blade.rotateX(-Math.PI / 2);
    const position = blade.getAttribute("position");
    for (const index of Arr.range(0, position.count - 1)) {
      const x = position.getX(index);
      const z = position.getZ(index);
      const vein = Math.cos((x + z * 0.18) * 5.2) * 0.07;
      const away = MathUtils.smoothstep(Math.hypot(x, z), FLAT.from, FLAT.to);
      const wave =
        (fractalAt(x / 150 + 0.5, z / 110 + 0.5, 3, 3, 12, 3) - 0.5) * 0.3;
      position.setY(index, vein + wave * away);
    }
    blade.computeVertexNormals();
    return blade;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} position={[0, -LEAF_DROP, 0]} receiveShadow>
      <SurfaceMaterial
        bump={0.5}
        coat={0.35}
        color={BIOLOGY_COLORS.bananaLeaf}
        repeat={[5, 4]}
        roughness={0.5}
        surface="leaf"
      />
    </mesh>
  );
}

/**
 * The split soybean halves, each sculpted as a real half: a rounded back, a
 * slightly hollow split face and a kidney outline. Some lie back up and
 * some face up, each turned its own way and a shade apart.
 */
function Beans() {
  const mesh = useRef<InstancedMesh>(null);
  const beans = useMemo(() => beansOf(), []);
  const geometry = useMemo(() => {
    const half = new SphereGeometry(1, 44, 30);
    const position = half.getAttribute("position");
    for (const index of Arr.range(0, position.count - 1)) {
      const [x, y, z] = beanPoint(
        position.getX(index),
        position.getY(index),
        position.getZ(index)
      );
      position.setXYZ(index, x, y, z);
    }
    half.computeVertexNormals();
    return half;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    const tint = new Color();
    Arr.forEach(beans, (bean, index) => {
      target.setMatrixAt(
        index,
        new Matrix4().compose(
          new Vector3(bean.x, bean.domed ? 0 : BEAN.high, bean.y),
          new Quaternion().setFromEuler(
            new Euler(bean.domed ? 0 : Math.PI, -bean.turn, 0, "YXZ")
          ),
          new Vector3(1, 1, 1)
        )
      );
      target.setColorAt(
        index,
        tint
          .set(ECOLOGY_COLORS.soybean)
          .lerp(
            new Color(ECOLOGY_COLORS.soybeanEdge),
            hashUnit(index, 9) * 0.35
          )
      );
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor !== null) {
      target.instanceColor.needsUpdate = true;
    }
  }, [beans]);

  return (
    <instancedMesh
      args={[geometry, undefined, beans.length]}
      castShadow
      receiveShadow
      ref={mesh}
    >
      <meshPhysicalMaterial
        clearcoat={0.3}
        clearcoatRoughness={0.4}
        roughness={0.52}
      />
    </instancedMesh>
  );
}

/**
 * The hyphae laid by the hour shown: every stretch a thin white tube draped
 * over the beans, all drawn as one mesh that shows only the stretches laid
 * so far.
 */
function Threads({
  segments,
  shown,
}: {
  readonly segments: readonly Segment[];
  readonly shown: number;
}) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    target.instanceMatrix.array.set(threadPlacements(segments, beansOf()));
    target.instanceMatrix.needsUpdate = true;
  }, [segments]);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (target !== null) {
      target.count = shown;
    }
  }, [shown]);

  return (
    <instancedMesh
      args={[undefined, undefined, segments.length]}
      frustumCulled={false}
      ref={mesh}
    >
      <cylinderGeometry args={[1, 1, 1, 4, 1, true]} />
      <meshStandardMaterial color={BIOLOGY_COLORS.hypha} roughness={0.9} />
    </instancedMesh>
  );
}

/**
 * The spore stalks the mould raises as it ages: thin sporangiophores, each
 * with a round sporangium on its tip that is white when it forms and
 * darkens as its spores ripen.
 */
function Stalks({
  hours,
  laid,
  segments,
}: {
  readonly hours: number;
  readonly laid: readonly number[];
  readonly segments: readonly Segment[];
}) {
  const stems = useRef<InstancedMesh>(null);
  const young = useRef<InstancedMesh>(null);
  const ripe = useRef<InstancedMesh>(null);
  const stalks = useMemo(
    () => stalksOf(segments, beansOf(), (index) => Number(laid[index])),
    [laid, segments]
  );
  const appearances = useMemo(
    () => Arr.map(stalks, (stalk) => stalk.appears),
    [stalks]
  );
  useLayoutEffect(() => {
    const up = new Vector3(0, 1, 0);
    Arr.forEach(stalks, (stalk, index) => {
      const foot = new Vector3(...stalk.foot);
      const rise = new Vector3(stalk.lean[0], 1, stalk.lean[1])
        .normalize()
        .multiplyScalar(stalk.height);
      const tip = foot.clone().add(rise);
      const turn = new Quaternion().setFromUnitVectors(
        up,
        rise.clone().normalize()
      );
      stems.current?.setMatrixAt(
        index,
        new Matrix4().compose(
          foot.clone().addScaledVector(rise, 0.5),
          turn,
          new Vector3(STALK.radius, stalk.height, STALK.radius)
        )
      );
      const head = new Matrix4().compose(
        tip,
        turn,
        new Vector3(STALK.head, STALK.head, STALK.head)
      );
      young.current?.setMatrixAt(index, head);
      ripe.current?.setMatrixAt(
        index,
        head.clone().scale(new Vector3(1.12, 1.12, 1.12))
      );
    });
    for (const mesh of [stems.current, young.current, ripe.current]) {
      if (mesh !== null) {
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }, [stalks]);
  useLayoutEffect(() => {
    const formed = shownBy(appearances, hours);
    if (stems.current !== null && young.current !== null) {
      stems.current.count = formed;
      young.current.count = formed;
    }
    if (ripe.current !== null) {
      ripe.current.count = shownBy(appearances, hours - RIPENING);
    }
  }, [appearances, hours]);

  return (
    <group>
      <instancedMesh
        args={[undefined, undefined, stalks.length]}
        frustumCulled={false}
        ref={stems}
      >
        <cylinderGeometry args={[1, 1.4, 1, 6, 1, true]} />
        <meshStandardMaterial color={BIOLOGY_COLORS.hypha} roughness={0.85} />
      </instancedMesh>
      <instancedMesh
        args={[undefined, undefined, stalks.length]}
        frustumCulled={false}
        ref={young}
      >
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial color={BIOLOGY_COLORS.hypha} roughness={0.7} />
      </instancedMesh>
      <instancedMesh
        args={[undefined, undefined, stalks.length]}
        frustumCulled={false}
        ref={ripe}
      >
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial
          color={BIOLOGY_COLORS.sporangium}
          roughness={0.8}
        />
      </instancedMesh>
    </group>
  );
}

/**
 * The cottony felt of aerial mycelium that thickens over the beans as the
 * mould covers them, until it binds them into one white cake: a soft sheet
 * draped over the beans, thinner in patches and toward the frame.
 */
function Felt({ cover }: { readonly cover: number }) {
  const fibres = useSurfaceMaps("cloth", 10, 10);
  const geometry = useMemo(() => {
    const beans = beansOf();
    const sheet = new PlaneGeometry(TEMPEH.size + 2, TEMPEH.size + 2, 96, 96);
    sheet.rotateX(-Math.PI / 2);
    const position = sheet.getAttribute("position");
    const tones = new Float32Array(position.count * 4);
    for (const index of Arr.range(0, position.count - 1)) {
      const x = position.getX(index);
      const z = position.getZ(index);
      const fluff = fractalAt(x / 32 + 0.5, z / 32 + 0.5, 9, 9, 4, 4);
      position.setY(
        index,
        Math.max(reliefAt(beans, x, z), 0.5) + 0.2 + fluff * 0.45
      );
      const edge = Math.max(Math.abs(x), Math.abs(z)) / (TEMPEH.size / 2 + 1);
      tones.set(
        [1, 1, 1, (0.55 + 0.45 * fluff) * (1 - Math.max(0, edge - 0.9) * 10)],
        index * 4
      );
    }
    sheet.setAttribute("color", new BufferAttribute(tones, 4));
    sheet.computeVertexNormals();
    return sheet;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} renderOrder={2}>
      <meshStandardMaterial
        color={BIOLOGY_COLORS.hypha}
        depthWrite={false}
        normalMap={fibres.normal}
        opacity={Math.min(1, cover * cover * 0.92)}
        roughness={1}
        transparent
        vertexColors
      />
    </mesh>
  );
}

/**
 * Tempeh in the making on its banana leaf, at real size in metres: split
 * soybean halves laid one layer deep, the hyphae laid by the hour shown
 * draped over them, the spore stalks the ageing mould raises, and the white
 * felt that binds the beans into one cake. Played, the hours move on and
 * reach the card.
 *
 * @param cover - The share of the tray the mould has reached, from 0 to 1
 * @param hours - The hour shown
 * @param laid - The hour each stretch of hypha was laid, in the order they were laid
 * @param onHours - Tells the card the hour the playing scene has reached
 * @param segments - Every stretch of hypha of the whole run, in the order they were laid
 * @param shown - How many of those stretches the hour shown has laid
 */
export function TempehScene({
  cover,
  hours,
  laid,
  onHours,
  segments,
  shown,
}: {
  readonly cover: number;
  readonly hours: number;
  readonly laid: readonly number[];
  readonly onHours: (hours: number) => void;
  readonly segments: readonly Segment[];
  readonly shown: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const clock = useRef(hours);
  const sent = useRef(hours);

  useEffect(() => {
    if (hours !== sent.current) {
      clock.current = hours;
      sent.current = hours;
    }
  }, [hours]);

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    clock.current += Math.min(delta, 0.1) * HOURS_PER_SECOND;
    if (clock.current > TEMPEH.hours + 2) {
      clock.current = 0;
    }
    const rounded =
      Math.round(Math.min(TEMPEH.hours, clock.current) / STEP_HOURS) *
      STEP_HOURS;
    if (rounded !== sent.current) {
      sent.current = rounded;
      onHours(rounded);
    }
  });

  return (
    <group scale={MILLIMETRE}>
      <SimulationTicker running={playing} />
      <CameraBounds exclude>
        <Leaf />
      </CameraBounds>
      <CameraBounds bounds={PATCH}>
        <Beans />
        <Threads segments={segments} shown={shown} />
        <Stalks hours={hours} laid={laid} segments={segments} />
        <Felt cover={cover} />
      </CameraBounds>
    </group>
  );
}
