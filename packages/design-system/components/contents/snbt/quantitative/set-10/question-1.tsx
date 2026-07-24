import { LineEquation } from "@repo/design-system/components/contents/mathematics/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps } from "react";

interface GraphProps
  extends Pick<ComponentProps<typeof LineEquation>, "title" | "description"> {
  mode?:
    | "question"
    | "explanation-numbers"
    | "explanation-result"
    | "explanation-final";
}

const T1_CENTER_X = -6;
const T2_CENTER_X = 6;
const SCALE = 1.2;

const TOP = { x: 0, y: 3 * SCALE, z: 0 };
const BOTTOM_LEFT = { x: -2.5 * SCALE, y: -2 * SCALE, z: 0 };
const BOTTOM_RIGHT = { x: 2.5 * SCALE, y: -2 * SCALE, z: 0 };

const t1Points = [
  { x: T1_CENTER_X + TOP.x, y: TOP.y, z: 0 },
  { x: T1_CENTER_X + BOTTOM_LEFT.x, y: BOTTOM_LEFT.y, z: 0 },
  { x: T1_CENTER_X + BOTTOM_RIGHT.x, y: BOTTOM_RIGHT.y, z: 0 },
  { x: T1_CENTER_X + TOP.x, y: TOP.y, z: 0 },
];

const t2Points = [
  { x: T2_CENTER_X + TOP.x, y: TOP.y, z: 0 },
  { x: T2_CENTER_X + BOTTOM_LEFT.x, y: BOTTOM_LEFT.y, z: 0 },
  { x: T2_CENTER_X + BOTTOM_RIGHT.x, y: BOTTOM_RIGHT.y, z: 0 },
  { x: T2_CENTER_X + TOP.x, y: TOP.y, z: 0 },
];

const offTop = [0, 0.5, 0] satisfies [number, number, number];
const offLeft = [-1.25 * SCALE - 0.6, -2.5 * SCALE, 0] satisfies [
  number,
  number,
  number,
];
const offRight = [1.25 * SCALE + 0.6, -2.5 * SCALE, 0] satisfies [
  number,
  number,
  number,
];
const offBottom = [0, -5 * SCALE - 0.6, 0] satisfies [number, number, number];
const offCenter = [0, -3.5 * SCALE, 0] satisfies [number, number, number];

const triangleTextByMode = {
  question: {
    t1Text: { top: "A", left: "D", right: "F", bottom: "A", center: "T" },
    t2Text: { top: "B", left: "A", right: "D", bottom: "C", center: "?" },
  },
  "explanation-numbers": {
    t1Text: { top: "1", left: "4", right: "6", bottom: "1", center: "20" },
    t2Text: { top: "2", left: "1", right: "4", bottom: "3", center: "?" },
  },
  "explanation-result": {
    t1Text: { top: "1", left: "4", right: "6", bottom: "1", center: "20" },
    t2Text: { top: "2", left: "1", right: "4", bottom: "3", center: "25" },
  },
  "explanation-final": {
    t1Text: { top: "A", left: "D", right: "F", bottom: "A", center: "T" },
    t2Text: { top: "B", left: "A", right: "D", bottom: "C", center: "Y" },
  },
};

/** Renders the quantitative graph for SNBT set 10 question 1. */
export function Graph({ title, description, mode = "question" }: GraphProps) {
  const { t1Text, t2Text } = triangleTextByMode[mode];
  const data: ComponentProps<typeof LineEquation>["data"] = [
    {
      points: t1Points,
      color: getColor("INDIGO"),
      smooth: false,
      showPoints: false,
      labels: [
        { text: t1Text.top, at: 0, offset: offTop },
        { text: t1Text.left, at: 0, offset: offLeft },
        { text: t1Text.right, at: 0, offset: offRight },
        { text: t1Text.bottom, at: 0, offset: offBottom },
        {
          text: t1Text.center,
          at: 0,
          offset: offCenter,
          color: getColor("INDIGO"),
        },
      ],
    },
    {
      points: t2Points,
      color: getColor("ROSE"),
      smooth: false,
      showPoints: false,
      labels: [
        { text: t2Text.top, at: 0, offset: offTop },
        { text: t2Text.left, at: 0, offset: offLeft },
        { text: t2Text.right, at: 0, offset: offRight },
        { text: t2Text.bottom, at: 0, offset: offBottom },
        {
          text: t2Text.center,
          at: 0,
          offset: offCenter,
          color: getColor("ROSE"),
        },
      ],
    },
  ];

  return (
    <LineEquation
      cameraPosition={[0, 0, 15]}
      data={data}
      description={description}
      showZAxis={false}
      title={title}
    />
  );
}
