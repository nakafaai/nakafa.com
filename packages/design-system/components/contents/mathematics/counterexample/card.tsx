import { usePrintFont } from "@repo/design-system/components/contents/mathematics/counterexample/print";
import { fitText } from "@repo/design-system/components/contents/mathematics/counterexample/wrap";
import { COUNTEREXAMPLE_COLORS } from "@repo/design-system/lib/material/counterexample";
import { Array as Arr, Schema } from "effect";
import type { Ref } from "react";
import { useEffect, useMemo } from "react";
import type { Group } from "three";
import { CanvasTexture, SRGBColorSpace } from "three";

/** The claim card: how tall each of its two panels is, how far they lean, and how thick the card stock is, in metres and radians. */
export const CARD = { height: 0.11, lean: 0.42, thickness: 0.0016 } as const;

/** How many pixels the printed face has across the card's width. */
const CARD_PIXELS = 1024;

/** The share of the card's width the stamp takes at its right end. */
const STAMP_SHARE = 0.3;

/** The blank margin round the print, as a share of the card's height. */
const PADDING = 0.14;

/** The stamp's printed face, in pixels. */
const STAMP_PIXELS = { height: 224, width: 512 } as const;

/** The stamp's word, such as "False", and the ink it is printed in. */
const StampSchema = Schema.Struct({ ink: Schema.String, word: Schema.String });

/** A canvas of a given size, with its texture and its 2D context. */
function printSurface(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return { context: canvas.getContext("2d"), texture };
}

/**
 * Prints the claim on the card's face: the largest type at which the whole
 * claim fits beside the stamp's place, set in lines from the left, centred
 * from top to bottom.
 */
function claimTexture(
  text: string,
  family: string,
  width: number,
  stamped: boolean
) {
  const pixels = {
    height: Math.round((CARD_PIXELS * CARD.height) / width),
    width: CARD_PIXELS,
  };
  const { context, texture } = printSurface(pixels.width, pixels.height);
  if (context === null) {
    return texture;
  }
  context.fillStyle = COUNTEREXAMPLE_COLORS.card;
  context.fillRect(0, 0, pixels.width, pixels.height);
  const pad = pixels.height * PADDING;
  const box = {
    height: pixels.height - 2 * pad,
    leading: 1.2,
    width: pixels.width * (stamped ? 1 - STAMP_SHARE : 1) - 2 * pad,
  };
  context.font = `600 100px ${family}`;
  const setting = fitText(
    text,
    box,
    { largest: pixels.height * 0.3, smallest: pixels.height * 0.12 },
    (line) => context.measureText(line).width / 100
  );
  context.font = `600 ${setting.size}px ${family}`;
  context.fillStyle = COUNTEREXAMPLE_COLORS.print;
  context.textBaseline = "middle";
  const top =
    pixels.height / 2 -
    ((setting.lines.length - 1) * setting.size * box.leading) / 2;
  Arr.forEach(setting.lines, (line, index) => {
    context.fillText(line, pad, top + index * setting.size * box.leading);
  });
  texture.needsUpdate = true;
  return texture;
}

/** Inks the stamp's word in a rounded frame, as a rubber stamp prints it. */
function stampTexture(word: string, ink: string, family: string) {
  const { context, texture } = printSurface(
    STAMP_PIXELS.width,
    STAMP_PIXELS.height
  );
  if (context === null) {
    return texture;
  }
  context.strokeStyle = ink;
  context.fillStyle = ink;
  context.lineWidth = 14;
  context.beginPath();
  context.roundRect(
    12,
    12,
    STAMP_PIXELS.width - 24,
    STAMP_PIXELS.height - 24,
    34
  );
  context.stroke();
  context.font = `800 100px ${family}`;
  const size = Math.min(
    120,
    (100 * (STAMP_PIXELS.width - 96)) /
      Math.max(1, context.measureText(word).width)
  );
  context.font = `800 ${size}px ${family}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(
    word,
    STAMP_PIXELS.width / 2,
    STAMP_PIXELS.height / 2 + size * 0.05
  );
  texture.needsUpdate = true;
  return texture;
}

/** A texture made for a set of inputs, freed once those change or its part leaves the scene. */
function useFreed(texture: CanvasTexture) {
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
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
  const family = usePrintFont();
  const stamped = stamp !== undefined;
  const face = useFreed(
    useMemo(
      () => claimTexture(text, family, width, stamped),
      [family, stamped, text, width]
    )
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
        <mesh position={[0, CARD.height / 2, CARD.thickness / 2 + 0.0004]}>
          <planeGeometry args={[width, CARD.height]} />
          <meshStandardMaterial map={face} roughness={0.8} />
        </mesh>
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
            <StampFace family={family} ink={stamp.ink} word={stamp.word} />
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
  family,
  ink,
  word,
}: {
  readonly family: string;
  readonly ink: string;
  readonly word: string;
}) {
  const texture = useFreed(
    useMemo(() => stampTexture(word, ink, family), [family, ink, word])
  );
  const height = CARD.height * 0.5;

  return (
    <mesh rotation={[0, 0, 0.12]}>
      <planeGeometry
        args={[(height * STAMP_PIXELS.width) / STAMP_PIXELS.height, height]}
      />
      <meshStandardMaterial
        depthWrite={false}
        map={texture}
        polygonOffset
        polygonOffsetFactor={-2}
        roughness={0.9}
        transparent
      />
    </mesh>
  );
}
