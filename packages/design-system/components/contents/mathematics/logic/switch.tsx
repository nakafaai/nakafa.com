import type { ThreeEvent } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import { swing } from "@repo/design-system/components/contents/mathematics/logic/motion";
import {
  BASE_TOP,
  PartBase,
  Post,
} from "@repo/design-system/components/contents/mathematics/logic/parts";
import {
  KNIFE,
  PARTS,
} from "@repo/design-system/components/contents/mathematics/logic/rig";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";

/** How far a pointer may travel between press and release and still count as a click, in pixels. */
const CLICK_SLOP = 6;

/** The pair of brass cheeks that hold the blade, at the hinge and at the jaw. */
function Cheeks({
  height,
  x,
}: {
  readonly height: number;
  readonly x: number;
}) {
  return (
    <>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          castShadow
          key={side}
          position={[x, BASE_TOP + height / 2, side * 0.0019]}
        >
          <boxGeometry args={[0.0034, height, 0.0012]} />
          <Matter of="brass" />
        </mesh>
      ))}
    </>
  );
}

/** A flat brass strap on the base from a post to the hinge or the jaw. */
function Strap({ from, to }: { readonly from: number; readonly to: number }) {
  return (
    <mesh position={[(from + to) / 2, BASE_TOP + 0.0003, 0]} receiveShadow>
      <boxGeometry args={[Math.abs(to - from), 0.0006, 0.0052]} />
      <Matter of="brass" />
    </mesh>
  );
}

/**
 * A single pole knife switch on a black base: a brass blade hinged at one
 * end that drops into a brass jaw to close the circuit, thrown by its black
 * handle. Closed, the blade lies level in the jaw; open, it stands up at 60
 * degrees. Pressing the switch throws it.
 */
export function KnifeSwitch({
  closed,
  onToggle,
}: {
  readonly closed: boolean;
  readonly onToggle: () => void;
}) {
  const { depth, length, reach } = PARTS.switch;
  const blade = useRef<Group>(null);
  const angle = useRef(closed ? 0 : KNIFE.open);

  useFrame((state, delta) => {
    const target = closed ? 0 : KNIFE.open;
    const next = swing(angle.current, target, Math.min(delta, 0.1));
    angle.current = next;
    if (blade.current !== null) {
      blade.current.rotation.z = next;
    }
    if (next !== target) {
      state.invalidate();
    }
  });

  const press = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > CLICK_SLOP) {
      return;
    }
    event.stopPropagation();
    onToggle();
  };

  return (
    <group>
      <PartBase depth={depth} length={length} />
      <Strap from={-reach} to={KNIFE.hinge} />
      <Strap from={KNIFE.jaw} to={reach} />
      <Cheeks height={KNIFE.lift + 0.0025} x={KNIFE.hinge} />
      <Cheeks height={KNIFE.lift + 0.0032} x={KNIFE.jaw} />
      <group
        position={[KNIFE.hinge, BASE_TOP + KNIFE.lift, 0]}
        ref={blade}
        rotation={[0, 0, angle.current]}
      >
        <mesh castShadow position={[KNIFE.blade / 2, 0, 0]}>
          <boxGeometry args={[KNIFE.blade, 0.0048, 0.0013]} />
          <Matter of="brass" />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.0011, 0.0011, 0.0062, 12]} />
          <Matter of="brass" />
        </mesh>
        <group position={[KNIFE.blade - 0.0035, 0.0024, 0]}>
          <mesh castShadow position={[0, 0.006, 0]}>
            <cylinderGeometry args={[0.0028, 0.0034, 0.012, 20]} />
            <Matter of="bakelite" />
          </mesh>
          <mesh castShadow position={[0, 0.0125, 0]}>
            <sphereGeometry args={[0.0036, 20, 14]} />
            <Matter of="bakelite" />
          </mesh>
        </group>
      </group>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a three.js mesh takes pointer events, not focus; the toolbar toggle is the keyboard and screen reader control for the same switch. */}
      <mesh onClick={press} position={[0, BASE_TOP + 0.016, 0]} visible={false}>
        <boxGeometry args={[length, 0.036, depth]} />
      </mesh>
      <Post x={-reach} />
      <Post x={reach} />
    </group>
  );
}
