import { Line, RoundedBox } from "@react-three/drei";
import type {
  ScenePoint,
  VectorConceptLabLabels,
  VectorConceptSceneColors,
  VectorConceptState,
} from "@repo/design-system/components/contents/physics/vector/concept/data";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";
import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";
import { THREE_FONT_SIZE } from "@repo/design-system/components/three/data/constants";

export function VectorConceptScene({
  colors,
  labels,
  vectorState,
}: {
  colors: VectorConceptSceneColors;
  labels: Pick<VectorConceptLabLabels, "leftCable" | "rightCable">;
  vectorState: VectorConceptState;
}) {
  const { left, loadPoint, right } = vectorState;

  return (
    <group position={[0, -0.04, 0]} rotation={[-0.06, -0.22, 0]} scale={1.08}>
      <BridgeStructure colors={colors} />
      <Line
        color={colors.cable}
        lineWidth={2}
        points={[loadPoint, left.anchor]}
      />
      <Line
        color={colors.cable}
        lineWidth={2}
        points={[loadPoint, right.anchor]}
      />
      <LoadCart
        color={colors.load}
        detailColor={colors.loadDetail}
        hubColor={colors.tower}
        position={loadPoint}
        wheelColor={colors.wheel}
      />

      <ArrowHelper
        arrowSize={0.16}
        color={colors.leftVector}
        from={loadPoint}
        lineWidth={4}
        to={left.arrowEnd}
      />
      <ArrowHelper
        arrowSize={0.16}
        color={colors.rightVector}
        from={loadPoint}
        lineWidth={4}
        to={right.arrowEnd}
      />

      <SceneLabel
        color={colors.leftVector}
        fontSize={THREE_FONT_SIZE.reading}
        position={left.labelPoint}
      >
        {`${labels.leftCable} ${Math.round(left.tension)} N`}
      </SceneLabel>
      <SceneLabel
        color={colors.rightVector}
        fontSize={THREE_FONT_SIZE.reading}
        position={right.labelPoint}
      >
        {`${labels.rightCable} ${Math.round(right.tension)} N`}
      </SceneLabel>
    </group>
  );
}

function BridgeStructure({ colors }: { colors: VectorConceptSceneColors }) {
  return (
    <group>
      <RoundedBox args={[5.2, 0.18, 0.78]} position={[0, 0, 0]} radius={0.04}>
        <meshStandardMaterial color={colors.deck} roughness={0.62} />
      </RoundedBox>
      {[-2.15, 2.15].map((x) => (
        <group key={`tower-${x}`} position={[x, 1.1, 0]}>
          <mesh castShadow position={[-0.1, 0, 0]}>
            <boxGeometry args={[0.16, 2.2, 0.18]} />
            <meshStandardMaterial color={colors.tower} roughness={0.48} />
          </mesh>
          <mesh castShadow position={[0.1, 0, 0]}>
            <boxGeometry args={[0.16, 2.2, 0.18]} />
            <meshStandardMaterial color={colors.tower} roughness={0.48} />
          </mesh>
          <mesh castShadow position={[0, 0.58, 0]}>
            <boxGeometry args={[0.48, 0.12, 0.2]} />
            <meshStandardMaterial color={colors.tower} roughness={0.48} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function LoadCart({
  color,
  detailColor,
  hubColor,
  position,
  wheelColor,
}: {
  color: string;
  detailColor: string;
  hubColor: string;
  position: ScenePoint;
  wheelColor: string;
}) {
  const wheelPositions = [-0.22, 0.22].flatMap((x) =>
    [-0.32, 0.32].map((z) => [x, z] as const)
  );

  return (
    <group position={[position[0], position[1] + 0.03, position[2]]}>
      <RoundedBox
        args={[0.66, 0.28, 0.52]}
        castShadow
        radius={0.05}
        smoothness={4}
      >
        <meshStandardMaterial color={color} roughness={0.5} />
      </RoundedBox>
      <RoundedBox
        args={[0.54, 0.08, 0.42]}
        castShadow
        position={[0, 0.17, 0]}
        radius={0.04}
        smoothness={3}
      >
        <meshStandardMaterial color={detailColor} roughness={0.55} />
      </RoundedBox>
      {[-0.22, 0.22].map((x) => (
        <mesh
          castShadow
          key={`axle-${x}`}
          position={[x, -0.18, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.024, 0.024, 0.76, 16]} />
          <meshStandardMaterial color={wheelColor} roughness={0.58} />
        </mesh>
      ))}
      {wheelPositions.map(([x, z]) => (
        <LoadCartWheel
          color={wheelColor}
          hubColor={hubColor}
          key={`wheel-${x}-${z}`}
          position={[x, -0.18, z] satisfies ScenePoint}
        />
      ))}
    </group>
  );
}

function LoadCartWheel({
  color,
  hubColor,
  position,
}: {
  color: string;
  hubColor: string;
  position: ScenePoint;
}) {
  return (
    <group position={position} rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.09, 0.09, 0.07, 28]} />
        <meshStandardMaterial color={color} roughness={0.54} />
      </mesh>
      <mesh position={[0, 0, 0.038]}>
        <cylinderGeometry args={[0.038, 0.038, 0.01, 20]} />
        <meshStandardMaterial color={hubColor} roughness={0.48} />
      </mesh>
    </group>
  );
}
