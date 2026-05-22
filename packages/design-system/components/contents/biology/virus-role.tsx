"use client";

import type {
  BiologyLabProps,
  BiologySceneProps,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import {
  FloatingGroup,
  PulsingGroup,
  RotatingGroup,
  SlidingGroup,
} from "@repo/design-system/components/contents/biology/parts";
import {
  BacteriophageModel,
  MiniEnvelopedVirion,
} from "@repo/design-system/components/contents/biology/virus-parts";
import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";

/**
 * Renders the virus role lab with pathogenic, ecological, and biotechnology modes.
 */
export function VirusRoleLab(props: BiologyLabProps) {
  return <BiologyLabFrame scene={VirusRoleScene} {...props} />;
}

/**
 * Changes the whole scene so students do not read all virus roles as disease.
 */
function VirusRoleScene({ colors, selectedIndex }: BiologySceneProps) {
  if (selectedIndex === 1) {
    return <EcologyRole colors={colors} />;
  }

  if (selectedIndex === 2) {
    return <BiotechRole colors={colors} />;
  }

  return <PathogenRole colors={colors} />;
}

/**
 * Shows virus damage as a host cell with many pathogen particles.
 */
function PathogenRole({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <mesh scale={[1.2, 0.78, 0.78]}>
        <sphereGeometry args={[1, 40, 24]} />
        <meshStandardMaterial color={colors.host} opacity={0.2} transparent />
      </mesh>
      {[-0.8, -0.38, 0.05, 0.52, 0.9].map((x, index) => (
        <FloatingGroup key={x} phase={index * 0.55} travel={0.08}>
          <group position={[x, 0.35 - Math.abs(x) * 0.24, 0.42]}>
            <MiniEnvelopedVirion colors={colors} scale={0.75} />
          </group>
        </FloatingGroup>
      ))}
    </group>
  );
}

/**
 * Shows bacteriophages linking viruses to microbial population control.
 */
function EcologyRole({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      {[-1.1, 0, 1.1].map((x) => (
        <mesh key={x} position={[x, -0.1, 0]} scale={[0.36, 0.8, 0.36]}>
          <capsuleGeometry args={[0.32, 0.95, 8, 18]} />
          <meshStandardMaterial
            color={colors.microbe}
            opacity={0.72}
            transparent
          />
        </mesh>
      ))}
      <ArrowHelper
        arrowSize={0.12}
        color={colors.arrow}
        from={[-0.72, 0.58, 0.12]}
        to={[-0.92, 0.18, 0.12]}
      />
      <SlidingGroup speed={0.8} travel={0.2}>
        <group position={[-0.72, 0.66, 0.12]} rotation={[0, 0, -0.5]}>
          <BacteriophageModel colors={colors} scale={0.78} />
        </group>
      </SlidingGroup>
    </group>
  );
}

/**
 * Shows a viral vector carrying a gene into a target cell.
 */
function BiotechRole({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <mesh position={[0.9, 0, 0]} scale={[0.82, 0.62, 0.62]}>
        <sphereGeometry args={[1, 40, 24]} />
        <meshStandardMaterial color={colors.host} opacity={0.24} transparent />
      </mesh>
      <SlidingGroup speed={0.9} travel={0.18}>
        <group position={[-0.95, 0.1, 0]}>
          <RotatingGroup speed={0.3}>
            <MiniEnvelopedVirion colors={colors} scale={1.1} />
          </RotatingGroup>
          <PulsingGroup speed={1.7} strength={0.06}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.18, 0.018, 8, 48]} />
              <meshStandardMaterial color={colors.genome} />
            </mesh>
          </PulsingGroup>
        </group>
      </SlidingGroup>
      <ArrowHelper
        arrowSize={0.16}
        color={colors.arrow}
        from={[-0.52, 0.1, 0]}
        lineWidth={3}
        to={[0.36, 0.04, 0]}
      />
    </group>
  );
}
