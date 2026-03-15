import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { getColor } from "@repo/design-system/lib/color";

export function Graph() {
  // Define vertices of the cube
  const s = 4;
  const A = { x: s, y: 0, z: 0 };
  const B = { x: s, y: s, z: 0 };
  const C = { x: 0, y: s, z: 0 };
  const D = { x: 0, y: 0, z: 0 };
  const E = { x: s, y: 0, z: s };
  const F = { x: s, y: s, z: s };
  const G = { x: 0, y: s, z: s };
  const H = { x: 0, y: 0, z: s };

  // Point Q is midpoint of FG
  const Q = {
    x: (F.x + G.x) / 2,
    y: (F.y + G.y) / 2,
    z: (F.z + G.z) / 2,
  };

  // Helper to calculate midpoint for labels
  const mid = (p1: typeof A, p2: typeof A) => ({
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    z: (p1.z + p2.z) / 2,
  });

  // Point O is projection of Q on BD
  const O = { x: 3, y: 3, z: 0 };

  const common = { showPoints: false };

  return (
    <LineEquation
      cameraPosition={[9, 6, 9]}
      data={[
        // Bottom Face
        {
          ...common,
          points: [D, mid(D, A), A],
          color: getColor("INDIGO"),
          labels: [
            { text: "D", at: 0, offset: [-0.3, -0.3, 0] },
            { text: "4", at: 1, offset: [0, -0.3, 0] },
            { text: "A", at: 2, offset: [0.3, -0.3, 0] },
          ],
        },
        {
          ...common,
          points: [A, mid(A, B), B],
          color: getColor("INDIGO"),
          labels: [{ text: "4", at: 1, offset: [0.3, 0, 0] }],
        },
        {
          ...common,
          points: [B, mid(B, C), C],
          color: getColor("INDIGO"),
          labels: [
            { text: "B", at: 0, offset: [0.3, 0.3, 0] },
            { text: "4", at: 1, offset: [0, 0.3, 0] },
            { text: "C", at: 2, offset: [-0.3, 0.3, 0] },
          ],
        },
        {
          ...common,
          points: [C, mid(C, D), D],
          color: getColor("INDIGO"),
          labels: [{ text: "4", at: 1, offset: [-0.3, 0, 0] }],
        },

        // Top Face
        {
          ...common,
          points: [H, mid(H, E), E],
          color: getColor("INDIGO"),
          labels: [
            { text: "H", at: 0, offset: [-0.3, -0.3, 0.3] },
            { text: "4", at: 1, offset: [0, -0.3, 0.3] },
            { text: "E", at: 2, offset: [0.3, -0.3, 0.3] },
          ],
        },
        {
          ...common,
          points: [E, mid(E, F), F],
          color: getColor("INDIGO"),
          labels: [{ text: "4", at: 1, offset: [0.3, 0, 0.3] }],
        },
        {
          ...common,
          points: [F, mid(F, Q), Q],
          color: getColor("INDIGO"),
          labels: [
            { text: "F", at: 0, offset: [0.3, 0.3, 0.3] },
            { text: "2", at: 1, offset: [0, 0.3, 0.3] },
          ],
        },
        {
          ...common,
          points: [Q, mid(Q, G), G],
          color: getColor("INDIGO"),
          labels: [
            { text: "2", at: 1, offset: [0, 0.3, 0.3] },
            { text: "G", at: 2, offset: [-0.3, 0.3, 0.3] },
          ],
        },
        {
          ...common,
          points: [G, mid(G, H), H],
          color: getColor("INDIGO"),
          labels: [{ text: "4", at: 1, offset: [-0.3, 0, 0.3] }],
        },

        // Vertical Edges
        {
          ...common,
          points: [D, mid(D, H), H],
          color: getColor("INDIGO"),
          labels: [{ text: "4", at: 1, offset: [-0.3, -0.3, 0] }],
        },
        {
          ...common,
          points: [A, mid(A, E), E],
          color: getColor("INDIGO"),
          labels: [{ text: "4", at: 1, offset: [0.3, -0.3, 0] }],
        },
        {
          ...common,
          points: [B, mid(B, F), F],
          color: getColor("INDIGO"),
          labels: [{ text: "4", at: 1, offset: [0.3, 0.3, 0] }],
        },
        {
          ...common,
          points: [C, mid(C, G), G],
          color: getColor("INDIGO"),
          labels: [{ text: "4", at: 1, offset: [-0.3, 0.3, 0] }],
        },

        // Diagonal BD
        { ...common, points: [B, D], color: getColor("ORANGE") },

        // Triangle DBQ Lines
        {
          ...common,
          points: [D, mid(D, Q), Q],
          color: getColor("TEAL"),
          labels: [
            { text: "6", at: 1, offset: [-0.3, 0.3, 0] },
            { text: "Q", at: 2, offset: [0, 0.3, 0.3] },
          ],
        },
        {
          ...common,
          points: [B, mid(B, Q), Q],
          color: getColor("TEAL"),
          labels: [{ text: "2√5", at: 1, offset: [0.3, 0, 0] }],
        },

        // Line HQ (from image)
        {
          ...common,
          points: [H, mid(H, Q), Q],
          color: getColor("VIOLET"),
          labels: [{ text: "2√5", at: 1, offset: [0, 0, 0.3] }],
        },

        // Height Line QO
        {
          ...common,
          points: [Q, mid(Q, O), O],
          color: getColor("ROSE"),
          labels: [
            { text: "y", at: 1, offset: [0.2, 0, 0] },
            { text: "O", at: 2, offset: [0.2, 0.2, 0] },
          ],
        },
      ]}
      description={
        <>
          Visualisasi kubus dan jarak titik <InlineMath math="Q" /> ke garis{" "}
          <InlineMath math="BD" />.
        </>
      }
      title={
        <>
          Kubus <InlineMath math="ABCD.EFGH" />
        </>
      }
    />
  );
}
