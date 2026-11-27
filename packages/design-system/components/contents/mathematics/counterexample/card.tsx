import { PrintFace } from "@repo/design-system/components/three/print/layer";
import type { Sheet } from "@repo/design-system/components/three/print/sheet";
import { words } from "@repo/design-system/components/three/print/sheet";
import { COUNTEREXAMPLE_COLORS } from "@repo/design-system/lib/material/counterexample";
import { Schema } from "effect";
import type { Ref } from "react";
import { useMemo } from "react";
import type { Group } from "three";

/** The claim card: how tall each of its two panels is, how far they lean, and how thick the card stock is, in metres and radians. */
export const CARD = { height: 0.11, lean: 0.42, thickness: 0.0016 } as const;

/** The share of the card's width the stamp takes at its right end. */
const STAMP_SHARE = 0.3;

/** The blank margin round the print, as a share of the card's height. */
const PADDING = 0.14;

/** The stamp's printed face: its height on the card, and its width for each unit of height. */
const STAMP = { aspect: 16 / 7, height: CARD.height * 0.5 } as const;

/** The stamp's word, such as "False", and the ink it is printed in. */
const StampSchema = Schema.Struct({ ink: Schema.String, word: Schema.String });

/**
 * The claim as printed on the card's face: the largest type at which the
 * whole claim fits beside the stamp's place, set in lines from the left,
 * centred from top to bottom.
 */
function claimSheet(text: string, width: number, stamped: boolean): Sheet {
  const pad = CARD.height * PADDING;
  return {
    ground: COUNTEREXAMPLE_COLORS.card,
    height: CARD.height,
    marks: [
      words({
        align: "start",
        at: [-width / 2 + pad, 0],
        box: {
          height: CARD.height - 2 * pad,
          leading: 1.2,
          smallest: CARD.height * 0.12,
          width: width * (stamped ? 1 - STAMP_SHARE : 1) - 2 * pad,
        },
        ink: COUNTEREXAMPLE_COLORS.print,
        size: CARD.height * 0.3,
        text,
        weight: 600,
      }),
    ],
    width,
  };
}

/** The stamp's word in a rounded frame, as a rubber stamp prints it, as large as the frame allows. */
function stampSheet(word: string, ink: string): Sheet {
  const width = STAMP.height * STAMP.aspect;
  const line = STAMP.height / 16;
  return {
    height: STAMP.height,
    marks: [
      {
        at: [0, 0],
        height: STAMP.height - 2 * line,
        ink,
        kind: "frame",
        line,
        radius: STAMP.height * 0.15,
        width: width - 2 * line,
      },
      words({
        at: [0, 0],
        box: {
          height: STAMP.height,
          leading: 1,
          smallest: STAMP.height * 0.2,
          width: width - 7 * line,
        },
        ink,
        size: STAMP.height * 0.54,
        text: word,
        weight: 800,
      }),
    ],
    width,
  };
}

/**
 * The claim printed on a white tent card that stands on the table, its face
 * leaning back towards the camera, and the rubber stamp on its right end
 * that says whether the claim is true of the tiles. The scene brings the
 * stamp down through `ref`, so it starts hidden; a card whose answer stays
 * hidden has no stamp, and the claim takes its whole width.
 */
export function ClaimCard({
  ref,
  stamp,
  text,
  width,
}: {
  readonly ref: Ref<Group>;
  readonly stamp: typeof StampSchema.Type | undefined;
  readonly text: string;
  readonly width: number;
}) {
  const stamped = stamp !== undefined;
  const face = useMemo(
    () => claimSheet(text, width, stamped),
    [stamped, text, width]
  );
  const back = Math.sin(CARD.lean) * CARD.height;

  return (
    <group>
      <group rotation={[-CARD.lean, 0, 0]}>
        <mesh castShadow position={[0, CARD.height / 2, 0]} receiveShadow>
          <boxGeometry args={[width, CARD.height, CARD.thickness]} />
          <meshStandardMaterial
            color={COUNTEREXAMPLE_COLORS.card}
            roughness={0.8}
          />
        </mesh>
        <group position={[0, CARD.height / 2, CARD.thickness / 2 + 0.0004]}>
          <PrintFace sheet={face} stock="paper" />
        </group>
        {stamp === undefined ? null : (
          <group
            position={[
              width / 2 - (width * STAMP_SHARE) / 2,
              CARD.height / 2,
              CARD.thickness / 2 + 0.0009,
            ]}
            ref={ref}
            visible={false}
          >
            <StampFace ink={stamp.ink} word={stamp.word} />
          </group>
        )}
      </group>
      <mesh
        castShadow
        position={[0, (Math.cos(CARD.lean) * CARD.height) / 2, -1.5 * back]}
        rotation={[CARD.lean, 0, 0]}
      >
        <boxGeometry args={[width, CARD.height, CARD.thickness]} />
        <meshStandardMaterial
          color={COUNTEREXAMPLE_COLORS.card}
          roughness={0.8}
        />
      </mesh>
    </group>
  );
}

/** The inked face of the rubber stamp, turned a little, as a hand stamps it. */
function StampFace({
  ink,
  word,
}: {
  readonly ink: string;
  readonly word: string;
}) {
  const sheet = useMemo(() => stampSheet(word, ink), [ink, word]);

  return (
    <group rotation={[0, 0, 0.12]}>
      <PrintFace sheet={sheet} stock="ink" />
    </group>
  );
}
