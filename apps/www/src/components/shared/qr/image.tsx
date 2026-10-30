import { cva } from "class-variance-authority";
import { qrSquares } from "@/components/shared/qr/code";

/** How large a QR code draws: beside a printed login card, or across a room for every phone to scan. */
const qrImage = cva("shrink-0", {
  variants: {
    size: { card: "size-24", room: "size-56 sm:size-64" },
  },
});

/**
 * A QR code drawn in dark modules on a white quiet zone, so every reader scans it in any theme.
 * It holds `text` alone, and `label` names it for assistive technology.
 */
export function QrImage({
  label,
  size,
  text,
}: {
  label: string;
  size: "card" | "room";
  text: string;
}) {
  const { path, size: modules } = qrSquares(text);
  const quiet = 4;

  return (
    <svg
      aria-label={label}
      className={qrImage({ size })}
      role="img"
      shapeRendering="crispEdges"
      viewBox={`${-quiet} ${-quiet} ${modules + quiet * 2} ${modules + quiet * 2}`}
    >
      <rect
        fill="#ffffff"
        height={modules + quiet * 2}
        width={modules + quiet * 2}
        x={-quiet}
        y={-quiet}
      />
      <path d={path} fill="#000000" />
    </svg>
  );
}
