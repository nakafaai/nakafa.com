// ../../../mascot/round.ts
import { Number as Num } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
function tenth(value) {
  return Num.round(value, 1);
}

// ../../../mascot/shape.ts
import { Schema } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var PAINT = {
  /** The colour that `currentColor` reads, for this shape and what it holds. */
  color: Schema.optionalKey(Schema.String),
  fill: Schema.optionalKey(Schema.String),
  fillOpacity: Schema.optionalKey(Schema.Finite),
  fillRule: Schema.optionalKey(Schema.Literal("evenodd")),
  opacity: Schema.optionalKey(Schema.Finite),
  stroke: Schema.optionalKey(Schema.String),
  strokeDasharray: Schema.optionalKey(Schema.String),
  strokeLinecap: Schema.optionalKey(Schema.Literal("round")),
  strokeLinejoin: Schema.optionalKey(Schema.Literal("round")),
  strokeOpacity: Schema.optionalKey(Schema.Finite),
  strokeWidth: Schema.optionalKey(Schema.Finite),
  transform: Schema.optionalKey(Schema.String)
};
var PathFields = Schema.Struct({
  ...PAINT,
  d: Schema.String,
  /** The length the path counts as, so a line that draws itself runs from 1 to 0. */
  pathLength: Schema.optionalKey(Schema.Finite)
});
var EllipseFields = Schema.Struct({
  ...PAINT,
  cx: Schema.Finite,
  cy: Schema.Finite,
  rx: Schema.Finite,
  ry: Schema.Finite
});
var CircleFields = Schema.Struct({
  ...PAINT,
  cx: Schema.Finite,
  cy: Schema.Finite,
  r: Schema.Finite
});
var RectFields = Schema.Struct({
  ...PAINT,
  height: Schema.Finite,
  rx: Schema.optionalKey(Schema.Finite),
  width: Schema.Finite,
  x: Schema.optionalKey(Schema.Finite),
  y: Schema.optionalKey(Schema.Finite)
});
var PolygonFields = Schema.Struct({
  ...PAINT,
  points: Schema.String
});
var GroupFields = Schema.Struct(PAINT);
var LeafSchema = Schema.Union([
  Schema.TaggedStruct("path", PathFields.fields),
  Schema.TaggedStruct("ellipse", EllipseFields.fields),
  Schema.TaggedStruct("circle", CircleFields.fields),
  Schema.TaggedStruct("rect", RectFields.fields),
  Schema.TaggedStruct("polygon", PolygonFields.fields)
]);
function path(fields) {
  return { _tag: "path", ...fields };
}
function ellipse(fields) {
  return { _tag: "ellipse", ...fields };
}
function polygon(fields) {
  return { _tag: "polygon", ...fields };
}
function group(children, fields) {
  return { _tag: "g", children, ...fields };
}

// ../../../mascot/kit.ts
import { Array as Arr, Match, Schema as Schema2 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var INK = "#15294f";
var SHINE = "#ffffff";
var BLUSH = "#f48fb1";
var PEARL = "#f6f4ef";
var Mark = Schema2.Literal("eye");
var Eyes = Schema2.Literals(["open", "smile", "wink", "asleep"]);
var Kit = Schema2.Struct({
  body: Schema2.String,
  eyes: Eyes,
  ink: Schema2.String,
  look: Schema2.Finite,
  second: Schema2.String
});
function figure(...layers) {
  return Arr.flatMap(layers, Arr.ensure);
}
function both(layer) {
  return Arr.flatMap([-1, 1], (side) => Arr.ensure(layer(side)));
}
function ellipse2(cx, cy, rx, ry, fill, turn = 0) {
  return ellipse({
    cx: tenth(cx),
    cy: tenth(cy),
    fill,
    rx: tenth(rx),
    ry: tenth(ry),
    ...turn === 0 ? {} : { transform: `rotate(${turn} ${tenth(cx)} ${tenth(cy)})` }
  });
}
function path2(d, fill) {
  return path({ d, fill });
}
function outlined(d, fill, color, width) {
  return path({
    d,
    fill,
    stroke: color,
    strokeLinejoin: "round",
    strokeWidth: width
  });
}
function blob(points, fill, width) {
  return polygon({
    fill,
    points: Arr.join(
      Arr.map(Arr.chunksOf(points, 2), ([x, y]) => `${tenth(x)},${tenth(y)}`),
      " "
    ),
    stroke: fill,
    strokeLinejoin: "round",
    strokeWidth: width
  });
}
function line(d, color, width) {
  return path({
    d,
    fill: "none",
    stroke: color,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: width
  });
}
function faded(opacity, layers) {
  return group(layers, { opacity });
}
function head(fill, rx = 60, ry = 52, cy = 98) {
  return ellipse2(100, cy, rx, ry, fill);
}
function torso(fill, half = 56) {
  return path2(
    `M${100 - half},200 C${98 - half},170 ${108 - half},142 ${120 - half},126 L${80 + half},126 C${92 + half},142 ${102 + half},170 ${100 + half},200 Z`,
    fill
  );
}
function belly(fill, half = 30, top = 148) {
  return path2(
    `M${100 - half},200 C${100 - half},178 ${108 - half},${top + 4} 100,${top} C${92 + half},${top + 4} ${100 + half},178 ${100 + half},200 Z`,
    fill
  );
}
function nose(y, rx, ry, ink) {
  return ellipse2(100, y, rx, ry, ink);
}
function smile(y, wide, deep, ink) {
  return outlined(
    `M${100 - wide},${y} Q100,${tenth(y + deep * 0.62)} ${100 + wide},${y} Q100,${tenth(y + deep * 1.5)} ${100 - wide},${y} Z`,
    ink,
    ink,
    2.6
  );
}
function eye(kind, x, y, r, ink) {
  return Match.value(kind).pipe(
    Match.when(
      "smile",
      () => line(
        `M${tenth(x - r)},${tenth(y + 2)} Q${tenth(x)},${tenth(y - r - 2)} ${tenth(x + r)},${tenth(y + 2)}`,
        ink,
        4.6
      )
    ),
    Match.when(
      "asleep",
      () => line(
        `M${tenth(x - r)},${tenth(y - 1)} Q${tenth(x)},${tenth(y + r)} ${tenth(x + r)},${tenth(y - 1)}`,
        ink,
        4.6
      )
    ),
    Match.orElse(
      () => group(
        [
          ellipse({
            cx: tenth(x),
            cy: tenth(y),
            fill: ink,
            rx: tenth(r),
            ry: tenth(r * 1.22)
          }),
          ...ink === INK ? [
            ellipse({
              cx: tenth(x - r * 0.3),
              cy: tenth(y - r * 0.42),
              fill: SHINE,
              rx: tenth(r * 0.38),
              ry: tenth(r * 0.38)
            })
          ] : []
        ],
        { mark: Mark.literal }
      )
    )
  );
}
function cheek(x, y, r) {
  return ellipse({
    cx: tenth(x),
    cy: tenth(y),
    fill: BLUSH,
    opacity: 0.45,
    rx: tenth(r * 1.15),
    ry: tenth(r * 0.7)
  });
}
function kindAt(eyes2, side) {
  return Match.value(eyes2).pipe(
    Match.when("wink", () => side < 0 ? "smile" : "open"),
    Match.orElse((kept) => kept)
  );
}
function eyes(kit, dx, y, r = 6.4, ink = kit.ink) {
  return both((side) => {
    const x = 100 + side * dx + kit.look;
    const shown = eye(kindAt(kit.eyes, side), x, y, r, ink);
    return ink === INK ? [cheek(x + side * r * 1.1, y + r * 2.1, r), shown] : shown;
  });
}
function roundEars(body, inner, dx, y, r) {
  return both(
    (side) => figure(
      ellipse2(100 + side * dx, y, r, r, body),
      inner === null ? [] : ellipse2(100 + side * dx, y + 1, r * 0.52, r * 0.52, inner)
    )
  );
}
function pointEars(body, inner) {
  return both((side) => [
    blob(
      [100 + side * 54, 82, 100 + side * 52, 36, 100 + side * 20, 58],
      body,
      12
    ),
    blob(
      [100 + side * 48, 70, 100 + side * 47, 50, 100 + side * 34, 60],
      inner,
      5
    )
  ]);
}
function spikes(cx, cy, inner, outer, from, to, count, fill, width = 4) {
  return Arr.makeBy(count, (index) => {
    const angle = (from + (to - from) * index / (count - 1)) * Math.PI / 180;
    const spread = (to - from) / (count - 1) * 0.5 * Math.PI / 180;
    return blob(
      [
        cx + Math.cos(angle - spread) * inner,
        cy + Math.sin(angle - spread) * inner,
        cx + Math.cos(angle) * outer,
        cy + Math.sin(angle) * outer,
        cx + Math.cos(angle + spread) * inner,
        cy + Math.sin(angle + spread) * inner
      ],
      fill,
      width
    );
  });
}

// ../../../mascot/family/bird.ts
import { Array as Arr2 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var bird = {
  chicken: {
    colors: [
      ["#f7d774", "#ee8a4c"],
      ["#f3e7a6", "#f2a33a"]
    ],
    draw: (kit) => figure(
      ellipse2(90, 44, 8, 13, kit.body, -24),
      ellipse2(100, 40, 8, 15, kit.body),
      ellipse2(110, 44, 8, 13, kit.body, 24),
      torso(kit.body, 60),
      head(kit.body, 58, 54, 100),
      both((side) => ellipse2(100 + side * 40, 114, 9, 6, kit.second)),
      eyes(kit, 24, 94),
      blob([90, 106, 110, 106, 100, 117], kit.second, 6)
    )
  },
  owl: {
    colors: [
      ["#c9a27e", "#f4e6ce"],
      ["#c9d2dc", PEARL],
      ["#aeb8f5", PEARL]
    ],
    draw: (kit) => figure(
      both(
        (side) => blob(
          [100 + side * 56, 78, 100 + side * 58, 40, 100 + side * 28, 54],
          kit.body,
          10
        )
      ),
      torso(kit.body),
      head(kit.body),
      belly(kit.second, 32, 144),
      both((side) => ellipse2(100 + side * 26, 94, 25, 25, kit.second)),
      eyes(kit, 26, 94, 7.4),
      blob([94, 108, 106, 108, 100, 118], kit.ink, 4)
    )
  },
  penguin: {
    colors: [
      ["#5b6b8c", PEARL],
      ["#7c8fc4", PEARL]
    ],
    draw: (kit) => figure(
      torso(kit.body, 60),
      head(kit.body),
      both((side) => ellipse2(100 + side * 20, 102, 28, 30, kit.second)),
      path2(
        "M62,200 C60,170 70,128 100,120 C130,128 140,170 138,200 Z",
        kit.second
      ),
      eyes(kit, 22, 98),
      blob([92, 110, 108, 110, 100, 120], "#ee8a4c", 5)
    )
  },
  duck: {
    colors: [
      [PEARL, "#f2a33a"],
      ["#f7d774", "#ee8a4c"],
      ["#9fd6b8", "#f2a33a"]
    ],
    draw: (kit) => figure(
      line("M100,46 Q96,28 110,26", kit.body, 8),
      torso(kit.body, 58),
      head(kit.body, 56, 52, 98),
      ellipse2(100, 114, 27, 13, kit.second),
      line("M80,114 Q100,121 120,114", kit.ink, 3.4),
      eyes(kit, 24, 90)
    )
  },
  cockatoo: {
    colors: [
      [PEARL, "#f7d774"],
      ["#f4c7cf", "#ec9ab0"]
    ],
    draw: (kit) => figure(
      ellipse2(78, 44, 8, 26, kit.second, -30),
      ellipse2(92, 34, 8, 28, kit.second, -10),
      ellipse2(108, 34, 8, 28, kit.second, 10),
      ellipse2(122, 44, 8, 26, kit.second, 30),
      torso(kit.body, 58),
      head(kit.body, 56, 52, 100),
      both((side) => ellipse2(100 + side * 40, 112, 9, 7, kit.second)),
      eyes(kit, 25, 94),
      path2(
        "M86,104 C90,98 110,98 114,104 C113,118 106,128 100,130 C94,128 87,118 86,104 Z",
        "#5b6b8c"
      )
    )
  },
  hornbill: {
    colors: [
      ["#5b6b8c", PEARL],
      ["#6d4b78", "#f4e6ce"]
    ],
    draw: (kit) => figure(
      torso(kit.body, 58),
      head(kit.body, 56, 52, 96),
      ellipse2(100, 98, 42, 36, kit.second),
      belly(kit.second, 30, 152),
      eyes(kit, 28, 90),
      path2(
        "M80,104 C84,96 116,96 120,104 C119,130 108,152 100,156 C92,152 81,130 80,104 Z",
        "#f2a33a"
      ),
      path2("M86,98 C88,80 112,80 114,98 Z", "#ee8a4c")
    )
  },
  eagle: {
    colors: [
      ["#8f6a4f", PEARL],
      ["#a8794f", "#f4e6ce"]
    ],
    draw: (kit) => figure(
      torso(kit.body, 62),
      spikes(100, 110, 44, 62, 20, 160, 7, kit.second, 6),
      head(kit.second, 54, 50, 98),
      both(
        (side) => line(`M${100 + side * 38},76 L${100 + side * 15},84`, kit.ink, 4.6)
      ),
      eyes(kit, 25, 96),
      blob([90, 106, 110, 106, 100, 126], "#f7d774", 7)
    )
  },
  parrot: {
    colors: [
      ["#ee6a5a", "#f7d774"],
      ["#7fc7a0", "#f7d774"],
      ["#6fb1e8", "#f7d774"]
    ],
    draw: (kit) => figure(
      ellipse2(100, 42, 9, 14, kit.body),
      ellipse2(88, 46, 7, 11, kit.body, -24),
      ellipse2(112, 46, 7, 11, kit.body, 24),
      torso(kit.body, 58),
      head(kit.body, 56, 52, 98),
      belly(kit.second, 30, 152),
      both((side) => ellipse2(100 + side * 27, 92, 20, 20, PEARL)),
      eyes(kit, 27, 92),
      path2(
        "M86,102 C90,94 110,94 114,102 C113,120 106,132 100,134 C94,132 87,120 86,102 Z",
        kit.second
      )
    )
  },
  flamingo: {
    colors: [
      ["#f48fb1", PEARL],
      ["#f7a8a0", PEARL]
    ],
    draw: (kit) => figure(
      both(
        (side) => ellipse2(100 + side * 40, 184, 28, 38, kit.body, side * -14)
      ),
      torso(kit.body, 40),
      ellipse2(100, 150, 21, 58, kit.body),
      head(kit.body, 44, 42, 84),
      eyes(kit, 23, 78, 5.4),
      path2(
        "M85,92 C90,84 110,84 115,92 C115,112 108,130 100,134 C92,130 85,112 85,92 Z",
        kit.second
      ),
      path2(
        "M89,114 C96,119 104,119 111,114 C109,125 104,131 100,134 C96,131 91,125 89,114 Z",
        kit.ink
      )
    )
  },
  peacock: {
    colors: [
      ["#3f7fc4", "#7fc7a0"],
      ["#2f9a8f", "#f7d774"]
    ],
    draw: (kit) => figure(
      Arr2.flatMap(Arr2.range(0, 6), (index) => {
        const degrees = -164 + index * 148 / 6;
        const angle = degrees * Math.PI / 180;
        const x = 100 + 84 * Math.cos(angle);
        const y = 152 + 84 * Math.sin(angle);
        return [
          ellipse2(x, y, 20, 32, kit.second, degrees + 90),
          ellipse2(x, y, 10, 12, kit.body),
          ellipse2(x, y, 4.4, 5.4, "#f7d774")
        ];
      }),
      Arr2.flatMap([-1, 0, 1], (offset) => [
        line(
          `M${100 + offset * 9},64 L${100 + offset * 15},44`,
          kit.body,
          3.4
        ),
        ellipse2(100 + offset * 15, 42, 4.4, 4.4, kit.body)
      ]),
      torso(kit.body, 40),
      head(kit.body, 40, 38, 98),
      eyes(kit, 18, 94, 5.2),
      blob([94, 106, 106, 106, 100, 117], "#f7d774", 4)
    )
  },
  cassowary: {
    colors: [
      ["#2f3a56", "#3f8fd0"],
      ["#34344a", "#4aa3c7"]
    ],
    draw: (kit) => figure(
      torso(kit.body, 62),
      ellipse2(100, 150, 24, 52, kit.second),
      both((side) => ellipse2(100 + side * 8, 152, 6.4, 15, "#ee6a5a")),
      blob([88, 60, 100, 20, 112, 60], "#c9a27e", 10),
      head(kit.second, 42, 44, 96),
      eyes(kit, 18, 90, 5.4),
      blob([92, 104, 108, 104, 100, 123], "#3b4252", 5)
    )
  }
};

// ../../../mascot/family/bug.ts
import { Array as Arr3 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var bug = {
  bee: {
    colors: [
      ["#f7d774", "#cfe6f7"],
      ["#e8b456", PEARL]
    ],
    draw: (kit) => figure(
      both((side) => [
        line(
          `M${100 + side * 16},56 Q${100 + side * 20},34 ${100 + side * 34},28`,
          kit.ink,
          4.6
        ),
        ellipse2(100 + side * 36, 27, 5.4, 5.4, kit.ink)
      ]),
      both(
        (side) => ellipse2(100 + side * 62, 146, 24, 36, kit.second, side * 22)
      ),
      torso(kit.body),
      path2("M53,152 L147,152 L151,170 L49,170 Z", kit.ink),
      path2("M46,184 L154,184 L156,200 L44,200 Z", kit.ink),
      head(kit.body),
      eyes(kit, 24, 96),
      smile(110, 10, 9, kit.ink)
    )
  },
  beetle: {
    colors: [
      ["#ee6a5a", "#f4e6ce"],
      ["#f2a33a", PEARL]
    ],
    draw: (kit) => figure(
      both((side) => [
        line(
          `M${100 + side * 14},52 Q${100 + side * 18},30 ${100 + side * 34},24`,
          kit.ink,
          4.6
        ),
        ellipse2(100 + side * 36, 23, 5.4, 5.4, kit.ink)
      ]),
      path2(
        "M20,200 C20,144 54,108 100,108 C146,108 180,144 180,200 Z",
        kit.body
      ),
      line("M100,112 L100,200", kit.ink, 4),
      both((side) => [
        ellipse2(100 + side * 40, 150, 11, 11, kit.ink),
        ellipse2(100 + side * 26, 186, 8, 8, kit.ink),
        ellipse2(100 + side * 64, 184, 7, 7, kit.ink)
      ]),
      ellipse2(100, 86, 44, 40, kit.second),
      eyes(kit, 20, 84),
      smile(96, 10, 8, kit.ink)
    )
  },
  dragonfly: {
    colors: [
      ["#5fbfa8", "#cfe6f7"],
      ["#6fb1e8", "#dcd3f4"],
      ["#ee6a5a", "#f4e6ce"]
    ],
    draw: (kit) => figure(
      both((side) => [
        ellipse2(100 + side * 54, 100, 50, 17, kit.second, side * -18),
        ellipse2(100 + side * 50, 132, 42, 14, kit.second, side * 14)
      ]),
      ellipse2(100, 172, 11, 52, kit.body),
      line("M91,150 H109 M92,166 H108 M93,182 H107", kit.second, 2.8),
      ellipse2(100, 120, 18, 22, kit.body),
      ellipse2(100, 86, 28, 24, kit.body),
      both((side) => [
        ellipse2(100 + side * 17, 80, 15, 16, kit.second),
        eye(
          kindAt(kit.eyes, side),
          100 + side * 17 + kit.look,
          82,
          5.2,
          kit.ink
        )
      ]),
      smile(98, 6, 4.6, kit.ink)
    )
  },
  butterfly: {
    colors: [
      ["#f2a33a", "#f7d774"],
      ["#8e9ad6", "#dcd3f4"],
      ["#ee6a5a", "#f4c7cf"]
    ],
    draw: (kit) => figure(
      both((side) => [
        ellipse2(100 + side * 54, 98, 44, 56, kit.body, side * -12),
        ellipse2(100 + side * 58, 94, 21, 28, kit.second, side * -12),
        ellipse2(100 + side * 46, 164, 32, 36, kit.body, side * 14),
        ellipse2(100 + side * 50, 164, 14, 17, kit.second, side * 14)
      ]),
      both((side) => [
        line(
          `M${100 + side * 9},72 Q${100 + side * 20},46 ${100 + side * 30},40`,
          kit.ink,
          3.6
        ),
        ellipse2(100 + side * 30, 40, 4.2, 4.2, kit.ink)
      ]),
      ellipse2(100, 164, 17, 56, kit.second),
      ellipse2(100, 94, 27, 25, kit.second),
      eyes(kit, 10, 90, 4.8),
      smile(101, 6, 5, kit.ink)
    )
  },
  spider: {
    colors: [
      ["#6d5aa8", "#dcd3f4"],
      ["#4b6a8f", "#cfe6f7"],
      ["#8c5a4f", "#f4e6ce"]
    ],
    draw: (kit) => figure(
      Arr3.flatMap(
        Arr3.range(0, 3),
        (index) => both(
          (side) => line(
            `M${100 + side * 40},${118 + index * 14} Q${100 + side * (76 + index * 4)},${84 + index * 18} ${100 + side * (94 - index * 2)},${122 + index * 24}`,
            kit.body,
            7.5
          )
        )
      ),
      ellipse2(100, 166, 56, 52, kit.body),
      ellipse2(100, 172, 15, 20, kit.second),
      ellipse2(100, 106, 46, 42, kit.body),
      both((side) => [
        ellipse2(100 + side * 18, 102, 13.5, 14.5, kit.second),
        ellipse2(100 + side * 31, 80, 4.6, 4.6, kit.second)
      ]),
      eyes(kit, 18, 102, 5.6),
      smile(121, 8, 6, kit.ink)
    )
  },
  snail: {
    colors: [
      ["#f6c3a6", "#b98a63"],
      ["#f3e7a6", "#c9783a"],
      ["#cfebd9", "#5e8f9c"]
    ],
    draw: (kit) => figure(
      ellipse2(132, 126, 58, 58, kit.second),
      line(
        "M132,130 C120,130 118,114 132,112 C152,110 160,140 136,150 C104,160 86,124 108,100",
        kit.body,
        7
      ),
      line("M62,92 L56,58", kit.body, 9),
      line("M90,90 L98,56", kit.body, 9),
      ellipse2(55, 50, 12, 12, kit.body),
      ellipse2(99, 48, 12, 12, kit.body),
      path2(
        "M14,200 C16,176 36,164 70,164 L186,164 C194,176 194,190 192,200 Z",
        kit.body
      ),
      ellipse2(76, 122, 38, 44, kit.body),
      eye(kindAt(kit.eyes, -1), 55 + kit.look, 50, 5.4, kit.ink),
      eye(kindAt(kit.eyes, 1), 99 + kit.look, 48, 5.4, kit.ink),
      outlined(
        "M62,124 Q76,134 90,124 Q76,142 62,124 Z",
        kit.ink,
        kit.ink,
        2.6
      )
    )
  }
};

// ../../../mascot/family/carnivore.ts
import { Array as Arr4 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var carnivore = {
  cat: {
    colors: [
      ["#ee8a4c", "#f4e6ce"],
      ["#c9d2dc", PEARL],
      ["#efd2a6", PEARL]
    ],
    draw: (kit) => figure(
      pointEars(kit.body, kit.second),
      torso(kit.body),
      head(kit.body),
      ellipse2(100, 114, 34, 26, kit.second),
      belly(kit.second),
      eyes(kit, 26, 94),
      blob([95, 106, 105, 106, 100, 111], kit.ink, 3),
      smile(116, 9, 8, kit.ink)
    )
  },
  bear: {
    colors: [
      ["#c89468", "#f4e6ce"],
      [PEARL, "#c9d2dc"],
      ["#e8b456", "#f4e6ce"]
    ],
    draw: (kit) => figure(
      roundEars(kit.body, kit.second, 46, 52, 19),
      torso(kit.body),
      head(kit.body),
      ellipse2(100, 116, 26, 20, kit.second),
      belly(kit.second),
      eyes(kit, 28, 92),
      nose(108, 8, 6, kit.ink),
      smile(118, 8, 7, kit.ink)
    )
  },
  fox: {
    colors: [
      ["#ee8a4c", PEARL],
      ["#f2a33a", "#f4e6ce"]
    ],
    draw: (kit) => figure(
      pointEars(kit.body, kit.ink),
      torso(kit.body),
      head(kit.body),
      path2(
        "M42,104 C60,96 86,104 100,124 C114,104 140,96 158,104 C156,134 132,150 100,150 C68,150 44,134 42,104 Z",
        kit.second
      ),
      belly(kit.second),
      eyes(kit, 28, 92),
      nose(124, 7, 5.4, kit.ink),
      smile(132, 7, 6, kit.ink)
    )
  },
  panda: {
    colors: [
      [PEARL, PEARL],
      ["#f4e6ce", "#f4e6ce"]
    ],
    draw: (kit) => figure(
      roundEars(kit.ink, null, 46, 52, 19),
      torso(kit.body),
      both(
        (side) => ellipse2(100 + side * 50, 178, 20, 34, kit.ink, side * 16)
      ),
      head(kit.body),
      both(
        (side) => ellipse2(100 + side * 27, 98, 15, 19, kit.ink, side * 22)
      ),
      both(
        (side) => eye("open", 100 + side * 26 + kit.look, 97, 5, kit.body)
      ),
      nose(118, 7, 5, kit.ink),
      smile(126, 8, 7, kit.ink)
    )
  },
  tiger: {
    colors: [
      ["#f2a33a", "#f4e6ce"],
      ["#ee8a4c", PEARL]
    ],
    draw: (kit) => figure(
      roundEars(kit.body, kit.ink, 46, 52, 18),
      torso(kit.body),
      head(kit.body),
      blob([100, 50, 96, 66, 104, 66], kit.ink, 4),
      both((side) => [
        blob(
          [100 + side * 22, 54, 100 + side * 18, 66, 100 + side * 26, 66],
          kit.ink,
          3.4
        ),
        blob(
          [100 + side * 58, 96, 100 + side * 44, 100, 100 + side * 56, 104],
          kit.ink,
          3.4
        ),
        blob(
          [100 + side * 56, 114, 100 + side * 44, 116, 100 + side * 52, 122],
          kit.ink,
          3.4
        )
      ]),
      ellipse2(100, 118, 26, 19, kit.second),
      belly(kit.second),
      eyes(kit, 26, 92),
      nose(110, 7, 5, kit.ink),
      smile(119, 8, 7, kit.ink)
    )
  },
  lion: {
    colors: [
      ["#e8b456", "#c9783a"],
      ["#f7d774", "#ee8a4c"]
    ],
    draw: (kit) => figure(
      Arr4.makeBy(12, (index) => {
        const angle = index / 12 * Math.PI * 2;
        return ellipse2(
          100 + Math.cos(angle) * 54,
          98 + Math.sin(angle) * 50,
          22,
          22,
          kit.second
        );
      }),
      ellipse2(100, 98, 56, 52, kit.second),
      torso(kit.body, 50),
      roundEars(kit.body, null, 34, 62, 13),
      head(kit.body, 44, 42, 100),
      eyes(kit, 19, 94),
      nose(108, 7, 5, kit.ink),
      smile(117, 8, 7, kit.ink)
    )
  },
  dog: {
    colors: [
      ["#efd2a6", "#b98a63"],
      [PEARL, "#c89468"],
      ["#e8b456", "#a8683a"]
    ],
    draw: (kit) => figure(
      torso(kit.body),
      head(kit.body),
      both(
        (side) => ellipse2(100 + side * 54, 96, 17, 36, kit.second, side * 8)
      ),
      ellipse2(100, 116, 28, 21, PEARL),
      belly(PEARL),
      eyes(kit, 25, 92),
      nose(107, 8.4, 6, kit.ink),
      smile(117, 8, 6, kit.ink),
      ellipse2(100, 128, 5.6, 7, "#ec9ab0")
    )
  },
  civet: {
    colors: [
      ["#b9c0cc", PEARL],
      ["#c9a27e", "#f4e6ce"]
    ],
    draw: (kit) => figure(
      roundEars(kit.body, kit.ink, 46, 54, 16),
      torso(kit.body),
      head(kit.body),
      ellipse2(100, 66, 6, 16, kit.second),
      both(
        (side) => ellipse2(100 + side * 28, 96, 23, 15, kit.ink, side * 18)
      ),
      both(
        (side) => eye("open", 100 + side * 26 + kit.look, 96, 5, kit.second)
      ),
      ellipse2(100, 120, 22, 17, kit.second),
      belly(kit.second),
      nose(114, 6.4, 4.8, kit.ink),
      smile(123, 7, 6, kit.ink)
    )
  },
  raccoon: {
    colors: [
      ["#9aa3b0", PEARL],
      ["#b8a58c", "#f4e6ce"]
    ],
    draw: (kit) => figure(
      roundEars(kit.body, kit.ink, 46, 54, 17),
      torso(kit.body),
      head(kit.body),
      ellipse2(100, 118, 27, 21, kit.second),
      ellipse2(100, 70, 8, 16, kit.second),
      both(
        (side) => ellipse2(100 + side * 27, 96, 23, 15, kit.ink, side * 18)
      ),
      belly(kit.second),
      eyes(kit, 26, 96, 5, PEARL),
      nose(110, 6, 4.6, kit.ink),
      smile(120, 8, 6, kit.ink)
    )
  },
  seal: {
    colors: [
      ["#c9d2dc", PEARL],
      ["#cfe6f7", PEARL]
    ],
    draw: (kit) => figure(
      torso(kit.body, 62),
      head(kit.body, 58, 54, 96),
      both((side) => ellipse2(100 + side * 13, 116, 17, 15, kit.second)),
      belly(kit.second, 34, 150),
      both((side) => [
        ellipse2(100 + side * 10, 114, 1.7, 1.7, kit.ink),
        ellipse2(100 + side * 17, 118, 1.7, 1.7, kit.ink),
        ellipse2(100 + side * 20, 111, 1.7, 1.7, kit.ink)
      ]),
      eyes(kit, 28, 90),
      nose(105, 7, 5, kit.ink)
    )
  },
  walrus: {
    colors: [
      ["#b08968", "#f4e6ce"],
      ["#a8876f", PEARL]
    ],
    draw: (kit) => figure(
      both(
        (side) => ellipse2(100 + side * 58, 178, 18, 32, kit.body, side * -16)
      ),
      torso(kit.body, 62),
      head(kit.body, 58, 52, 96),
      both(
        (side) => blob(
          [100 + side * 11, 132, 100 + side * 21, 132, 100 + side * 15, 170],
          PEARL,
          7
        )
      ),
      both((side) => [
        ellipse2(100 + side * 20, 118, 25, 21, kit.second),
        ellipse2(100 + side * 13, 114, 2.1, 2.1, kit.ink),
        ellipse2(100 + side * 25, 111, 2.1, 2.1, kit.ink),
        ellipse2(100 + side * 21, 122, 2.1, 2.1, kit.ink)
      ]),
      eyes(kit, 27, 86, 5.6),
      nose(104, 8.4, 5.6, kit.ink)
    )
  }
};

// ../../../mascot/family/farm.ts
import { Array as Arr5 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var farm = {
  sheep: {
    colors: [
      [PEARL, "#efd2a6"],
      ["#f4e6ce", "#c9a27e"]
    ],
    draw: (kit) => figure(
      torso(kit.body, 60),
      both((side) => [
        ellipse2(100 + side * 46, 150, 22, 22, kit.body),
        ellipse2(100 + side * 28, 176, 24, 24, kit.body)
      ]),
      Arr5.map(
        [
          [52, 96],
          [60, 68],
          [82, 50],
          [118, 50],
          [140, 68],
          [148, 96],
          [100, 44]
        ],
        ([x, y]) => ellipse2(x, y, 24, 24, kit.body)
      ),
      head(kit.body, 50, 44, 100),
      both(
        (side) => ellipse2(100 + side * 50, 102, 17, 9, kit.second, side * -24)
      ),
      ellipse2(100, 108, 36, 38, kit.second),
      eyes(kit, 16, 102),
      nose(120, 5, 3.6, kit.ink),
      smile(126, 7, 6, kit.ink)
    )
  },
  cow: {
    colors: [
      [PEARL, "#f4c7cf"],
      ["#f4e6ce", "#f6c3a6"]
    ],
    draw: (kit) => figure(
      both(
        (side) => blob(
          [100 + side * 30, 56, 100 + side * 44, 34, 100 + side * 46, 58],
          "#efd2a6",
          8
        )
      ),
      both(
        (side) => ellipse2(100 + side * 64, 84, 18, 10, kit.body, side * -22)
      ),
      torso(kit.body),
      head(kit.body),
      path2(
        "M118,50 C140,52 158,70 160,92 C146,96 128,90 122,74 C118,66 116,56 118,50 Z",
        kit.ink
      ),
      ellipse2(100, 124, 36, 22, kit.second),
      belly(kit.second),
      eyes(kit, 28, 92),
      both((side) => ellipse2(100 + side * 12, 124, 3.6, 4.6, kit.ink))
    )
  },
  pig: {
    colors: [
      ["#f4c7cf", "#ec9ab0"],
      ["#f6c3a6", "#f5a48e"]
    ],
    draw: (kit) => figure(
      both((side) => [
        blob(
          [100 + side * 50, 72, 100 + side * 58, 40, 100 + side * 26, 54],
          kit.body,
          14
        ),
        blob(
          [100 + side * 46, 62, 100 + side * 50, 48, 100 + side * 36, 56],
          kit.second,
          5
        )
      ]),
      torso(kit.body),
      head(kit.body),
      ellipse2(100, 116, 25, 18, kit.second),
      both((side) => ellipse2(100 + side * 9, 116, 3.6, 5.4, kit.ink)),
      eyes(kit, 28, 90),
      smile(138, 7, 5, kit.ink)
    )
  },
  horse: {
    colors: [
      ["#c89468", "#f4e6ce"],
      ["#8f6a4f", "#efd2a6"],
      ["#b9c0cc", PEARL]
    ],
    draw: (kit) => figure(
      both(
        (side) => blob(
          [100 + side * 42, 62, 100 + side * 46, 30, 100 + side * 26, 50],
          kit.body,
          11
        )
      ),
      torso(kit.body),
      head(kit.body, 48, 56, 100),
      ellipse2(100, 46, 20, 16, kit.second),
      ellipse2(86, 60, 12, 16, kit.second, 24),
      ellipse2(114, 60, 12, 16, kit.second, -24),
      ellipse2(100, 132, 31, 22, kit.second),
      both((side) => ellipse2(100 + side * 10, 132, 2.8, 3.8, kit.ink)),
      eyes(kit, 27, 96),
      line("M88,142 Q100,148 112,142", kit.ink, 3.6)
    )
  },
  goat: {
    colors: [
      [PEARL, "#c9a27e"],
      ["#c9d2dc", "#8f6a4f"],
      ["#efd2a6", "#b98a63"]
    ],
    draw: (kit) => figure(
      both(
        (side) => line(
          `M${100 + side * 22},58 Q${100 + side * 30},28 ${100 + side * 54},24`,
          kit.second,
          10
        )
      ),
      both(
        (side) => ellipse2(100 + side * 62, 92, 21, 9, kit.body, side * 16)
      ),
      torso(kit.body),
      blob([90, 146, 110, 146, 100, 172], kit.second, 8),
      head(kit.body, 52, 54, 98),
      ellipse2(100, 124, 22, 17, "#f4c7cf"),
      eyes(kit, 26, 94),
      both((side) => ellipse2(100 + side * 6, 120, 2.2, 3, kit.ink)),
      smile(128, 7, 5, kit.ink)
    )
  },
  alpaca: {
    colors: [
      ["#f4e6ce", PEARL],
      ["#c9a27e", "#f4e6ce"],
      [PEARL, "#f4c7cf"]
    ],
    draw: (kit) => figure(
      both((side) => [
        ellipse2(100 + side * 34, 48, 10, 24, kit.body, side * 22),
        ellipse2(100 + side * 34, 50, 4.6, 15, kit.second, side * 22)
      ]),
      torso(kit.body, 50),
      both((side) => [
        ellipse2(100 + side * 30, 156, 24, 24, kit.body),
        ellipse2(100 + side * 44, 184, 24, 24, kit.body)
      ]),
      ellipse2(100, 150, 30, 56, kit.body),
      head(kit.body, 44, 46, 96),
      ellipse2(100, 50, 28, 20, kit.body),
      ellipse2(78, 60, 18, 16, kit.body),
      ellipse2(122, 60, 18, 16, kit.body),
      ellipse2(100, 114, 23, 19, kit.second),
      eyes(kit, 21, 92, 5.4),
      nose(107, 5.4, 3.8, kit.ink),
      line("M100,110 V117 M92,119 Q100,126 108,119", kit.ink, 3.6)
    )
  }
};

// ../../../mascot/family/marine.ts
import { Array as Arr6 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var marine = {
  whale: {
    colors: [
      ["#aeb8f5", "#eef1fd"],
      ["#8fb7e8", PEARL]
    ],
    draw: (kit) => figure(
      line("M100,46 L100,34", kit.second, 6),
      both(
        (side) => line(
          `M100,34 Q${100 + side * 6},18 ${100 + side * 22},22`,
          kit.second,
          6
        )
      ),
      path2(
        "M26,200 C20,150 34,58 100,56 C166,58 180,150 174,200 Z",
        kit.body
      ),
      path2(
        "M28,128 C60,142 140,142 172,128 C170,162 142,200 100,200 C58,200 30,162 28,128 Z",
        kit.second
      ),
      eyes(kit, 50, 112),
      smile(128, 20, 9, kit.ink)
    )
  },
  turtle: {
    colors: [
      ["#98cf82", "#e8b456"],
      ["#7fc7a0", "#efd2a6"]
    ],
    draw: (kit) => figure(
      path2(
        "M14,200 C14,150 50,112 100,112 C150,112 186,150 186,200 Z",
        kit.second
      ),
      faded(0.3, [
        ...both((side) => ellipse2(100 + side * 52, 170, 16, 18, kit.body)),
        ellipse2(100, 164, 16, 18, kit.body)
      ]),
      path2(
        "M70,200 C70,176 76,150 84,134 L116,134 C124,150 130,176 130,200 Z",
        kit.body
      ),
      head(kit.body, 46, 44, 92),
      eyes(kit, 22, 88),
      smile(102, 14, 10, kit.ink)
    )
  },
  octopus: {
    colors: [
      ["#f5a48e", "#f6c3a6"],
      ["#dcd3f4", PEARL],
      ["#ec9ab0", "#f4c7cf"]
    ],
    draw: (kit) => figure(
      Arr6.map(
        [28, 64, 100, 136, 172],
        (at) => path2(
          `M${at - 20},200 L${at - 20},150 C${at - 20},136 ${at + 20},136 ${at + 20},150 L${at + 20},200 Z`,
          kit.body
        )
      ),
      ellipse2(100, 94, 64, 60, kit.body),
      Arr6.map(
        [28, 64, 100, 136, 172],
        (at) => ellipse2(at, 180, 5.6, 5.6, kit.second)
      ),
      eyes(kit, 24, 98),
      smile(112, 10, 9, kit.ink)
    )
  },
  jellyfish: {
    colors: [
      ["#dcd3f4", PEARL],
      ["#f4c7cf", PEARL],
      ["#cfe6f7", PEARL]
    ],
    draw: (kit) => figure(
      Arr6.map(
        [56, 78, 100, 122, 144],
        (at) => line(
          `M${at},134 Q${at - 9},152 ${at},168 Q${at + 9},184 ${at},204`,
          kit.body,
          9
        )
      ),
      path2("M38,132 C38,76 64,44 100,44 C136,44 162,76 162,132 Z", kit.body),
      Arr6.map(
        [56, 78, 100, 122, 144],
        (at) => ellipse2(at, 132, 13, 10, kit.body)
      ),
      ellipse2(70, 72, 8, 6, kit.second, -30),
      ellipse2(128, 66, 6, 5, kit.second, 30),
      eyes(kit, 24, 102),
      smile(112, 10, 8, kit.ink)
    )
  },
  pufferfish: {
    colors: [
      ["#f3e7a6", PEARL],
      ["#8fd0c4", PEARL],
      ["#f6c3a6", PEARL]
    ],
    draw: (kit) => figure(
      spikes(100, 120, 64, 82, 192, 348, 9, kit.body, 5),
      both(
        (side) => ellipse2(100 + side * 74, 126, 13, 21, kit.body, side * 28)
      ),
      path2(
        "M30,200 C22,150 44,52 100,52 C156,52 178,150 170,200 Z",
        kit.body
      ),
      path2(
        "M34,136 C56,160 144,160 166,136 C164,176 134,200 100,200 C66,200 36,176 34,136 Z",
        kit.second
      ),
      both((side) => ellipse2(100 + side * 44, 122, 8, 5.6, "#f5a48e")),
      eyes(kit, 28, 100, 8),
      ellipse2(100, 126, 8.4, 7.4, kit.ink)
    )
  },
  clownfish: {
    colors: [
      ["#f47c3c", PEARL],
      ["#f2a33a", PEARL]
    ],
    draw: (kit) => figure(
      outlined("M76,62 C80,36 120,36 124,62 Z", kit.body, kit.ink, 3.4),
      both((side) => [
        ellipse2(100 + side * 66, 134, 18, 27, kit.body, side * -24),
        ellipse2(100 + side * 76, 142, 6, 13, kit.ink, side * -24)
      ]),
      torso(kit.body, 44),
      ellipse2(100, 122, 66, 68, kit.body),
      both(
        (side) => outlined(
          `M${100 + side * 34},64 C${100 + side * 50},96 ${100 + side * 50},150 ${100 + side * 34},182 L${100 + side * 50},174 C${100 + side * 64},146 ${100 + side * 64},100 ${100 + side * 50},72 Z`,
          kit.second,
          kit.ink,
          3.4
        )
      ),
      eyes(kit, 15, 104, 6.6),
      smile(121, 11, 9, kit.ink)
    )
  },
  starfish: {
    colors: [
      ["#f48a6a", "#f7d774"],
      ["#f2a33a", "#f4e6ce"],
      ["#e88fb0", PEARL]
    ],
    draw: (kit) => figure(
      blob(
        Arr6.flatMap(Arr6.range(0, 9), (index) => {
          const reach = index % 2 === 0 ? 92 : 44;
          const angle = -Math.PI / 2 + index * Math.PI / 5;
          return [
            100 + reach * Math.cos(angle),
            122 + reach * Math.sin(angle)
          ];
        }),
        kit.body,
        22
      ),
      ellipse2(100, 54, 4.4, 4.4, kit.second),
      ellipse2(100, 72, 3.4, 3.4, kit.second),
      both((side) => [
        ellipse2(100 + side * 62, 104, 4.4, 4.4, kit.second),
        ellipse2(100 + side * 46, 110, 3.4, 3.4, kit.second),
        ellipse2(100 + side * 44, 176, 4.4, 4.4, kit.second)
      ]),
      both((side) => ellipse2(100 + side * 26, 126, 7, 5, kit.second)),
      eyes(kit, 15, 112, 5.6),
      smile(124, 9, 7, kit.ink)
    )
  },
  crab: {
    colors: [
      ["#ee6a5a", "#f6c3a6"],
      ["#f2a33a", "#f4e6ce"]
    ],
    draw: (kit) => figure(
      both((side) => [
        line(
          `M${100 + side * 58},140 Q${100 + side * 86},128 ${100 + side * 80},98`,
          kit.body,
          11
        ),
        ellipse2(100 + side * 78, 82, 21, 17, kit.body, side * -24),
        blob(
          [100 + side * 78, 82, 100 + side * 94, 64, 100 + side * 86, 82],
          kit.second,
          3
        )
      ]),
      both((side) => [
        line(`M${100 + side * 22},112 L${100 + side * 26},74`, kit.body, 10),
        ellipse2(100 + side * 26, 66, 15, 15, kit.body)
      ]),
      path2(
        "M26,200 C20,146 52,104 100,104 C148,104 180,146 174,200 Z",
        kit.body
      ),
      path2(
        "M58,200 C58,180 76,166 100,166 C124,166 142,180 142,200 Z",
        kit.second
      ),
      both(
        (side) => eye(
          kindAt(kit.eyes, side),
          100 + side * 26 + kit.look,
          66,
          6,
          kit.ink
        )
      ),
      smile(132, 16, 10, kit.ink)
    )
  }
};

// ../../../mascot/family/primate.ts
var primate = {
  orangutan: {
    colors: [
      ["#ee8a4c", "#f6c3a6"],
      ["#d9824a", "#efd2a6"]
    ],
    draw: (kit) => figure(
      blob([88, 50, 84, 30, 98, 44], kit.body, 8),
      blob([100, 46, 104, 24, 112, 46], kit.body, 8),
      blob([112, 50, 122, 34, 120, 52], kit.body, 8),
      torso(kit.body, 62),
      both((side) => ellipse2(100 + side * 44, 102, 28, 38, kit.body)),
      head(kit.body, 46, 52, 98),
      ellipse2(100, 104, 40, 44, kit.second),
      belly(kit.second, 30, 152),
      eyes(kit, 15, 92),
      both((side) => ellipse2(100 + side * 5, 110, 2, 2.6, kit.ink)),
      smile(120, 14, 10, kit.ink)
    )
  },
  tarsier: {
    colors: [
      ["#efd2a6", "#f7d774"],
      ["#c9a27e", "#f3e7a6"]
    ],
    draw: (kit) => figure(
      both((side) => [
        ellipse2(100 + side * 56, 62, 20, 26, kit.body, side * 24),
        ellipse2(100 + side * 56, 64, 10, 15, "#f4c7cf", side * 24)
      ]),
      torso(kit.body, 48),
      head(kit.body, 58, 50, 100),
      belly(PEARL, 24, 152),
      both((side) => ellipse2(100 + side * 28, 96, 27, 27, kit.second)),
      eyes(kit, 28, 96, 12),
      nose(124, 4, 3, kit.ink),
      smile(130, 6, 5, kit.ink)
    )
  },
  monkey: {
    colors: [
      ["#b98a63", "#f4e6ce"],
      ["#c9a27e", "#f6c3a6"],
      ["#8f6a4f", "#efd2a6"]
    ],
    draw: (kit) => figure(
      roundEars(kit.body, kit.second, 62, 96, 18),
      torso(kit.body),
      head(kit.body, 56, 52),
      both((side) => ellipse2(100 + side * 19, 92, 24, 24, kit.second)),
      ellipse2(100, 116, 34, 26, kit.second),
      belly(kit.second),
      eyes(kit, 20, 92),
      both((side) => ellipse2(100 + side * 5, 110, 2, 2.6, kit.ink)),
      smile(120, 13, 9, kit.ink)
    )
  },
  proboscis: {
    colors: [
      ["#d9824a", "#f6c3a6"],
      ["#c9783a", "#efd2a6"]
    ],
    draw: (kit) => figure(
      blob([90, 52, 92, 36, 102, 48], kit.body, 8),
      blob([102, 50, 110, 32, 114, 52], kit.body, 8),
      roundEars(kit.body, kit.second, 60, 98, 13),
      torso(kit.body, 60),
      head(kit.body, 56, 54, 98),
      both((side) => ellipse2(100 + side * 18, 92, 23, 22, kit.second)),
      ellipse2(100, 116, 33, 27, kit.second),
      belly(PEARL, 32, 150),
      eyes(kit, 19, 90),
      smile(134, 11, 6, kit.ink),
      ellipse2(100, 114, 11, 19, "#e89c7c")
    )
  }
};

// ../../../mascot/family/reptile.ts
import { Array as Arr7 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var reptile = {
  komodo: {
    colors: [
      ["#b4bc84", "#ec9ab0"],
      ["#9fb07a", "#f5a48e"]
    ],
    draw: (kit) => figure(
      torso(kit.body, 58),
      head(kit.body, 66, 44, 104),
      line(
        "M100,128 L100,146 M100,146 L92,158 M100,146 L108,158",
        kit.second,
        6
      ),
      faded(0.22, [
        ...both((side) => [
          ellipse2(100 + side * 14, 60, 5, 4, kit.ink),
          ellipse2(100 + side * 30, 68, 4, 3.4, kit.ink)
        ]),
        ellipse2(100, 56, 5, 4, kit.ink)
      ]),
      eyes(kit, 36, 96),
      both((side) => ellipse2(100 + side * 8, 112, 2.4, 2.4, kit.ink)),
      line("M70,126 Q100,136 130,126", kit.ink, 4.4)
    )
  },
  crocodile: {
    colors: [
      ["#6fae6a", "#ddebb5"],
      ["#5e9c7c", "#cfebd9"]
    ],
    draw: (kit) => figure(
      both((side) => ellipse2(100 + side * 26, 58, 19, 19, kit.body)),
      torso(kit.body, 58),
      belly(kit.second, 34, 166),
      head(kit.body, 46, 34, 80),
      path2(
        "M62,84 C62,70 138,70 138,84 C140,104 152,118 152,132 C152,150 126,158 100,158 C74,158 48,150 48,132 C48,118 60,104 62,84 Z",
        kit.body
      ),
      ellipse2(100, 84, 4, 4, kit.second),
      ellipse2(100, 98, 3.4, 3.4, kit.second),
      both(
        (side) => eye(
          kindAt(kit.eyes, side),
          100 + side * 26 + kit.look,
          58,
          5.8,
          kit.ink
        )
      ),
      both((side) => ellipse2(100 + side * 12, 118, 3.2, 4, kit.ink)),
      Arr7.map(
        [
          [-40, 139],
          [-26, 143],
          [-12, 145],
          [12, 145],
          [26, 143],
          [40, 139]
        ],
        ([x, y]) => blob(
          [100 + x - 4.5, y, 100 + x + 4.5, y, 100 + x, y + 9],
          PEARL,
          2.4
        )
      ),
      line("M50,134 Q100,150 150,134", kit.ink, 4.6)
    )
  },
  snake: {
    colors: [
      ["#7fc7a0", "#f7d774"],
      ["#f2a33a", "#f4e6ce"],
      ["#8e9ad6", "#f4c7cf"]
    ],
    draw: (kit) => figure(
      ellipse2(100, 190, 72, 28, kit.body),
      line("M48,190 Q100,212 152,190", kit.second, 6.4),
      ellipse2(100, 158, 54, 23, kit.body),
      line("M60,158 Q100,176 140,158", kit.second, 6.4),
      ellipse2(100, 126, 22, 36, kit.body),
      ellipse2(100, 88, 42, 35, kit.body),
      ellipse2(100, 64, 5.4, 4.4, kit.second),
      both((side) => ellipse2(100 + side * 24, 70, 4.4, 3.6, kit.second)),
      line("M100,107 V125 M100,125 L92,135 M100,125 L108,135", "#ee6a5a", 4),
      eyes(kit, 19, 84, 5.6),
      line("M84,102 Q100,113 116,102", kit.ink, 4.2)
    )
  },
  frog: {
    colors: [
      ["#98cf82", "#ddebb5"],
      ["#7fc7a0", "#cfebd9"]
    ],
    draw: (kit) => figure(
      both((side) => [
        ellipse2(100 + side * 32, 58, 25, 25, kit.body),
        ellipse2(100 + side * 32, 58, 15, 15, kit.second)
      ]),
      torso(kit.body, 62),
      head(kit.body, 68, 46, 106),
      belly(kit.second, 38, 140),
      both(
        (side) => eye(kindAt(kit.eyes, side), 100 + side * 32, 58, 6.6, kit.ink)
      ),
      smile(112, 30, 16, kit.ink)
    )
  },
  axolotl: {
    colors: [
      ["#f4c7cf", "#ec9ab0"],
      ["#dcd3f4", "#aeb8f5"]
    ],
    draw: (kit) => figure(
      both((side) => [
        ellipse2(100 + side * 66, 66, 20, 8, kit.second, side * -36),
        ellipse2(100 + side * 72, 92, 20, 8, kit.second, side * -8),
        ellipse2(100 + side * 68, 118, 20, 8, kit.second, side * 22)
      ]),
      torso(kit.body),
      head(kit.body, 62, 48, 100),
      eyes(kit, 34, 96),
      smile(108, 20, 12, kit.ink)
    )
  }
};

// ../../../mascot/family/small.ts
var small = {
  rabbit: {
    colors: [
      [PEARL, "#f4c7cf"],
      ["#dcd3f4", PEARL],
      ["#efd2a6", "#f4e6ce"]
    ],
    draw: (kit) => figure(
      both((side) => [
        ellipse2(100 + side * 24, 36, 15, 42, kit.body, side * 8),
        ellipse2(100 + side * 24, 38, 7, 30, kit.second, side * 8)
      ]),
      torso(kit.body),
      head(kit.body, 56, 48, 102),
      belly(kit.second),
      eyes(kit, 24, 98),
      nose(110, 4.6, 3.6, kit.ink),
      smile(117, 8, 7, kit.ink)
    )
  },
  hamster: {
    colors: [
      ["#e8b456", "#f4e6ce"],
      ["#efd2a6", PEARL]
    ],
    draw: (kit) => figure(
      roundEars(kit.body, kit.second, 42, 52, 14),
      torso(kit.body, 60),
      head(kit.body, 64, 54, 100),
      both((side) => ellipse2(100 + side * 30, 118, 26, 24, kit.second)),
      belly(kit.second, 30, 150),
      eyes(kit, 24, 92),
      nose(108, 4.6, 3.6, kit.ink),
      smile(114, 6, 6, kit.ink)
    )
  },
  mouse: {
    colors: [
      ["#c9d2dc", "#f4c7cf"],
      ["#efd2a6", "#f4c7cf"]
    ],
    draw: (kit) => figure(
      roundEars(kit.body, kit.second, 50, 56, 28),
      torso(kit.body, 50),
      head(kit.body, 50, 46, 102),
      belly(kit.second, 26, 152),
      eyes(kit, 22, 98),
      nose(112, 5.6, 4.4, kit.second),
      smile(119, 7, 6, kit.ink)
    )
  },
  squirrel: {
    colors: [
      ["#d9824a", "#f4e6ce"],
      ["#b98a63", PEARL],
      ["#b9c0cc", PEARL]
    ],
    draw: (kit) => figure(
      ellipse2(160, 132, 34, 66, kit.body, 12),
      ellipse2(146, 66, 30, 30, kit.body),
      ellipse2(160, 128, 14, 46, kit.second, 12),
      both(
        (side) => blob(
          [100 + side * 40, 62, 100 + side * 46, 32, 100 + side * 22, 52],
          kit.body,
          10
        )
      ),
      torso(kit.body, 50),
      head(kit.body, 54, 50, 98),
      both((side) => ellipse2(100 + side * 23, 114, 21, 18, kit.second)),
      belly(kit.second, 26, 152),
      eyes(kit, 24, 92),
      nose(106, 5, 3.8, kit.ink),
      path2("M96,112 L104,112 L103,122 L97,122 Z", PEARL)
    )
  },
  porcupine: {
    colors: [
      ["#b98a63", "#f4e6ce"],
      ["#8f6a4f", PEARL]
    ],
    draw: (kit) => figure(
      spikes(100, 108, 54, 80, 188, 352, 11, kit.body, 6),
      path2(
        "M34,200 C30,150 46,96 100,96 C154,96 170,150 166,200 Z",
        kit.body
      ),
      ellipse2(100, 108, 60, 54, kit.body),
      both((side) => ellipse2(100 + side * 36, 82, 10, 10, kit.second)),
      path2(
        "M56,200 C54,160 62,104 100,96 C138,104 146,160 144,200 Z",
        kit.second
      ),
      eyes(kit, 20, 118),
      nose(132, 6, 4.6, kit.ink),
      smile(140, 7, 5, kit.ink)
    )
  },
  koala: {
    colors: [
      ["#c9d2dc", PEARL],
      ["#b9c0cc", "#f4e6ce"]
    ],
    draw: (kit) => figure(
      roundEars(kit.body, kit.second, 58, 72, 28),
      torso(kit.body),
      head(kit.body, 56, 52),
      belly(kit.second),
      eyes(kit, 30, 96),
      ellipse2(100, 108, 12, 17, kit.ink),
      smile(130, 8, 6, kit.ink)
    )
  },
  bat: {
    colors: [
      ["#8e7fb8", "#f4c7cf"],
      ["#6f7fa8", "#dcd3f4"]
    ],
    draw: (kit) => figure(
      both((side) => [
        blob(
          [100 + side * 52, 80, 100 + side * 58, 22, 100 + side * 18, 58],
          kit.body,
          12
        ),
        blob(
          [100 + side * 48, 68, 100 + side * 51, 40, 100 + side * 32, 58],
          kit.second,
          5
        )
      ]),
      both(
        (side) => blob(
          [
            100 + side * 36,
            140,
            100 + side * 96,
            112,
            100 + side * 86,
            146,
            100 + side * 96,
            172,
            100 + side * 82,
            200,
            100 + side * 36,
            200
          ],
          kit.body,
          8
        )
      ),
      torso(kit.body, 44),
      head(kit.body, 50, 46, 100),
      belly(kit.second, 22, 156),
      eyes(kit, 22, 96),
      nose(108, 4.4, 3.4, kit.ink),
      smile(116, 10, 7, kit.ink),
      both(
        (side) => blob(
          [
            100 + side * 7 - 2,
            122,
            100 + side * 7 + 2,
            122,
            100 + side * 7,
            128
          ],
          PEARL,
          2
        )
      )
    )
  }
};

// ../../../mascot/family/wild.ts
var wild = {
  anoa: {
    colors: [
      ["#b98a63", "#f4e6ce"],
      ["#c89468", "#efd2a6"]
    ],
    draw: (kit) => figure(
      both(
        (side) => blob(
          [100 + side * 18, 56, 100 + side * 30, 54, 100 + side * 40, 14],
          kit.second,
          8
        )
      ),
      both(
        (side) => ellipse2(100 + side * 62, 82, 18, 9, kit.body, side * -18)
      ),
      torso(kit.body),
      head(kit.body, 54, 52, 98),
      both((side) => ellipse2(100 + side * 34, 116, 9, 6, kit.second)),
      ellipse2(100, 126, 24, 16, kit.second),
      eyes(kit, 26, 94),
      both((side) => ellipse2(100 + side * 8, 126, 2.8, 3.6, kit.ink))
    )
  },
  deer: {
    colors: [
      ["#c89468", "#f4e6ce"],
      ["#d9a36a", PEARL]
    ],
    draw: (kit) => figure(
      both((side) => [
        line(
          `M${100 + side * 22},58 Q${100 + side * 30},32 ${100 + side * 46},14`,
          kit.second,
          7.4
        ),
        line(
          `M${100 + side * 29},38 L${100 + side * 52},36`,
          kit.second,
          7.4
        ),
        line(
          `M${100 + side * 25},50 L${100 + side * 12},30`,
          kit.second,
          7.4
        )
      ]),
      both((side) => [
        ellipse2(100 + side * 62, 82, 20, 10, kit.body, side * -24),
        ellipse2(100 + side * 62, 82, 11, 5, kit.second, side * -24)
      ]),
      torso(kit.body),
      head(kit.body, 54, 52, 98),
      both((side) => [
        ellipse2(100 + side * 18, 62, 3.6, 3.6, kit.second),
        ellipse2(100 + side * 32, 70, 3, 3, kit.second)
      ]),
      ellipse2(100, 122, 23, 18, kit.second),
      belly(kit.second),
      eyes(kit, 27, 94),
      nose(114, 7.4, 5.4, kit.ink),
      smile(124, 7, 6, kit.ink)
    )
  },
  giraffe: {
    colors: [
      ["#f7d774", "#c9783a"],
      ["#f3e7a6", "#d9824a"]
    ],
    draw: (kit) => figure(
      both((side) => [
        line(`M${100 + side * 16},52 L${100 + side * 20},28`, kit.body, 9),
        ellipse2(100 + side * 20, 24, 8, 8, kit.second)
      ]),
      both(
        (side) => ellipse2(100 + side * 54, 70, 17, 9, kit.body, side * -22)
      ),
      path2(
        "M68,200 C70,170 74,140 78,116 L122,116 C126,140 130,170 132,200 Z",
        kit.body
      ),
      head(kit.body, 46, 42, 84),
      ellipse2(86, 152, 9, 11, kit.second),
      ellipse2(113, 170, 10, 12, kit.second),
      ellipse2(106, 138, 7, 8, kit.second),
      ellipse2(84, 186, 8, 9, kit.second),
      ellipse2(70, 62, 7, 6, kit.second),
      ellipse2(128, 56, 6, 5, kit.second),
      ellipse2(100, 104, 29, 20, "#f4e6ce"),
      eyes(kit, 25, 78),
      both((side) => ellipse2(100 + side * 8, 102, 2.6, 3.4, kit.ink)),
      smile(110, 8, 6, kit.ink)
    )
  },
  zebra: {
    colors: [
      [PEARL, PEARL],
      ["#f4e6ce", "#f4e6ce"]
    ],
    draw: (kit) => figure(
      both((side) => [
        blob(
          [100 + side * 44, 60, 100 + side * 48, 26, 100 + side * 24, 48],
          kit.body,
          12
        ),
        blob(
          [100 + side * 42, 50, 100 + side * 44, 36, 100 + side * 34, 46],
          kit.ink,
          4
        )
      ]),
      blob([92, 50, 96, 22, 108, 50], kit.ink, 8),
      torso(kit.body),
      head(kit.body, 50, 54, 98),
      blob([100, 56, 96, 74, 104, 74], kit.ink, 3.4),
      both((side) => [
        blob(
          [100 + side * 50, 80, 100 + side * 30, 84, 100 + side * 49, 90],
          kit.ink,
          3.4
        ),
        blob(
          [100 + side * 52, 100, 100 + side * 34, 102, 100 + side * 50, 108],
          kit.ink,
          3.4
        ),
        blob(
          [100 + side * 22, 58, 100 + side * 18, 72, 100 + side * 27, 70],
          kit.ink,
          3.2
        ),
        blob(
          [100 + side * 58, 156, 100 + side * 38, 162, 100 + side * 60, 168],
          kit.ink,
          3.4
        ),
        blob(
          [100 + side * 60, 180, 100 + side * 40, 186, 100 + side * 60, 192],
          kit.ink,
          3.4
        )
      ]),
      ellipse2(100, 130, 30, 20, kit.ink),
      both((side) => ellipse2(100 + side * 9, 130, 2.8, 3.6, kit.body)),
      eyes(kit, 24, 94)
    )
  },
  hippo: {
    colors: [
      ["#b9a7d6", "#f4c7cf"],
      ["#aab8d8", "#f6c3a6"],
      ["#c9b6c8", "#f4c7cf"]
    ],
    draw: (kit) => figure(
      roundEars(kit.body, kit.second, 40, 48, 12),
      torso(kit.body, 62),
      head(kit.body, 54, 44, 88),
      both(
        (side) => path2(
          `M${100 + side * 16 - 6},146 L${100 + side * 16 + 6},146 L${100 + side * 16 + 5},158 L${100 + side * 16 - 5},158 Z`,
          PEARL
        )
      ),
      ellipse2(100, 122, 56, 32, kit.body),
      both((side) => ellipse2(100 + side * 20, 110, 5, 6.4, kit.ink)),
      eyes(kit, 26, 82),
      line("M66,138 Q100,150 134,138", kit.ink, 4.4)
    )
  },
  rhino: {
    colors: [
      ["#c9d2dc", PEARL],
      ["#b9c0cc", "#f4e6ce"]
    ],
    draw: (kit) => figure(
      both(
        (side) => blob(
          [100 + side * 44, 62, 100 + side * 52, 36, 100 + side * 30, 54],
          kit.body,
          10
        )
      ),
      torso(kit.body, 60),
      head(kit.body, 60, 54, 100),
      blob([90, 116, 110, 116, 100, 78], kit.second, 8),
      blob([94, 80, 106, 80, 100, 62], kit.second, 6),
      eyes(kit, 34, 96),
      both((side) => ellipse2(100 + side * 14, 132, 3.4, 4.2, kit.ink))
    )
  },
  elephant: {
    colors: [
      ["#c9d2dc", "#f4c7cf"],
      ["#cfe6f7", PEARL],
      ["#b9c0cc", PEARL]
    ],
    draw: (kit) => figure(
      both((side) => [
        ellipse2(100 + side * 62, 96, 40, 46, kit.body),
        ellipse2(100 + side * 64, 98, 24, 30, kit.second)
      ]),
      torso(kit.body, 50),
      head(kit.body, 50, 52, 96),
      belly(kit.second, 36, 136),
      both(
        (side) => ellipse2(100 + side * 24, 132, 5.6, 11, PEARL, side * -12)
      ),
      path2(
        "M84,112 C84,150 88,178 100,190 C112,178 116,150 116,112 Z",
        kit.body
      ),
      eyes(kit, 26, 90)
    )
  }
};

// ../../../mascot/animal.ts
import { Schema as Schema3 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var Animal = Schema3.Literals([
  "cat",
  "bear",
  "rabbit",
  "sheep",
  "fox",
  "panda",
  "koala",
  "frog",
  "chicken",
  "owl",
  "penguin",
  "hamster",
  "mouse",
  "cow",
  "tiger",
  "lion",
  "bee",
  "seal",
  "axolotl",
  "whale",
  "octopus",
  "komodo",
  "orangutan",
  "tarsier",
  "elephant",
  "rhino",
  "anoa",
  "turtle",
  "dog",
  "pig",
  "monkey",
  "proboscis",
  "deer",
  "giraffe",
  "zebra",
  "hippo",
  "horse",
  "goat",
  "duck",
  "cockatoo",
  "hornbill",
  "eagle",
  "parrot",
  "bat",
  "porcupine",
  "civet",
  "squirrel",
  "crab",
  "jellyfish",
  "pufferfish",
  "snail",
  "beetle",
  "crocodile",
  "raccoon",
  "flamingo",
  "peacock",
  "clownfish",
  "alpaca",
  "dragonfly",
  "spider",
  "cassowary",
  "butterfly",
  "starfish",
  "walrus",
  "snake"
]);
var DESIGNS = {
  ...bird,
  ...bug,
  ...carnivore,
  ...farm,
  ...marine,
  ...primate,
  ...reptile,
  ...small,
  ...wild
};

// ../../../mascot/ground.ts
import { Array as Arr8, Schema as Schema4 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var Ground = Schema4.Literals([
  "b9624b",
  "2f7b6e",
  "6d4b78",
  "243e66",
  "707a52",
  "b88a33",
  "56708c",
  "2e5b45",
  "b45c6e",
  "4b4fb0",
  "8e9ad6",
  "5e8f9c",
  "8c5a8f",
  "3f6fa0",
  "7c9a6e",
  "c7788a",
  "f4e6ce",
  "cfe6f7",
  "f7d774",
  "f4c7cf",
  "ddebb5",
  "dcd3f4"
]);

// ../../../mascot/pose.ts
import { Record, Schema as Schema5 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var POSES = {
  right: { look: -2.6, size: 1.16, turn: -10, x: 34, y: 18 },
  left: { look: 2.6, size: 1.16, turn: 10, x: -34, y: 18 },
  center: { look: 0, size: 1.04, turn: 0, x: 0, y: 4 },
  peek: { look: 0, size: 1.12, turn: 0, x: 0, y: 54 },
  "peek-right": { look: -2.6, size: 1.14, turn: -14, x: 44, y: 46 },
  "peek-left": { look: 2.6, size: 1.14, turn: 14, x: -44, y: 46 }
};
var Pose = Schema5.Literals(Record.keys(POSES));

// ../../../mascot/code.ts
import { Schema as Schema6, SchemaParser, SchemaTransformation } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var Mascot = Schema6.Struct({
  animal: Animal,
  eyes: Eyes,
  ground: Ground,
  palette: Schema6.Int.check(Schema6.isGreaterThanOrEqualTo(0)),
  pose: Pose
}).check(
  Schema6.makeFilter(
    ({ animal, palette }) => palette < DESIGNS[animal].colors.length ? void 0 : { issue: `${animal} has no palette ${palette}`, path: ["palette"] }
  )
);
var PaletteDigits = Schema6.String.check(
  Schema6.isPattern(/^(?:0|[1-9][0-9]*)$/u)
).pipe(
  Schema6.decodeTo(
    Schema6.Int,
    SchemaTransformation.transform({ decode: Number, encode: String })
  )
);
var MascotText = Schema6.TemplateLiteralParser([
  Animal,
  ".",
  PaletteDigits,
  ".",
  Ground,
  ".",
  Pose,
  ".",
  Eyes
]).pipe(
  Schema6.decodeTo(
    Mascot,
    SchemaTransformation.transform({
      decode: ([animal, , palette, , ground, , pose, , eyes2]) => ({
        animal,
        eyes: eyes2,
        ground,
        palette,
        pose
      }),
      encode: ({ animal, eyes: eyes2, ground, palette, pose }) => [animal, ".", palette, ".", ground, ".", pose, ".", eyes2]
    })
  )
);
var MascotCode = Schema6.String.pipe(
  Schema6.decodeTo(
    Mascot,
    SchemaTransformation.transformEffect({
      decode: (text, options) => SchemaParser.decodeUnknownEffect(MascotText)(text, options),
      encode: (mascot, options) => SchemaParser.encodeEffect(MascotText)(mascot, options)
    })
  )
);
var encodeCode = Schema6.encodeSync(MascotCode);

export {
  MascotCode
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvbWFzY290L3JvdW5kLnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL21hc2NvdC9zaGFwZS50cyIsICIuLi8uLi8uLi8uLi8uLi8uLi8uLi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9tYXNjb3Qva2l0LnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL21hc2NvdC9mYW1pbHkvYmlyZC50cyIsICIuLi8uLi8uLi8uLi8uLi8uLi8uLi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9tYXNjb3QvZmFtaWx5L2J1Zy50cyIsICIuLi8uLi8uLi8uLi8uLi8uLi8uLi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9tYXNjb3QvZmFtaWx5L2Nhcm5pdm9yZS50cyIsICIuLi8uLi8uLi8uLi8uLi8uLi8uLi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9tYXNjb3QvZmFtaWx5L2Zhcm0udHMiLCAiLi4vLi4vLi4vLi4vLi4vLi4vLi4vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvbWFzY290L2ZhbWlseS9tYXJpbmUudHMiLCAiLi4vLi4vLi4vLi4vLi4vLi4vLi4vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvbWFzY290L2ZhbWlseS9wcmltYXRlLnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL21hc2NvdC9mYW1pbHkvcmVwdGlsZS50cyIsICIuLi8uLi8uLi8uLi8uLi8uLi8uLi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9tYXNjb3QvZmFtaWx5L3NtYWxsLnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL21hc2NvdC9mYW1pbHkvd2lsZC50cyIsICIuLi8uLi8uLi8uLi8uLi8uLi8uLi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9tYXNjb3QvYW5pbWFsLnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL21hc2NvdC9ncm91bmQudHMiLCAiLi4vLi4vLi4vLi4vLi4vLi4vLi4vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvbWFzY290L3Bvc2UudHMiLCAiLi4vLi4vLi4vLi4vLi4vLi4vLi4vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvbWFzY290L2NvZGUudHMiXSwKICAic291cmNlUm9vdCI6ICJmaWxlOi8vL3Zhci9mb2xkZXJzL2d6L3JubTR6bl9zNHR6MjZuNG05eWIyMTFiMDAwMDBnbi9UL2NvbmZlY3QtY29udGV4dC1xY05sbEUvb3V0cHV0LyIsCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9tYXNjb3Qvcm91bmQudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL21hc2NvdFwiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvbWFzY290L3JvdW5kLnRzXCI7aW1wb3J0IHsgTnVtYmVyIGFzIE51bSB9IGZyb20gXCJlZmZlY3RcIjtcblxuLyoqIFJvdW5kcyB0byBvbmUgZGVjaW1hbCwgdGhlIHByZWNpc2lvbiB0aGUgcG9pbnRzIG9mIGEgZHJhd2luZyBhcmUgd3JpdHRlbiBpbi4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0ZW50aCh2YWx1ZTogbnVtYmVyKSB7XG4gIHJldHVybiBOdW0ucm91bmQodmFsdWUsIDEpO1xufVxuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL21hc2NvdC9zaGFwZS50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvbWFzY290XCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9tYXNjb3Qvc2hhcGUudHNcIjtpbXBvcnQgeyBTY2hlbWEgfSBmcm9tIFwiZWZmZWN0XCI7XG5cbi8qKlxuICogSG93IGEgZmxhdCBzaGFwZSBpcyBmaWxsZWQsIGxpbmVkLCBhbmQgcGxhY2VkLiBFdmVyeSBwaWN0dXJlIG9mIHRoZSBpZGVudGl0eSxcbiAqIGFuIGFuaW1hbCwgTmluYSwgb3Igb25lIG9mIGhlciB0aGluZ3MsIGlzIGRyYXduIHdpdGggdGhlc2UgYW5kIG5vdGhpbmcgZWxzZS5cbiAqL1xuY29uc3QgUEFJTlQgPSB7XG4gIC8qKiBUaGUgY29sb3VyIHRoYXQgYGN1cnJlbnRDb2xvcmAgcmVhZHMsIGZvciB0aGlzIHNoYXBlIGFuZCB3aGF0IGl0IGhvbGRzLiAqL1xuICBjb2xvcjogU2NoZW1hLm9wdGlvbmFsS2V5KFNjaGVtYS5TdHJpbmcpLFxuICBmaWxsOiBTY2hlbWEub3B0aW9uYWxLZXkoU2NoZW1hLlN0cmluZyksXG4gIGZpbGxPcGFjaXR5OiBTY2hlbWEub3B0aW9uYWxLZXkoU2NoZW1hLkZpbml0ZSksXG4gIGZpbGxSdWxlOiBTY2hlbWEub3B0aW9uYWxLZXkoU2NoZW1hLkxpdGVyYWwoXCJldmVub2RkXCIpKSxcbiAgb3BhY2l0eTogU2NoZW1hLm9wdGlvbmFsS2V5KFNjaGVtYS5GaW5pdGUpLFxuICBzdHJva2U6IFNjaGVtYS5vcHRpb25hbEtleShTY2hlbWEuU3RyaW5nKSxcbiAgc3Ryb2tlRGFzaGFycmF5OiBTY2hlbWEub3B0aW9uYWxLZXkoU2NoZW1hLlN0cmluZyksXG4gIHN0cm9rZUxpbmVjYXA6IFNjaGVtYS5vcHRpb25hbEtleShTY2hlbWEuTGl0ZXJhbChcInJvdW5kXCIpKSxcbiAgc3Ryb2tlTGluZWpvaW46IFNjaGVtYS5vcHRpb25hbEtleShTY2hlbWEuTGl0ZXJhbChcInJvdW5kXCIpKSxcbiAgc3Ryb2tlT3BhY2l0eTogU2NoZW1hLm9wdGlvbmFsS2V5KFNjaGVtYS5GaW5pdGUpLFxuICBzdHJva2VXaWR0aDogU2NoZW1hLm9wdGlvbmFsS2V5KFNjaGVtYS5GaW5pdGUpLFxuICB0cmFuc2Zvcm06IFNjaGVtYS5vcHRpb25hbEtleShTY2hlbWEuU3RyaW5nKSxcbn07XG5cbmNvbnN0IFBhdGhGaWVsZHMgPSBTY2hlbWEuU3RydWN0KHtcbiAgLi4uUEFJTlQsXG4gIGQ6IFNjaGVtYS5TdHJpbmcsXG4gIC8qKiBUaGUgbGVuZ3RoIHRoZSBwYXRoIGNvdW50cyBhcywgc28gYSBsaW5lIHRoYXQgZHJhd3MgaXRzZWxmIHJ1bnMgZnJvbSAxIHRvIDAuICovXG4gIHBhdGhMZW5ndGg6IFNjaGVtYS5vcHRpb25hbEtleShTY2hlbWEuRmluaXRlKSxcbn0pO1xuXG5jb25zdCBFbGxpcHNlRmllbGRzID0gU2NoZW1hLlN0cnVjdCh7XG4gIC4uLlBBSU5ULFxuICBjeDogU2NoZW1hLkZpbml0ZSxcbiAgY3k6IFNjaGVtYS5GaW5pdGUsXG4gIHJ4OiBTY2hlbWEuRmluaXRlLFxuICByeTogU2NoZW1hLkZpbml0ZSxcbn0pO1xuXG5jb25zdCBDaXJjbGVGaWVsZHMgPSBTY2hlbWEuU3RydWN0KHtcbiAgLi4uUEFJTlQsXG4gIGN4OiBTY2hlbWEuRmluaXRlLFxuICBjeTogU2NoZW1hLkZpbml0ZSxcbiAgcjogU2NoZW1hLkZpbml0ZSxcbn0pO1xuXG5jb25zdCBSZWN0RmllbGRzID0gU2NoZW1hLlN0cnVjdCh7XG4gIC4uLlBBSU5ULFxuICBoZWlnaHQ6IFNjaGVtYS5GaW5pdGUsXG4gIHJ4OiBTY2hlbWEub3B0aW9uYWxLZXkoU2NoZW1hLkZpbml0ZSksXG4gIHdpZHRoOiBTY2hlbWEuRmluaXRlLFxuICB4OiBTY2hlbWEub3B0aW9uYWxLZXkoU2NoZW1hLkZpbml0ZSksXG4gIHk6IFNjaGVtYS5vcHRpb25hbEtleShTY2hlbWEuRmluaXRlKSxcbn0pO1xuXG5jb25zdCBQb2x5Z29uRmllbGRzID0gU2NoZW1hLlN0cnVjdCh7XG4gIC4uLlBBSU5ULFxuICBwb2ludHM6IFNjaGVtYS5TdHJpbmcsXG59KTtcblxuY29uc3QgR3JvdXBGaWVsZHMgPSBTY2hlbWEuU3RydWN0KFBBSU5UKTtcblxuLyoqXG4gKiBBIHNoYXBlIHRoYXQgaG9sZHMgbm8gb3RoZXIgc2hhcGUuIEl0cyB0YWcgaXMgdGhlIG5hbWUgb2YgdGhlIFNWRyBlbGVtZW50XG4gKiB0aGF0IGRyYXdzIGl0LCBzbyBub3RoaW5nIGhhcyB0byB0cmFuc2xhdGUgb25lIGludG8gdGhlIG90aGVyLlxuICovXG5jb25zdCBMZWFmU2NoZW1hID0gU2NoZW1hLlVuaW9uKFtcbiAgU2NoZW1hLlRhZ2dlZFN0cnVjdChcInBhdGhcIiwgUGF0aEZpZWxkcy5maWVsZHMpLFxuICBTY2hlbWEuVGFnZ2VkU3RydWN0KFwiZWxsaXBzZVwiLCBFbGxpcHNlRmllbGRzLmZpZWxkcyksXG4gIFNjaGVtYS5UYWdnZWRTdHJ1Y3QoXCJjaXJjbGVcIiwgQ2lyY2xlRmllbGRzLmZpZWxkcyksXG4gIFNjaGVtYS5UYWdnZWRTdHJ1Y3QoXCJyZWN0XCIsIFJlY3RGaWVsZHMuZmllbGRzKSxcbiAgU2NoZW1hLlRhZ2dlZFN0cnVjdChcInBvbHlnb25cIiwgUG9seWdvbkZpZWxkcy5maWVsZHMpLFxuXSk7XG5cbnR5cGUgR3JvdXBQYWludCA9IHR5cGVvZiBHcm91cEZpZWxkcy5UeXBlO1xuXG4vKipcbiAqIFdoYXQgYSBwaWN0dXJlIHNheXMgYWJvdXQgb25lIG9mIGl0cyBzaGFwZXMgYmV5b25kIGhvdyBpdCBpcyBkcmF3bjogdGhlIGV5ZVxuICogb2YgYW4gYW5pbWFsLCBhIGxpbWIgb2YgTmluYSwgdGhlIHNtYWxsIG1vdGlvbiBvZiBhIHRoaW5nLiBFYWNoIGtpbmQgb2ZcbiAqIHBpY3R1cmUgYnJpbmdzIGl0cyBvd24gbWFya3MsIGFuZCBhIHNoYXBlIG1heSBjYXJyeSBvbmUuXG4gKi9cbmludGVyZmFjZSBNYXJrZWQ8TWFyaz4ge1xuICByZWFkb25seSBtYXJrPzogTWFyaztcbn1cblxuLyoqIFNoYXBlcyBkcmF3biB0b2dldGhlciwgdW5kZXIgb25lIHBhaW50IGFuZCBvbmUgdHJhbnNmb3JtLiAqL1xuaW50ZXJmYWNlIEdyb3VwPE1hcms+IGV4dGVuZHMgR3JvdXBQYWludCwgTWFya2VkPE1hcms+IHtcbiAgcmVhZG9ubHkgX3RhZzogXCJnXCI7XG4gIHJlYWRvbmx5IGNoaWxkcmVuOiByZWFkb25seSBTaGFwZTxNYXJrPltdO1xufVxuXG4vKiogT25lIGZsYXQgc2hhcGUgb2YgYSBwaWN0dXJlLCBvciBhIGdyb3VwIG9mIHRoZW0uICovXG5leHBvcnQgdHlwZSBTaGFwZTxNYXJrID0gbmV2ZXI+ID1cbiAgfCAodHlwZW9mIExlYWZTY2hlbWEuVHlwZSAmIE1hcmtlZDxNYXJrPilcbiAgfCBHcm91cDxNYXJrPjtcblxuLyoqIERyYXdzIGEgcGF0aC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXRoPGNvbnN0IE1hcmsgPSBuZXZlcj4oXG4gIGZpZWxkczogdHlwZW9mIFBhdGhGaWVsZHMuVHlwZSAmIE1hcmtlZDxNYXJrPlxuKSB7XG4gIHJldHVybiB7IF90YWc6IFwicGF0aFwiLCAuLi5maWVsZHMgfSBhcyBjb25zdCBzYXRpc2ZpZXMgU2hhcGU8TWFyaz47XG59XG5cbi8qKiBEcmF3cyBhbiBlbGxpcHNlLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVsbGlwc2U8Y29uc3QgTWFyayA9IG5ldmVyPihcbiAgZmllbGRzOiB0eXBlb2YgRWxsaXBzZUZpZWxkcy5UeXBlICYgTWFya2VkPE1hcms+XG4pIHtcbiAgcmV0dXJuIHsgX3RhZzogXCJlbGxpcHNlXCIsIC4uLmZpZWxkcyB9IGFzIGNvbnN0IHNhdGlzZmllcyBTaGFwZTxNYXJrPjtcbn1cblxuLyoqIERyYXdzIGEgY2lyY2xlLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNpcmNsZTxjb25zdCBNYXJrID0gbmV2ZXI+KFxuICBmaWVsZHM6IHR5cGVvZiBDaXJjbGVGaWVsZHMuVHlwZSAmIE1hcmtlZDxNYXJrPlxuKSB7XG4gIHJldHVybiB7IF90YWc6IFwiY2lyY2xlXCIsIC4uLmZpZWxkcyB9IGFzIGNvbnN0IHNhdGlzZmllcyBTaGFwZTxNYXJrPjtcbn1cblxuLyoqIERyYXdzIGEgcmVjdGFuZ2xlLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlY3Q8Y29uc3QgTWFyayA9IG5ldmVyPihcbiAgZmllbGRzOiB0eXBlb2YgUmVjdEZpZWxkcy5UeXBlICYgTWFya2VkPE1hcms+XG4pIHtcbiAgcmV0dXJuIHsgX3RhZzogXCJyZWN0XCIsIC4uLmZpZWxkcyB9IGFzIGNvbnN0IHNhdGlzZmllcyBTaGFwZTxNYXJrPjtcbn1cblxuLyoqIERyYXdzIGEgcG9seWdvbiBmcm9tIGl0cyBwb2ludHMsIHdyaXR0ZW4gYXMgU1ZHIHdyaXRlcyB0aGVtLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBvbHlnb248Y29uc3QgTWFyayA9IG5ldmVyPihcbiAgZmllbGRzOiB0eXBlb2YgUG9seWdvbkZpZWxkcy5UeXBlICYgTWFya2VkPE1hcms+XG4pIHtcbiAgcmV0dXJuIHsgX3RhZzogXCJwb2x5Z29uXCIsIC4uLmZpZWxkcyB9IGFzIGNvbnN0IHNhdGlzZmllcyBTaGFwZTxNYXJrPjtcbn1cblxuLyoqIERyYXdzIHNoYXBlcyB0b2dldGhlciwgdW5kZXIgb25lIHBhaW50IGFuZCBvbmUgdHJhbnNmb3JtLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdyb3VwPGNvbnN0IE1hcmsgPSBuZXZlcj4oXG4gIGNoaWxkcmVuOiByZWFkb25seSBTaGFwZTxNYXJrPltdLFxuICBmaWVsZHM/OiBHcm91cFBhaW50ICYgTWFya2VkPE1hcms+XG4pIHtcbiAgcmV0dXJuIHsgX3RhZzogXCJnXCIsIGNoaWxkcmVuLCAuLi5maWVsZHMgfSBhcyBjb25zdCBzYXRpc2ZpZXMgU2hhcGU8TWFyaz47XG59XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvbWFzY290L2tpdC50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvbWFzY290XCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9tYXNjb3Qva2l0LnRzXCI7aW1wb3J0IHsgdGVudGggfSBmcm9tIFwiQHJlcG8vbWFzY290L3JvdW5kXCI7XG5pbXBvcnQge1xuICBlbGxpcHNlIGFzIGRyYXdFbGxpcHNlLFxuICBwYXRoIGFzIGRyYXdQYXRoLFxuICBncm91cCxcbiAgcG9seWdvbixcbiAgdHlwZSBTaGFwZSxcbn0gZnJvbSBcIkByZXBvL21hc2NvdC9zaGFwZVwiO1xuaW1wb3J0IHsgQXJyYXkgYXMgQXJyLCBNYXRjaCwgU2NoZW1hIH0gZnJvbSBcImVmZmVjdFwiO1xuXG4vKiogVGhlIGluayBvZiBldmVyeSBleWUsIG1vdXRoLCBhbmQgbm9zZS4gKi9cbmV4cG9ydCBjb25zdCBJTksgPSBcIiMxNTI5NGZcIjtcblxuLyoqIFRoZSBsaWdodCB0aGF0IHNoaW5lcyBpbiBhbiBvcGVuIGV5ZS4gKi9cbmNvbnN0IFNISU5FID0gXCIjZmZmZmZmXCI7XG5cbi8qKiBUaGUgc29mdCBwaW5rIG9mIHRoZSBjaGVla3MgdW5kZXIgZGFyayBleWVzLiAqL1xuY29uc3QgQkxVU0ggPSBcIiNmNDhmYjFcIjtcblxuLyoqIFRoZSBwYWxlIHdoaXRlIHRoYXQgc2V2ZXJhbCBhbmltYWxzIHNoYXJlLiAqL1xuZXhwb3J0IGNvbnN0IFBFQVJMID0gXCIjZjZmNGVmXCI7XG5cbi8qKiBXaGF0IGFuIGFuaW1hbCBtYXJrcyBpbiBpdHMgZHJhd2luZzogdGhlIG9wZW4gZXllcywgd2hpY2ggY2FuIGZvbGxvdyB0aGUgcG9pbnRlci4gKi9cbmV4cG9ydCBjb25zdCBNYXJrID0gU2NoZW1hLkxpdGVyYWwoXCJleWVcIik7XG5cbi8qKiBPbmUgbGF5ZXIgb2YgYW4gYW5pbWFsLCBvciBsYXllcnMgZHJhd24gdG9nZXRoZXIuICovXG5leHBvcnQgdHlwZSBMYXllciA9IFNoYXBlPHR5cGVvZiBNYXJrLlR5cGU+O1xuXG4vKiogV2hhdCB0aGUgZXllcyBvZiBhbiBhbmltYWwgZG86IG9wZW4sIHNtaWxpbmcsIG9uZSB3aW5raW5nLCBvciBhc2xlZXAuICovXG5leHBvcnQgY29uc3QgRXllcyA9IFNjaGVtYS5MaXRlcmFscyhbXCJvcGVuXCIsIFwic21pbGVcIiwgXCJ3aW5rXCIsIFwiYXNsZWVwXCJdKTtcblxuLyoqXG4gKiBXaGF0IGFuIGFuaW1hbCBpcyBkcmF3biB3aXRoOiB0aGUgY29sb3VycyBvZiBpdHMgcGFsZXR0ZSwgdGhlIGluaywgaG93IGl0c1xuICogZXllcyBsb29rLCBhbmQgaG93IGZhciBpdHMgcG9zZSB0dXJucyB0aGVtIHRvIHRoZSBzaWRlLlxuICovXG5jb25zdCBLaXQgPSBTY2hlbWEuU3RydWN0KHtcbiAgYm9keTogU2NoZW1hLlN0cmluZyxcbiAgZXllczogRXllcyxcbiAgaW5rOiBTY2hlbWEuU3RyaW5nLFxuICBsb29rOiBTY2hlbWEuRmluaXRlLFxuICBzZWNvbmQ6IFNjaGVtYS5TdHJpbmcsXG59KTtcblxuLyoqIE9uZSBhbmltYWw6IGl0cyBwYWxldHRlcyBhcyBbYm9keSwgc2Vjb25kXSBjb2xvdXIgcGFpcnMsIGFuZCBob3cgdG8gZHJhdyBpdC4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRGVzaWduIHtcbiAgcmVhZG9ubHkgY29sb3JzOiByZWFkb25seSAocmVhZG9ubHkgW3N0cmluZywgc3RyaW5nXSlbXTtcbiAgcmVhZG9ubHkgZHJhdzogKGtpdDogdHlwZW9mIEtpdC5UeXBlKSA9PiByZWFkb25seSBMYXllcltdO1xufVxuXG4vKiogVGhlIGxheWVycyBvZiBhbiBhbmltYWwsIGJhY2sgdG8gZnJvbnQsIHdpdGggZWFjaCBncm91cCBvZiBsYXllcnMgbGFpZCBmbGF0LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZpZ3VyZSguLi5sYXllcnM6IHJlYWRvbmx5IChMYXllciB8IHJlYWRvbmx5IExheWVyW10pW10pIHtcbiAgcmV0dXJuIEFyci5mbGF0TWFwKGxheWVycywgQXJyLmVuc3VyZSk7XG59XG5cbi8qKiBEcmF3cyBhIGxheWVyIG9uY2Ugb24gZWFjaCBzaWRlIG9mIHRoZSBjZW50cmUgbGluZS4gVGhlIGxheWVyIHJlY2VpdmVzIC0xIG9yIDEuICovXG5leHBvcnQgZnVuY3Rpb24gYm90aDxBIGV4dGVuZHMgTGF5ZXI+KFxuICBsYXllcjogKHNpZGU6IG51bWJlcikgPT4gQSB8IHJlYWRvbmx5IEFbXVxuKSB7XG4gIHJldHVybiBBcnIuZmxhdE1hcChbLTEsIDFdLCAoc2lkZSkgPT4gQXJyLmVuc3VyZShsYXllcihzaWRlKSkpO1xufVxuXG4vKiogQW4gZWxsaXBzZSwgdHVybmVkIGJ5IGB0dXJuYCBkZWdyZWVzIGFib3V0IGl0cyBvd24gY2VudHJlLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVsbGlwc2UoXG4gIGN4OiBudW1iZXIsXG4gIGN5OiBudW1iZXIsXG4gIHJ4OiBudW1iZXIsXG4gIHJ5OiBudW1iZXIsXG4gIGZpbGw6IHN0cmluZyxcbiAgdHVybiA9IDBcbikge1xuICByZXR1cm4gZHJhd0VsbGlwc2Uoe1xuICAgIGN4OiB0ZW50aChjeCksXG4gICAgY3k6IHRlbnRoKGN5KSxcbiAgICBmaWxsLFxuICAgIHJ4OiB0ZW50aChyeCksXG4gICAgcnk6IHRlbnRoKHJ5KSxcbiAgICAuLi4odHVybiA9PT0gMFxuICAgICAgPyB7fVxuICAgICAgOiB7IHRyYW5zZm9ybTogYHJvdGF0ZSgke3R1cm59ICR7dGVudGgoY3gpfSAke3RlbnRoKGN5KX0pYCB9KSxcbiAgfSk7XG59XG5cbi8qKiBBIGZsYXQgcGF0aC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXRoKGQ6IHN0cmluZywgZmlsbDogc3RyaW5nKSB7XG4gIHJldHVybiBkcmF3UGF0aCh7IGQsIGZpbGwgfSk7XG59XG5cbi8qKiBBIHBhdGggd2hvc2UgY29ybmVycyBhbiBvdXRsaW5lIHJvdW5kcy4gKi9cbmV4cG9ydCBmdW5jdGlvbiBvdXRsaW5lZChcbiAgZDogc3RyaW5nLFxuICBmaWxsOiBzdHJpbmcsXG4gIGNvbG9yOiBzdHJpbmcsXG4gIHdpZHRoOiBudW1iZXJcbikge1xuICByZXR1cm4gZHJhd1BhdGgoe1xuICAgIGQsXG4gICAgZmlsbCxcbiAgICBzdHJva2U6IGNvbG9yLFxuICAgIHN0cm9rZUxpbmVqb2luOiBcInJvdW5kXCIsXG4gICAgc3Ryb2tlV2lkdGg6IHdpZHRoLFxuICB9KTtcbn1cblxuLyoqIEEgcG9seWdvbiBmcm9tIGZsYXQgYHgsIHlgIHBhaXJzLCBpdHMgY29ybmVycyByb3VuZGVkIGJ5IGEgc3Ryb2tlIG9mIGB3aWR0aGAuICovXG5leHBvcnQgZnVuY3Rpb24gYmxvYihwb2ludHM6IHJlYWRvbmx5IG51bWJlcltdLCBmaWxsOiBzdHJpbmcsIHdpZHRoOiBudW1iZXIpIHtcbiAgcmV0dXJuIHBvbHlnb24oe1xuICAgIGZpbGwsXG4gICAgcG9pbnRzOiBBcnIuam9pbihcbiAgICAgIEFyci5tYXAoQXJyLmNodW5rc09mKHBvaW50cywgMiksIChbeCwgeV0pID0+IGAke3RlbnRoKHgpfSwke3RlbnRoKHkpfWApLFxuICAgICAgXCIgXCJcbiAgICApLFxuICAgIHN0cm9rZTogZmlsbCxcbiAgICBzdHJva2VMaW5lam9pbjogXCJyb3VuZFwiLFxuICAgIHN0cm9rZVdpZHRoOiB3aWR0aCxcbiAgfSk7XG59XG5cbi8qKiBBIHN0cm9rZSB3aXRoIHJvdW5kIGVuZHMuICovXG5leHBvcnQgZnVuY3Rpb24gbGluZShkOiBzdHJpbmcsIGNvbG9yOiBzdHJpbmcsIHdpZHRoOiBudW1iZXIpIHtcbiAgcmV0dXJuIGRyYXdQYXRoKHtcbiAgICBkLFxuICAgIGZpbGw6IFwibm9uZVwiLFxuICAgIHN0cm9rZTogY29sb3IsXG4gICAgc3Ryb2tlTGluZWNhcDogXCJyb3VuZFwiLFxuICAgIHN0cm9rZUxpbmVqb2luOiBcInJvdW5kXCIsXG4gICAgc3Ryb2tlV2lkdGg6IHdpZHRoLFxuICB9KTtcbn1cblxuLyoqIExheWVycyBkcmF3biB0b2dldGhlciBhdCBvbmUgb3BhY2l0eS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmYWRlZChvcGFjaXR5OiBudW1iZXIsIGxheWVyczogcmVhZG9ubHkgTGF5ZXJbXSkge1xuICByZXR1cm4gZ3JvdXAobGF5ZXJzLCB7IG9wYWNpdHkgfSk7XG59XG5cbi8qKiBUaGUgaGVhZDogYW4gZWxsaXBzZSBvbiB0aGUgY2VudHJlIGxpbmUuICovXG5leHBvcnQgZnVuY3Rpb24gaGVhZChmaWxsOiBzdHJpbmcsIHJ4ID0gNjAsIHJ5ID0gNTIsIGN5ID0gOTgpIHtcbiAgcmV0dXJuIGVsbGlwc2UoMTAwLCBjeSwgcngsIHJ5LCBmaWxsKTtcbn1cblxuLyoqIFRoZSB0b3JzbywgcmlzaW5nIGZyb20gdGhlIGJvdHRvbSBlZGdlIHRvIHRoZSBzaG91bGRlcnMuICovXG5leHBvcnQgZnVuY3Rpb24gdG9yc28oZmlsbDogc3RyaW5nLCBoYWxmID0gNTYpIHtcbiAgcmV0dXJuIHBhdGgoXG4gICAgYE0kezEwMCAtIGhhbGZ9LDIwMCBDJHs5OCAtIGhhbGZ9LDE3MCAkezEwOCAtIGhhbGZ9LDE0MiAkezEyMCAtIGhhbGZ9LDEyNiBMJHs4MCArIGhhbGZ9LDEyNiBDJHs5MiArIGhhbGZ9LDE0MiAkezEwMiArIGhhbGZ9LDE3MCAkezEwMCArIGhhbGZ9LDIwMCBaYCxcbiAgICBmaWxsXG4gICk7XG59XG5cbi8qKiBUaGUgYmVsbHk6IGEgcGFsZSBwYXRjaCBmcm9tIHRoZSBib3R0b20gZWRnZSB1cCB0byBgdG9wYC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBiZWxseShmaWxsOiBzdHJpbmcsIGhhbGYgPSAzMCwgdG9wID0gMTQ4KSB7XG4gIHJldHVybiBwYXRoKFxuICAgIGBNJHsxMDAgLSBoYWxmfSwyMDAgQyR7MTAwIC0gaGFsZn0sMTc4ICR7MTA4IC0gaGFsZn0sJHt0b3AgKyA0fSAxMDAsJHt0b3B9IEMkezkyICsgaGFsZn0sJHt0b3AgKyA0fSAkezEwMCArIGhhbGZ9LDE3OCAkezEwMCArIGhhbGZ9LDIwMCBaYCxcbiAgICBmaWxsXG4gICk7XG59XG5cbi8qKiBUaGUgbm9zZTogYSBzbWFsbCBlbGxpcHNlIG9uIHRoZSBjZW50cmUgbGluZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBub3NlKHk6IG51bWJlciwgcng6IG51bWJlciwgcnk6IG51bWJlciwgaW5rOiBzdHJpbmcpIHtcbiAgcmV0dXJuIGVsbGlwc2UoMTAwLCB5LCByeCwgcnksIGluayk7XG59XG5cbi8qKiBBIG1vdXRoOiBhIGNsb3NlZCBsZW5zLCBkcmF3biB3aXRoIGFuIG91dGxpbmUgb2YgaXRzIG93biBjb2xvdXIuICovXG5leHBvcnQgZnVuY3Rpb24gc21pbGUoeTogbnVtYmVyLCB3aWRlOiBudW1iZXIsIGRlZXA6IG51bWJlciwgaW5rOiBzdHJpbmcpIHtcbiAgcmV0dXJuIG91dGxpbmVkKFxuICAgIGBNJHsxMDAgLSB3aWRlfSwke3l9IFExMDAsJHt0ZW50aCh5ICsgZGVlcCAqIDAuNjIpfSAkezEwMCArIHdpZGV9LCR7eX0gUTEwMCwke3RlbnRoKHkgKyBkZWVwICogMS41KX0gJHsxMDAgLSB3aWRlfSwke3l9IFpgLFxuICAgIGluayxcbiAgICBpbmssXG4gICAgMi42XG4gICk7XG59XG5cbi8qKiBPbmUgZXllOiBhbiBvcGVuIGV5ZSB3aXRoIGl0cyBzaGluZSwgd2hpY2ggZm9sbG93cyB0aGUgcG9pbnRlciwgYSBzbWlsaW5nIGFyYywgb3IgYSBzbGVlcGluZyBhcmMuICovXG5leHBvcnQgZnVuY3Rpb24gZXllKFxuICBraW5kOiB0eXBlb2YgRXllcy5UeXBlLFxuICB4OiBudW1iZXIsXG4gIHk6IG51bWJlcixcbiAgcjogbnVtYmVyLFxuICBpbms6IHN0cmluZ1xuKSB7XG4gIHJldHVybiBNYXRjaC52YWx1ZShraW5kKS5waXBlKFxuICAgIE1hdGNoLndoZW4oXCJzbWlsZVwiLCAoKSA9PlxuICAgICAgbGluZShcbiAgICAgICAgYE0ke3RlbnRoKHggLSByKX0sJHt0ZW50aCh5ICsgMil9IFEke3RlbnRoKHgpfSwke3RlbnRoKHkgLSByIC0gMil9ICR7dGVudGgoeCArIHIpfSwke3RlbnRoKHkgKyAyKX1gLFxuICAgICAgICBpbmssXG4gICAgICAgIDQuNlxuICAgICAgKVxuICAgICksXG4gICAgTWF0Y2gud2hlbihcImFzbGVlcFwiLCAoKSA9PlxuICAgICAgbGluZShcbiAgICAgICAgYE0ke3RlbnRoKHggLSByKX0sJHt0ZW50aCh5IC0gMSl9IFEke3RlbnRoKHgpfSwke3RlbnRoKHkgKyByKX0gJHt0ZW50aCh4ICsgcil9LCR7dGVudGgoeSAtIDEpfWAsXG4gICAgICAgIGluayxcbiAgICAgICAgNC42XG4gICAgICApXG4gICAgKSxcbiAgICBNYXRjaC5vckVsc2UoKCkgPT5cbiAgICAgIGdyb3VwKFxuICAgICAgICBbXG4gICAgICAgICAgZHJhd0VsbGlwc2Uoe1xuICAgICAgICAgICAgY3g6IHRlbnRoKHgpLFxuICAgICAgICAgICAgY3k6IHRlbnRoKHkpLFxuICAgICAgICAgICAgZmlsbDogaW5rLFxuICAgICAgICAgICAgcng6IHRlbnRoKHIpLFxuICAgICAgICAgICAgcnk6IHRlbnRoKHIgKiAxLjIyKSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICAuLi4oaW5rID09PSBJTktcbiAgICAgICAgICAgID8gW1xuICAgICAgICAgICAgICAgIGRyYXdFbGxpcHNlKHtcbiAgICAgICAgICAgICAgICAgIGN4OiB0ZW50aCh4IC0gciAqIDAuMyksXG4gICAgICAgICAgICAgICAgICBjeTogdGVudGgoeSAtIHIgKiAwLjQyKSxcbiAgICAgICAgICAgICAgICAgIGZpbGw6IFNISU5FLFxuICAgICAgICAgICAgICAgICAgcng6IHRlbnRoKHIgKiAwLjM4KSxcbiAgICAgICAgICAgICAgICAgIHJ5OiB0ZW50aChyICogMC4zOCksXG4gICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIDogW10pLFxuICAgICAgICBdLFxuICAgICAgICB7IG1hcms6IE1hcmsubGl0ZXJhbCB9XG4gICAgICApXG4gICAgKVxuICApO1xufVxuXG4vKipcbiAqIE9uZSBjaGVlazogYSBzb2Z0IHBpbmsgcGF0Y2ggdW5kZXIgYW4gZXllIG9mIHNpemUgYHJgLCB3aGljaCBldmVyeSBhbmltYWwgd2l0aFxuICogZGFyayBleWVzIHdlYXJzLCBzbyBlYWNoIGZhY2UgbG9va3Mgd2FybSB3aGF0ZXZlciBpdHMgY29sb3Vycy5cbiAqL1xuZnVuY3Rpb24gY2hlZWsoeDogbnVtYmVyLCB5OiBudW1iZXIsIHI6IG51bWJlcikge1xuICByZXR1cm4gZHJhd0VsbGlwc2Uoe1xuICAgIGN4OiB0ZW50aCh4KSxcbiAgICBjeTogdGVudGgoeSksXG4gICAgZmlsbDogQkxVU0gsXG4gICAgb3BhY2l0eTogMC40NSxcbiAgICByeDogdGVudGgociAqIDEuMTUpLFxuICAgIHJ5OiB0ZW50aChyICogMC43KSxcbiAgfSk7XG59XG5cbi8qKiBXaGF0IG9uZSBzaWRlIGRvZXMgd2hlbiB0aGUgZXllcyB3aW5rOiB0aGUgbGVmdCBleWUgc21pbGVzLCB0aGUgcmlnaHQgc3RheXMgb3Blbi4gKi9cbmV4cG9ydCBmdW5jdGlvbiBraW5kQXQoZXllczogdHlwZW9mIEV5ZXMuVHlwZSwgc2lkZTogbnVtYmVyKSB7XG4gIHJldHVybiBNYXRjaC52YWx1ZShleWVzKS5waXBlKFxuICAgIE1hdGNoLndoZW4oXCJ3aW5rXCIsICgpID0+IChzaWRlIDwgMCA/IFwic21pbGVcIiA6IFwib3BlblwiKSksXG4gICAgTWF0Y2gub3JFbHNlKChrZXB0KSA9PiBrZXB0KVxuICApO1xufVxuXG4vKiogQm90aCBleWVzLCBgZHhgIGVpdGhlciBzaWRlIG9mIHRoZSBjZW50cmUgbGluZSwgc2hpZnRlZCBieSB0aGUgd2F5IHRoZSBwb3NlIGxvb2tzLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV5ZXMoXG4gIGtpdDogdHlwZW9mIEtpdC5UeXBlLFxuICBkeDogbnVtYmVyLFxuICB5OiBudW1iZXIsXG4gIHIgPSA2LjQsXG4gIGluayA9IGtpdC5pbmtcbikge1xuICByZXR1cm4gYm90aCgoc2lkZSkgPT4ge1xuICAgIGNvbnN0IHggPSAxMDAgKyBzaWRlICogZHggKyBraXQubG9vaztcbiAgICBjb25zdCBzaG93biA9IGV5ZShraW5kQXQoa2l0LmV5ZXMsIHNpZGUpLCB4LCB5LCByLCBpbmspO1xuICAgIHJldHVybiBpbmsgPT09IElOS1xuICAgICAgPyBbY2hlZWsoeCArIHNpZGUgKiByICogMS4xLCB5ICsgciAqIDIuMSwgciksIHNob3duXVxuICAgICAgOiBzaG93bjtcbiAgfSk7XG59XG5cbi8qKiBSb3VuZCBlYXJzIG9uIGJvdGggc2lkZXMsIGVhY2ggd2l0aCBhbiBpbm5lciBlYXIgd2hlbiBgaW5uZXJgIGlzIGdpdmVuLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJvdW5kRWFycyhcbiAgYm9keTogc3RyaW5nLFxuICBpbm5lcjogc3RyaW5nIHwgbnVsbCxcbiAgZHg6IG51bWJlcixcbiAgeTogbnVtYmVyLFxuICByOiBudW1iZXJcbikge1xuICByZXR1cm4gYm90aCgoc2lkZSkgPT5cbiAgICBmaWd1cmUoXG4gICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiBkeCwgeSwgciwgciwgYm9keSksXG4gICAgICBpbm5lciA9PT0gbnVsbFxuICAgICAgICA/IFtdXG4gICAgICAgIDogZWxsaXBzZSgxMDAgKyBzaWRlICogZHgsIHkgKyAxLCByICogMC41MiwgciAqIDAuNTIsIGlubmVyKVxuICAgIClcbiAgKTtcbn1cblxuLyoqIFBvaW50ZWQgZWFycyBvbiBib3RoIHNpZGVzLCBlYWNoIHdpdGggYW4gaW5uZXIgZWFyLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBvaW50RWFycyhib2R5OiBzdHJpbmcsIGlubmVyOiBzdHJpbmcpIHtcbiAgcmV0dXJuIGJvdGgoKHNpZGUpID0+IFtcbiAgICBibG9iKFxuICAgICAgWzEwMCArIHNpZGUgKiA1NCwgODIsIDEwMCArIHNpZGUgKiA1MiwgMzYsIDEwMCArIHNpZGUgKiAyMCwgNThdLFxuICAgICAgYm9keSxcbiAgICAgIDEyXG4gICAgKSxcbiAgICBibG9iKFxuICAgICAgWzEwMCArIHNpZGUgKiA0OCwgNzAsIDEwMCArIHNpZGUgKiA0NywgNTAsIDEwMCArIHNpZGUgKiAzNCwgNjBdLFxuICAgICAgaW5uZXIsXG4gICAgICA1XG4gICAgKSxcbiAgXSk7XG59XG5cbi8qKiBBIHJpbmcgb2Ygc2hvcnQgc3Bpa2VzIGFyb3VuZCB0aGUgdG9wIG9mIGEgaGVhZCwgYmV0d2VlbiB0d28gYW5nbGVzIGluIGRlZ3JlZXMuICovXG5leHBvcnQgZnVuY3Rpb24gc3Bpa2VzKFxuICBjeDogbnVtYmVyLFxuICBjeTogbnVtYmVyLFxuICBpbm5lcjogbnVtYmVyLFxuICBvdXRlcjogbnVtYmVyLFxuICBmcm9tOiBudW1iZXIsXG4gIHRvOiBudW1iZXIsXG4gIGNvdW50OiBudW1iZXIsXG4gIGZpbGw6IHN0cmluZyxcbiAgd2lkdGggPSA0XG4pIHtcbiAgcmV0dXJuIEFyci5tYWtlQnkoY291bnQsIChpbmRleCkgPT4ge1xuICAgIGNvbnN0IGFuZ2xlID1cbiAgICAgICgoZnJvbSArICgodG8gLSBmcm9tKSAqIGluZGV4KSAvIChjb3VudCAtIDEpKSAqIE1hdGguUEkpIC8gMTgwO1xuICAgIGNvbnN0IHNwcmVhZCA9ICgoKHRvIC0gZnJvbSkgLyAoY291bnQgLSAxKSkgKiAwLjUgKiBNYXRoLlBJKSAvIDE4MDtcbiAgICByZXR1cm4gYmxvYihcbiAgICAgIFtcbiAgICAgICAgY3ggKyBNYXRoLmNvcyhhbmdsZSAtIHNwcmVhZCkgKiBpbm5lcixcbiAgICAgICAgY3kgKyBNYXRoLnNpbihhbmdsZSAtIHNwcmVhZCkgKiBpbm5lcixcbiAgICAgICAgY3ggKyBNYXRoLmNvcyhhbmdsZSkgKiBvdXRlcixcbiAgICAgICAgY3kgKyBNYXRoLnNpbihhbmdsZSkgKiBvdXRlcixcbiAgICAgICAgY3ggKyBNYXRoLmNvcyhhbmdsZSArIHNwcmVhZCkgKiBpbm5lcixcbiAgICAgICAgY3kgKyBNYXRoLnNpbihhbmdsZSArIHNwcmVhZCkgKiBpbm5lcixcbiAgICAgIF0sXG4gICAgICBmaWxsLFxuICAgICAgd2lkdGhcbiAgICApO1xuICB9KTtcbn1cbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9tYXNjb3QvZmFtaWx5L2JpcmQudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL21hc2NvdC9mYW1pbHlcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL21hc2NvdC9mYW1pbHkvYmlyZC50c1wiO2ltcG9ydCB7XG4gIGJlbGx5LFxuICBibG9iLFxuICBib3RoLFxuICB0eXBlIERlc2lnbixcbiAgZWxsaXBzZSxcbiAgZXllcyxcbiAgZmlndXJlLFxuICBoZWFkLFxuICBsaW5lLFxuICBQRUFSTCxcbiAgcGF0aCxcbiAgc3Bpa2VzLFxuICB0b3Jzbyxcbn0gZnJvbSBcIkByZXBvL21hc2NvdC9raXRcIjtcbmltcG9ydCB7IEFycmF5IGFzIEFyciB9IGZyb20gXCJlZmZlY3RcIjtcblxuLyoqIFRoZSBiaXJkcywgZnJvbSB0aGUgZmFybXlhcmQgdG8gdGhlIGZvcmVzdCBjYW5vcHkuICovXG5leHBvcnQgY29uc3QgYmlyZCA9IHtcbiAgY2hpY2tlbjoge1xuICAgIGNvbG9yczogW1xuICAgICAgW1wiI2Y3ZDc3NFwiLCBcIiNlZThhNGNcIl0sXG4gICAgICBbXCIjZjNlN2E2XCIsIFwiI2YyYTMzYVwiXSxcbiAgICBdLFxuICAgIGRyYXc6IChraXQpID0+XG4gICAgICBmaWd1cmUoXG4gICAgICAgIGVsbGlwc2UoOTAsIDQ0LCA4LCAxMywga2l0LmJvZHksIC0yNCksXG4gICAgICAgIGVsbGlwc2UoMTAwLCA0MCwgOCwgMTUsIGtpdC5ib2R5KSxcbiAgICAgICAgZWxsaXBzZSgxMTAsIDQ0LCA4LCAxMywga2l0LmJvZHksIDI0KSxcbiAgICAgICAgdG9yc28oa2l0LmJvZHksIDYwKSxcbiAgICAgICAgaGVhZChraXQuYm9keSwgNTgsIDU0LCAxMDApLFxuICAgICAgICBib3RoKChzaWRlKSA9PiBlbGxpcHNlKDEwMCArIHNpZGUgKiA0MCwgMTE0LCA5LCA2LCBraXQuc2Vjb25kKSksXG4gICAgICAgIGV5ZXMoa2l0LCAyNCwgOTQpLFxuICAgICAgICBibG9iKFs5MCwgMTA2LCAxMTAsIDEwNiwgMTAwLCAxMTddLCBraXQuc2Vjb25kLCA2KVxuICAgICAgKSxcbiAgfSxcbiAgb3dsOiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbXCIjYzlhMjdlXCIsIFwiI2Y0ZTZjZVwiXSxcbiAgICAgIFtcIiNjOWQyZGNcIiwgUEVBUkxdLFxuICAgICAgW1wiI2FlYjhmNVwiLCBQRUFSTF0sXG4gICAgXSxcbiAgICBkcmF3OiAoa2l0KSA9PlxuICAgICAgZmlndXJlKFxuICAgICAgICBib3RoKChzaWRlKSA9PlxuICAgICAgICAgIGJsb2IoXG4gICAgICAgICAgICBbMTAwICsgc2lkZSAqIDU2LCA3OCwgMTAwICsgc2lkZSAqIDU4LCA0MCwgMTAwICsgc2lkZSAqIDI4LCA1NF0sXG4gICAgICAgICAgICBraXQuYm9keSxcbiAgICAgICAgICAgIDEwXG4gICAgICAgICAgKVxuICAgICAgICApLFxuICAgICAgICB0b3JzbyhraXQuYm9keSksXG4gICAgICAgIGhlYWQoa2l0LmJvZHkpLFxuICAgICAgICBiZWxseShraXQuc2Vjb25kLCAzMiwgMTQ0KSxcbiAgICAgICAgYm90aCgoc2lkZSkgPT4gZWxsaXBzZSgxMDAgKyBzaWRlICogMjYsIDk0LCAyNSwgMjUsIGtpdC5zZWNvbmQpKSxcbiAgICAgICAgZXllcyhraXQsIDI2LCA5NCwgNy40KSxcbiAgICAgICAgYmxvYihbOTQsIDEwOCwgMTA2LCAxMDgsIDEwMCwgMTE4XSwga2l0LmluaywgNClcbiAgICAgICksXG4gIH0sXG4gIHBlbmd1aW46IHtcbiAgICBjb2xvcnM6IFtcbiAgICAgIFtcIiM1YjZiOGNcIiwgUEVBUkxdLFxuICAgICAgW1wiIzdjOGZjNFwiLCBQRUFSTF0sXG4gICAgXSxcbiAgICBkcmF3OiAoa2l0KSA9PlxuICAgICAgZmlndXJlKFxuICAgICAgICB0b3JzbyhraXQuYm9keSwgNjApLFxuICAgICAgICBoZWFkKGtpdC5ib2R5KSxcbiAgICAgICAgYm90aCgoc2lkZSkgPT4gZWxsaXBzZSgxMDAgKyBzaWRlICogMjAsIDEwMiwgMjgsIDMwLCBraXQuc2Vjb25kKSksXG4gICAgICAgIHBhdGgoXG4gICAgICAgICAgXCJNNjIsMjAwIEM2MCwxNzAgNzAsMTI4IDEwMCwxMjAgQzEzMCwxMjggMTQwLDE3MCAxMzgsMjAwIFpcIixcbiAgICAgICAgICBraXQuc2Vjb25kXG4gICAgICAgICksXG4gICAgICAgIGV5ZXMoa2l0LCAyMiwgOTgpLFxuICAgICAgICBibG9iKFs5MiwgMTEwLCAxMDgsIDExMCwgMTAwLCAxMjBdLCBcIiNlZThhNGNcIiwgNSlcbiAgICAgICksXG4gIH0sXG4gIGR1Y2s6IHtcbiAgICBjb2xvcnM6IFtcbiAgICAgIFtQRUFSTCwgXCIjZjJhMzNhXCJdLFxuICAgICAgW1wiI2Y3ZDc3NFwiLCBcIiNlZThhNGNcIl0sXG4gICAgICBbXCIjOWZkNmI4XCIsIFwiI2YyYTMzYVwiXSxcbiAgICBdLFxuICAgIGRyYXc6IChraXQpID0+XG4gICAgICBmaWd1cmUoXG4gICAgICAgIGxpbmUoXCJNMTAwLDQ2IFE5NiwyOCAxMTAsMjZcIiwga2l0LmJvZHksIDgpLFxuICAgICAgICB0b3JzbyhraXQuYm9keSwgNTgpLFxuICAgICAgICBoZWFkKGtpdC5ib2R5LCA1NiwgNTIsIDk4KSxcbiAgICAgICAgZWxsaXBzZSgxMDAsIDExNCwgMjcsIDEzLCBraXQuc2Vjb25kKSxcbiAgICAgICAgbGluZShcIk04MCwxMTQgUTEwMCwxMjEgMTIwLDExNFwiLCBraXQuaW5rLCAzLjQpLFxuICAgICAgICBleWVzKGtpdCwgMjQsIDkwKVxuICAgICAgKSxcbiAgfSxcbiAgY29ja2F0b286IHtcbiAgICBjb2xvcnM6IFtcbiAgICAgIFtQRUFSTCwgXCIjZjdkNzc0XCJdLFxuICAgICAgW1wiI2Y0YzdjZlwiLCBcIiNlYzlhYjBcIl0sXG4gICAgXSxcbiAgICBkcmF3OiAoa2l0KSA9PlxuICAgICAgZmlndXJlKFxuICAgICAgICBlbGxpcHNlKDc4LCA0NCwgOCwgMjYsIGtpdC5zZWNvbmQsIC0zMCksXG4gICAgICAgIGVsbGlwc2UoOTIsIDM0LCA4LCAyOCwga2l0LnNlY29uZCwgLTEwKSxcbiAgICAgICAgZWxsaXBzZSgxMDgsIDM0LCA4LCAyOCwga2l0LnNlY29uZCwgMTApLFxuICAgICAgICBlbGxpcHNlKDEyMiwgNDQsIDgsIDI2LCBraXQuc2Vjb25kLCAzMCksXG4gICAgICAgIHRvcnNvKGtpdC5ib2R5LCA1OCksXG4gICAgICAgIGhlYWQoa2l0LmJvZHksIDU2LCA1MiwgMTAwKSxcbiAgICAgICAgYm90aCgoc2lkZSkgPT4gZWxsaXBzZSgxMDAgKyBzaWRlICogNDAsIDExMiwgOSwgNywga2l0LnNlY29uZCkpLFxuICAgICAgICBleWVzKGtpdCwgMjUsIDk0KSxcbiAgICAgICAgcGF0aChcbiAgICAgICAgICBcIk04NiwxMDQgQzkwLDk4IDExMCw5OCAxMTQsMTA0IEMxMTMsMTE4IDEwNiwxMjggMTAwLDEzMCBDOTQsMTI4IDg3LDExOCA4NiwxMDQgWlwiLFxuICAgICAgICAgIFwiIzViNmI4Y1wiXG4gICAgICAgIClcbiAgICAgICksXG4gIH0sXG4gIGhvcm5iaWxsOiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbXCIjNWI2YjhjXCIsIFBFQVJMXSxcbiAgICAgIFtcIiM2ZDRiNzhcIiwgXCIjZjRlNmNlXCJdLFxuICAgIF0sXG4gICAgZHJhdzogKGtpdCkgPT5cbiAgICAgIGZpZ3VyZShcbiAgICAgICAgdG9yc28oa2l0LmJvZHksIDU4KSxcbiAgICAgICAgaGVhZChraXQuYm9keSwgNTYsIDUyLCA5NiksXG4gICAgICAgIGVsbGlwc2UoMTAwLCA5OCwgNDIsIDM2LCBraXQuc2Vjb25kKSxcbiAgICAgICAgYmVsbHkoa2l0LnNlY29uZCwgMzAsIDE1MiksXG4gICAgICAgIGV5ZXMoa2l0LCAyOCwgOTApLFxuICAgICAgICBwYXRoKFxuICAgICAgICAgIFwiTTgwLDEwNCBDODQsOTYgMTE2LDk2IDEyMCwxMDQgQzExOSwxMzAgMTA4LDE1MiAxMDAsMTU2IEM5MiwxNTIgODEsMTMwIDgwLDEwNCBaXCIsXG4gICAgICAgICAgXCIjZjJhMzNhXCJcbiAgICAgICAgKSxcbiAgICAgICAgcGF0aChcIk04Niw5OCBDODgsODAgMTEyLDgwIDExNCw5OCBaXCIsIFwiI2VlOGE0Y1wiKVxuICAgICAgKSxcbiAgfSxcbiAgZWFnbGU6IHtcbiAgICBjb2xvcnM6IFtcbiAgICAgIFtcIiM4ZjZhNGZcIiwgUEVBUkxdLFxuICAgICAgW1wiI2E4Nzk0ZlwiLCBcIiNmNGU2Y2VcIl0sXG4gICAgXSxcbiAgICBkcmF3OiAoa2l0KSA9PlxuICAgICAgZmlndXJlKFxuICAgICAgICB0b3JzbyhraXQuYm9keSwgNjIpLFxuICAgICAgICBzcGlrZXMoMTAwLCAxMTAsIDQ0LCA2MiwgMjAsIDE2MCwgNywga2l0LnNlY29uZCwgNiksXG4gICAgICAgIGhlYWQoa2l0LnNlY29uZCwgNTQsIDUwLCA5OCksXG4gICAgICAgIGJvdGgoKHNpZGUpID0+XG4gICAgICAgICAgbGluZShgTSR7MTAwICsgc2lkZSAqIDM4fSw3NiBMJHsxMDAgKyBzaWRlICogMTV9LDg0YCwga2l0LmluaywgNC42KVxuICAgICAgICApLFxuICAgICAgICBleWVzKGtpdCwgMjUsIDk2KSxcbiAgICAgICAgYmxvYihbOTAsIDEwNiwgMTEwLCAxMDYsIDEwMCwgMTI2XSwgXCIjZjdkNzc0XCIsIDcpXG4gICAgICApLFxuICB9LFxuICBwYXJyb3Q6IHtcbiAgICBjb2xvcnM6IFtcbiAgICAgIFtcIiNlZTZhNWFcIiwgXCIjZjdkNzc0XCJdLFxuICAgICAgW1wiIzdmYzdhMFwiLCBcIiNmN2Q3NzRcIl0sXG4gICAgICBbXCIjNmZiMWU4XCIsIFwiI2Y3ZDc3NFwiXSxcbiAgICBdLFxuICAgIGRyYXc6IChraXQpID0+XG4gICAgICBmaWd1cmUoXG4gICAgICAgIGVsbGlwc2UoMTAwLCA0MiwgOSwgMTQsIGtpdC5ib2R5KSxcbiAgICAgICAgZWxsaXBzZSg4OCwgNDYsIDcsIDExLCBraXQuYm9keSwgLTI0KSxcbiAgICAgICAgZWxsaXBzZSgxMTIsIDQ2LCA3LCAxMSwga2l0LmJvZHksIDI0KSxcbiAgICAgICAgdG9yc28oa2l0LmJvZHksIDU4KSxcbiAgICAgICAgaGVhZChraXQuYm9keSwgNTYsIDUyLCA5OCksXG4gICAgICAgIGJlbGx5KGtpdC5zZWNvbmQsIDMwLCAxNTIpLFxuICAgICAgICBib3RoKChzaWRlKSA9PiBlbGxpcHNlKDEwMCArIHNpZGUgKiAyNywgOTIsIDIwLCAyMCwgUEVBUkwpKSxcbiAgICAgICAgZXllcyhraXQsIDI3LCA5MiksXG4gICAgICAgIHBhdGgoXG4gICAgICAgICAgXCJNODYsMTAyIEM5MCw5NCAxMTAsOTQgMTE0LDEwMiBDMTEzLDEyMCAxMDYsMTMyIDEwMCwxMzQgQzk0LDEzMiA4NywxMjAgODYsMTAyIFpcIixcbiAgICAgICAgICBraXQuc2Vjb25kXG4gICAgICAgIClcbiAgICAgICksXG4gIH0sXG4gIGZsYW1pbmdvOiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbXCIjZjQ4ZmIxXCIsIFBFQVJMXSxcbiAgICAgIFtcIiNmN2E4YTBcIiwgUEVBUkxdLFxuICAgIF0sXG4gICAgZHJhdzogKGtpdCkgPT5cbiAgICAgIGZpZ3VyZShcbiAgICAgICAgYm90aCgoc2lkZSkgPT5cbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiA0MCwgMTg0LCAyOCwgMzgsIGtpdC5ib2R5LCBzaWRlICogLTE0KVxuICAgICAgICApLFxuICAgICAgICB0b3JzbyhraXQuYm9keSwgNDApLFxuICAgICAgICBlbGxpcHNlKDEwMCwgMTUwLCAyMSwgNTgsIGtpdC5ib2R5KSxcbiAgICAgICAgaGVhZChraXQuYm9keSwgNDQsIDQyLCA4NCksXG4gICAgICAgIGV5ZXMoa2l0LCAyMywgNzgsIDUuNCksXG4gICAgICAgIHBhdGgoXG4gICAgICAgICAgXCJNODUsOTIgQzkwLDg0IDExMCw4NCAxMTUsOTIgQzExNSwxMTIgMTA4LDEzMCAxMDAsMTM0IEM5MiwxMzAgODUsMTEyIDg1LDkyIFpcIixcbiAgICAgICAgICBraXQuc2Vjb25kXG4gICAgICAgICksXG4gICAgICAgIHBhdGgoXG4gICAgICAgICAgXCJNODksMTE0IEM5NiwxMTkgMTA0LDExOSAxMTEsMTE0IEMxMDksMTI1IDEwNCwxMzEgMTAwLDEzNCBDOTYsMTMxIDkxLDEyNSA4OSwxMTQgWlwiLFxuICAgICAgICAgIGtpdC5pbmtcbiAgICAgICAgKVxuICAgICAgKSxcbiAgfSxcbiAgcGVhY29jazoge1xuICAgIGNvbG9yczogW1xuICAgICAgW1wiIzNmN2ZjNFwiLCBcIiM3ZmM3YTBcIl0sXG4gICAgICBbXCIjMmY5YThmXCIsIFwiI2Y3ZDc3NFwiXSxcbiAgICBdLFxuICAgIGRyYXc6IChraXQpID0+XG4gICAgICBmaWd1cmUoXG4gICAgICAgIEFyci5mbGF0TWFwKEFyci5yYW5nZSgwLCA2KSwgKGluZGV4KSA9PiB7XG4gICAgICAgICAgY29uc3QgZGVncmVlcyA9IC0xNjQgKyAoaW5kZXggKiAxNDgpIC8gNjtcbiAgICAgICAgICBjb25zdCBhbmdsZSA9IChkZWdyZWVzICogTWF0aC5QSSkgLyAxODA7XG4gICAgICAgICAgY29uc3QgeCA9IDEwMCArIDg0ICogTWF0aC5jb3MoYW5nbGUpO1xuICAgICAgICAgIGNvbnN0IHkgPSAxNTIgKyA4NCAqIE1hdGguc2luKGFuZ2xlKTtcbiAgICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgZWxsaXBzZSh4LCB5LCAyMCwgMzIsIGtpdC5zZWNvbmQsIGRlZ3JlZXMgKyA5MCksXG4gICAgICAgICAgICBlbGxpcHNlKHgsIHksIDEwLCAxMiwga2l0LmJvZHkpLFxuICAgICAgICAgICAgZWxsaXBzZSh4LCB5LCA0LjQsIDUuNCwgXCIjZjdkNzc0XCIpLFxuICAgICAgICAgIF07XG4gICAgICAgIH0pLFxuICAgICAgICBBcnIuZmxhdE1hcChbLTEsIDAsIDFdLCAob2Zmc2V0KSA9PiBbXG4gICAgICAgICAgbGluZShcbiAgICAgICAgICAgIGBNJHsxMDAgKyBvZmZzZXQgKiA5fSw2NCBMJHsxMDAgKyBvZmZzZXQgKiAxNX0sNDRgLFxuICAgICAgICAgICAga2l0LmJvZHksXG4gICAgICAgICAgICAzLjRcbiAgICAgICAgICApLFxuICAgICAgICAgIGVsbGlwc2UoMTAwICsgb2Zmc2V0ICogMTUsIDQyLCA0LjQsIDQuNCwga2l0LmJvZHkpLFxuICAgICAgICBdKSxcbiAgICAgICAgdG9yc28oa2l0LmJvZHksIDQwKSxcbiAgICAgICAgaGVhZChraXQuYm9keSwgNDAsIDM4LCA5OCksXG4gICAgICAgIGV5ZXMoa2l0LCAxOCwgOTQsIDUuMiksXG4gICAgICAgIGJsb2IoWzk0LCAxMDYsIDEwNiwgMTA2LCAxMDAsIDExN10sIFwiI2Y3ZDc3NFwiLCA0KVxuICAgICAgKSxcbiAgfSxcbiAgY2Fzc293YXJ5OiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbXCIjMmYzYTU2XCIsIFwiIzNmOGZkMFwiXSxcbiAgICAgIFtcIiMzNDM0NGFcIiwgXCIjNGFhM2M3XCJdLFxuICAgIF0sXG4gICAgZHJhdzogKGtpdCkgPT5cbiAgICAgIGZpZ3VyZShcbiAgICAgICAgdG9yc28oa2l0LmJvZHksIDYyKSxcbiAgICAgICAgZWxsaXBzZSgxMDAsIDE1MCwgMjQsIDUyLCBraXQuc2Vjb25kKSxcbiAgICAgICAgYm90aCgoc2lkZSkgPT4gZWxsaXBzZSgxMDAgKyBzaWRlICogOCwgMTUyLCA2LjQsIDE1LCBcIiNlZTZhNWFcIikpLFxuICAgICAgICBibG9iKFs4OCwgNjAsIDEwMCwgMjAsIDExMiwgNjBdLCBcIiNjOWEyN2VcIiwgMTApLFxuICAgICAgICBoZWFkKGtpdC5zZWNvbmQsIDQyLCA0NCwgOTYpLFxuICAgICAgICBleWVzKGtpdCwgMTgsIDkwLCA1LjQpLFxuICAgICAgICBibG9iKFs5MiwgMTA0LCAxMDgsIDEwNCwgMTAwLCAxMjNdLCBcIiMzYjQyNTJcIiwgNSlcbiAgICAgICksXG4gIH0sXG59IHNhdGlzZmllcyBSZWNvcmQ8c3RyaW5nLCBEZXNpZ24+O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL21hc2NvdC9mYW1pbHkvYnVnLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9tYXNjb3QvZmFtaWx5XCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9tYXNjb3QvZmFtaWx5L2J1Zy50c1wiO2ltcG9ydCB7XG4gIGJvdGgsXG4gIHR5cGUgRGVzaWduLFxuICBlbGxpcHNlLFxuICBleWUsXG4gIGV5ZXMsXG4gIGZpZ3VyZSxcbiAgaGVhZCxcbiAga2luZEF0LFxuICBsaW5lLFxuICBvdXRsaW5lZCxcbiAgUEVBUkwsXG4gIHBhdGgsXG4gIHNtaWxlLFxuICB0b3Jzbyxcbn0gZnJvbSBcIkByZXBvL21hc2NvdC9raXRcIjtcbmltcG9ydCB7IEFycmF5IGFzIEFyciB9IGZyb20gXCJlZmZlY3RcIjtcblxuLyoqIFRoZSBpbnNlY3RzLCB0aGUgc3BpZGVyLCBhbmQgdGhlIHNuYWlsOiB0aGUgc21hbGwgb25lcyB0aGF0IGNyYXdsIGFuZCBmbHkuICovXG5leHBvcnQgY29uc3QgYnVnID0ge1xuICBiZWU6IHtcbiAgICBjb2xvcnM6IFtcbiAgICAgIFtcIiNmN2Q3NzRcIiwgXCIjY2ZlNmY3XCJdLFxuICAgICAgW1wiI2U4YjQ1NlwiLCBQRUFSTF0sXG4gICAgXSxcbiAgICBkcmF3OiAoa2l0KSA9PlxuICAgICAgZmlndXJlKFxuICAgICAgICBib3RoKChzaWRlKSA9PiBbXG4gICAgICAgICAgbGluZShcbiAgICAgICAgICAgIGBNJHsxMDAgKyBzaWRlICogMTZ9LDU2IFEkezEwMCArIHNpZGUgKiAyMH0sMzQgJHsxMDAgKyBzaWRlICogMzR9LDI4YCxcbiAgICAgICAgICAgIGtpdC5pbmssXG4gICAgICAgICAgICA0LjZcbiAgICAgICAgICApLFxuICAgICAgICAgIGVsbGlwc2UoMTAwICsgc2lkZSAqIDM2LCAyNywgNS40LCA1LjQsIGtpdC5pbmspLFxuICAgICAgICBdKSxcbiAgICAgICAgYm90aCgoc2lkZSkgPT5cbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiA2MiwgMTQ2LCAyNCwgMzYsIGtpdC5zZWNvbmQsIHNpZGUgKiAyMilcbiAgICAgICAgKSxcbiAgICAgICAgdG9yc28oa2l0LmJvZHkpLFxuICAgICAgICBwYXRoKFwiTTUzLDE1MiBMMTQ3LDE1MiBMMTUxLDE3MCBMNDksMTcwIFpcIiwga2l0LmluayksXG4gICAgICAgIHBhdGgoXCJNNDYsMTg0IEwxNTQsMTg0IEwxNTYsMjAwIEw0NCwyMDAgWlwiLCBraXQuaW5rKSxcbiAgICAgICAgaGVhZChraXQuYm9keSksXG4gICAgICAgIGV5ZXMoa2l0LCAyNCwgOTYpLFxuICAgICAgICBzbWlsZSgxMTAsIDEwLCA5LCBraXQuaW5rKVxuICAgICAgKSxcbiAgfSxcbiAgYmVldGxlOiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbXCIjZWU2YTVhXCIsIFwiI2Y0ZTZjZVwiXSxcbiAgICAgIFtcIiNmMmEzM2FcIiwgUEVBUkxdLFxuICAgIF0sXG4gICAgZHJhdzogKGtpdCkgPT5cbiAgICAgIGZpZ3VyZShcbiAgICAgICAgYm90aCgoc2lkZSkgPT4gW1xuICAgICAgICAgIGxpbmUoXG4gICAgICAgICAgICBgTSR7MTAwICsgc2lkZSAqIDE0fSw1MiBRJHsxMDAgKyBzaWRlICogMTh9LDMwICR7MTAwICsgc2lkZSAqIDM0fSwyNGAsXG4gICAgICAgICAgICBraXQuaW5rLFxuICAgICAgICAgICAgNC42XG4gICAgICAgICAgKSxcbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiAzNiwgMjMsIDUuNCwgNS40LCBraXQuaW5rKSxcbiAgICAgICAgXSksXG4gICAgICAgIHBhdGgoXG4gICAgICAgICAgXCJNMjAsMjAwIEMyMCwxNDQgNTQsMTA4IDEwMCwxMDggQzE0NiwxMDggMTgwLDE0NCAxODAsMjAwIFpcIixcbiAgICAgICAgICBraXQuYm9keVxuICAgICAgICApLFxuICAgICAgICBsaW5lKFwiTTEwMCwxMTIgTDEwMCwyMDBcIiwga2l0LmluaywgNCksXG4gICAgICAgIGJvdGgoKHNpZGUpID0+IFtcbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiA0MCwgMTUwLCAxMSwgMTEsIGtpdC5pbmspLFxuICAgICAgICAgIGVsbGlwc2UoMTAwICsgc2lkZSAqIDI2LCAxODYsIDgsIDgsIGtpdC5pbmspLFxuICAgICAgICAgIGVsbGlwc2UoMTAwICsgc2lkZSAqIDY0LCAxODQsIDcsIDcsIGtpdC5pbmspLFxuICAgICAgICBdKSxcbiAgICAgICAgZWxsaXBzZSgxMDAsIDg2LCA0NCwgNDAsIGtpdC5zZWNvbmQpLFxuICAgICAgICBleWVzKGtpdCwgMjAsIDg0KSxcbiAgICAgICAgc21pbGUoOTYsIDEwLCA4LCBraXQuaW5rKVxuICAgICAgKSxcbiAgfSxcbiAgZHJhZ29uZmx5OiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbXCIjNWZiZmE4XCIsIFwiI2NmZTZmN1wiXSxcbiAgICAgIFtcIiM2ZmIxZThcIiwgXCIjZGNkM2Y0XCJdLFxuICAgICAgW1wiI2VlNmE1YVwiLCBcIiNmNGU2Y2VcIl0sXG4gICAgXSxcbiAgICBkcmF3OiAoa2l0KSA9PlxuICAgICAgZmlndXJlKFxuICAgICAgICBib3RoKChzaWRlKSA9PiBbXG4gICAgICAgICAgZWxsaXBzZSgxMDAgKyBzaWRlICogNTQsIDEwMCwgNTAsIDE3LCBraXQuc2Vjb25kLCBzaWRlICogLTE4KSxcbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiA1MCwgMTMyLCA0MiwgMTQsIGtpdC5zZWNvbmQsIHNpZGUgKiAxNCksXG4gICAgICAgIF0pLFxuICAgICAgICBlbGxpcHNlKDEwMCwgMTcyLCAxMSwgNTIsIGtpdC5ib2R5KSxcbiAgICAgICAgbGluZShcIk05MSwxNTAgSDEwOSBNOTIsMTY2IEgxMDggTTkzLDE4MiBIMTA3XCIsIGtpdC5zZWNvbmQsIDIuOCksXG4gICAgICAgIGVsbGlwc2UoMTAwLCAxMjAsIDE4LCAyMiwga2l0LmJvZHkpLFxuICAgICAgICBlbGxpcHNlKDEwMCwgODYsIDI4LCAyNCwga2l0LmJvZHkpLFxuICAgICAgICBib3RoKChzaWRlKSA9PiBbXG4gICAgICAgICAgZWxsaXBzZSgxMDAgKyBzaWRlICogMTcsIDgwLCAxNSwgMTYsIGtpdC5zZWNvbmQpLFxuICAgICAgICAgIGV5ZShcbiAgICAgICAgICAgIGtpbmRBdChraXQuZXllcywgc2lkZSksXG4gICAgICAgICAgICAxMDAgKyBzaWRlICogMTcgKyBraXQubG9vayxcbiAgICAgICAgICAgIDgyLFxuICAgICAgICAgICAgNS4yLFxuICAgICAgICAgICAga2l0Lmlua1xuICAgICAgICAgICksXG4gICAgICAgIF0pLFxuICAgICAgICBzbWlsZSg5OCwgNiwgNC42LCBraXQuaW5rKVxuICAgICAgKSxcbiAgfSxcbiAgYnV0dGVyZmx5OiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbXCIjZjJhMzNhXCIsIFwiI2Y3ZDc3NFwiXSxcbiAgICAgIFtcIiM4ZTlhZDZcIiwgXCIjZGNkM2Y0XCJdLFxuICAgICAgW1wiI2VlNmE1YVwiLCBcIiNmNGM3Y2ZcIl0sXG4gICAgXSxcbiAgICBkcmF3OiAoa2l0KSA9PlxuICAgICAgZmlndXJlKFxuICAgICAgICBib3RoKChzaWRlKSA9PiBbXG4gICAgICAgICAgZWxsaXBzZSgxMDAgKyBzaWRlICogNTQsIDk4LCA0NCwgNTYsIGtpdC5ib2R5LCBzaWRlICogLTEyKSxcbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiA1OCwgOTQsIDIxLCAyOCwga2l0LnNlY29uZCwgc2lkZSAqIC0xMiksXG4gICAgICAgICAgZWxsaXBzZSgxMDAgKyBzaWRlICogNDYsIDE2NCwgMzIsIDM2LCBraXQuYm9keSwgc2lkZSAqIDE0KSxcbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiA1MCwgMTY0LCAxNCwgMTcsIGtpdC5zZWNvbmQsIHNpZGUgKiAxNCksXG4gICAgICAgIF0pLFxuICAgICAgICBib3RoKChzaWRlKSA9PiBbXG4gICAgICAgICAgbGluZShcbiAgICAgICAgICAgIGBNJHsxMDAgKyBzaWRlICogOX0sNzIgUSR7MTAwICsgc2lkZSAqIDIwfSw0NiAkezEwMCArIHNpZGUgKiAzMH0sNDBgLFxuICAgICAgICAgICAga2l0LmluayxcbiAgICAgICAgICAgIDMuNlxuICAgICAgICAgICksXG4gICAgICAgICAgZWxsaXBzZSgxMDAgKyBzaWRlICogMzAsIDQwLCA0LjIsIDQuMiwga2l0LmluayksXG4gICAgICAgIF0pLFxuICAgICAgICBlbGxpcHNlKDEwMCwgMTY0LCAxNywgNTYsIGtpdC5zZWNvbmQpLFxuICAgICAgICBlbGxpcHNlKDEwMCwgOTQsIDI3LCAyNSwga2l0LnNlY29uZCksXG4gICAgICAgIGV5ZXMoa2l0LCAxMCwgOTAsIDQuOCksXG4gICAgICAgIHNtaWxlKDEwMSwgNiwgNSwga2l0LmluaylcbiAgICAgICksXG4gIH0sXG4gIHNwaWRlcjoge1xuICAgIGNvbG9yczogW1xuICAgICAgW1wiIzZkNWFhOFwiLCBcIiNkY2QzZjRcIl0sXG4gICAgICBbXCIjNGI2YThmXCIsIFwiI2NmZTZmN1wiXSxcbiAgICAgIFtcIiM4YzVhNGZcIiwgXCIjZjRlNmNlXCJdLFxuICAgIF0sXG4gICAgZHJhdzogKGtpdCkgPT5cbiAgICAgIGZpZ3VyZShcbiAgICAgICAgQXJyLmZsYXRNYXAoQXJyLnJhbmdlKDAsIDMpLCAoaW5kZXgpID0+XG4gICAgICAgICAgYm90aCgoc2lkZSkgPT5cbiAgICAgICAgICAgIGxpbmUoXG4gICAgICAgICAgICAgIGBNJHsxMDAgKyBzaWRlICogNDB9LCR7MTE4ICsgaW5kZXggKiAxNH0gUSR7MTAwICsgc2lkZSAqICg3NiArIGluZGV4ICogNCl9LCR7ODQgKyBpbmRleCAqIDE4fSAkezEwMCArIHNpZGUgKiAoOTQgLSBpbmRleCAqIDIpfSwkezEyMiArIGluZGV4ICogMjR9YCxcbiAgICAgICAgICAgICAga2l0LmJvZHksXG4gICAgICAgICAgICAgIDcuNVxuICAgICAgICAgICAgKVxuICAgICAgICAgIClcbiAgICAgICAgKSxcbiAgICAgICAgZWxsaXBzZSgxMDAsIDE2NiwgNTYsIDUyLCBraXQuYm9keSksXG4gICAgICAgIGVsbGlwc2UoMTAwLCAxNzIsIDE1LCAyMCwga2l0LnNlY29uZCksXG4gICAgICAgIGVsbGlwc2UoMTAwLCAxMDYsIDQ2LCA0Miwga2l0LmJvZHkpLFxuICAgICAgICBib3RoKChzaWRlKSA9PiBbXG4gICAgICAgICAgZWxsaXBzZSgxMDAgKyBzaWRlICogMTgsIDEwMiwgMTMuNSwgMTQuNSwga2l0LnNlY29uZCksXG4gICAgICAgICAgZWxsaXBzZSgxMDAgKyBzaWRlICogMzEsIDgwLCA0LjYsIDQuNiwga2l0LnNlY29uZCksXG4gICAgICAgIF0pLFxuICAgICAgICBleWVzKGtpdCwgMTgsIDEwMiwgNS42KSxcbiAgICAgICAgc21pbGUoMTIxLCA4LCA2LCBraXQuaW5rKVxuICAgICAgKSxcbiAgfSxcbiAgc25haWw6IHtcbiAgICBjb2xvcnM6IFtcbiAgICAgIFtcIiNmNmMzYTZcIiwgXCIjYjk4YTYzXCJdLFxuICAgICAgW1wiI2YzZTdhNlwiLCBcIiNjOTc4M2FcIl0sXG4gICAgICBbXCIjY2ZlYmQ5XCIsIFwiIzVlOGY5Y1wiXSxcbiAgICBdLFxuICAgIGRyYXc6IChraXQpID0+XG4gICAgICBmaWd1cmUoXG4gICAgICAgIGVsbGlwc2UoMTMyLCAxMjYsIDU4LCA1OCwga2l0LnNlY29uZCksXG4gICAgICAgIGxpbmUoXG4gICAgICAgICAgXCJNMTMyLDEzMCBDMTIwLDEzMCAxMTgsMTE0IDEzMiwxMTIgQzE1MiwxMTAgMTYwLDE0MCAxMzYsMTUwIEMxMDQsMTYwIDg2LDEyNCAxMDgsMTAwXCIsXG4gICAgICAgICAga2l0LmJvZHksXG4gICAgICAgICAgN1xuICAgICAgICApLFxuICAgICAgICBsaW5lKFwiTTYyLDkyIEw1Niw1OFwiLCBraXQuYm9keSwgOSksXG4gICAgICAgIGxpbmUoXCJNOTAsOTAgTDk4LDU2XCIsIGtpdC5ib2R5LCA5KSxcbiAgICAgICAgZWxsaXBzZSg1NSwgNTAsIDEyLCAxMiwga2l0LmJvZHkpLFxuICAgICAgICBlbGxpcHNlKDk5LCA0OCwgMTIsIDEyLCBraXQuYm9keSksXG4gICAgICAgIHBhdGgoXG4gICAgICAgICAgXCJNMTQsMjAwIEMxNiwxNzYgMzYsMTY0IDcwLDE2NCBMMTg2LDE2NCBDMTk0LDE3NiAxOTQsMTkwIDE5MiwyMDAgWlwiLFxuICAgICAgICAgIGtpdC5ib2R5XG4gICAgICAgICksXG4gICAgICAgIGVsbGlwc2UoNzYsIDEyMiwgMzgsIDQ0LCBraXQuYm9keSksXG4gICAgICAgIGV5ZShraW5kQXQoa2l0LmV5ZXMsIC0xKSwgNTUgKyBraXQubG9vaywgNTAsIDUuNCwga2l0LmluayksXG4gICAgICAgIGV5ZShraW5kQXQoa2l0LmV5ZXMsIDEpLCA5OSArIGtpdC5sb29rLCA0OCwgNS40LCBraXQuaW5rKSxcbiAgICAgICAgb3V0bGluZWQoXG4gICAgICAgICAgXCJNNjIsMTI0IFE3NiwxMzQgOTAsMTI0IFE3NiwxNDIgNjIsMTI0IFpcIixcbiAgICAgICAgICBraXQuaW5rLFxuICAgICAgICAgIGtpdC5pbmssXG4gICAgICAgICAgMi42XG4gICAgICAgIClcbiAgICAgICksXG4gIH0sXG59IHNhdGlzZmllcyBSZWNvcmQ8c3RyaW5nLCBEZXNpZ24+O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL21hc2NvdC9mYW1pbHkvY2Fybml2b3JlLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9tYXNjb3QvZmFtaWx5XCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9tYXNjb3QvZmFtaWx5L2Nhcm5pdm9yZS50c1wiO2ltcG9ydCB7XG4gIGJlbGx5LFxuICBibG9iLFxuICBib3RoLFxuICB0eXBlIERlc2lnbixcbiAgZWxsaXBzZSxcbiAgZXllLFxuICBleWVzLFxuICBmaWd1cmUsXG4gIGhlYWQsXG4gIG5vc2UsXG4gIFBFQVJMLFxuICBwYXRoLFxuICBwb2ludEVhcnMsXG4gIHJvdW5kRWFycyxcbiAgc21pbGUsXG4gIHRvcnNvLFxufSBmcm9tIFwiQHJlcG8vbWFzY290L2tpdFwiO1xuaW1wb3J0IHsgQXJyYXkgYXMgQXJyIH0gZnJvbSBcImVmZmVjdFwiO1xuXG4vKiogVGhlIG1lYXQgZWF0ZXJzIG9uIGxhbmQsIGFuZCB0aGUgc2VhbHMgYW5kIHdhbHJ1c2VzIHRoYXQgaHVudCBpbiB0aGUgc2VhLiAqL1xuZXhwb3J0IGNvbnN0IGNhcm5pdm9yZSA9IHtcbiAgY2F0OiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbXCIjZWU4YTRjXCIsIFwiI2Y0ZTZjZVwiXSxcbiAgICAgIFtcIiNjOWQyZGNcIiwgUEVBUkxdLFxuICAgICAgW1wiI2VmZDJhNlwiLCBQRUFSTF0sXG4gICAgXSxcbiAgICBkcmF3OiAoa2l0KSA9PlxuICAgICAgZmlndXJlKFxuICAgICAgICBwb2ludEVhcnMoa2l0LmJvZHksIGtpdC5zZWNvbmQpLFxuICAgICAgICB0b3JzbyhraXQuYm9keSksXG4gICAgICAgIGhlYWQoa2l0LmJvZHkpLFxuICAgICAgICBlbGxpcHNlKDEwMCwgMTE0LCAzNCwgMjYsIGtpdC5zZWNvbmQpLFxuICAgICAgICBiZWxseShraXQuc2Vjb25kKSxcbiAgICAgICAgZXllcyhraXQsIDI2LCA5NCksXG4gICAgICAgIGJsb2IoWzk1LCAxMDYsIDEwNSwgMTA2LCAxMDAsIDExMV0sIGtpdC5pbmssIDMpLFxuICAgICAgICBzbWlsZSgxMTYsIDksIDgsIGtpdC5pbmspXG4gICAgICApLFxuICB9LFxuICBiZWFyOiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbXCIjYzg5NDY4XCIsIFwiI2Y0ZTZjZVwiXSxcbiAgICAgIFtQRUFSTCwgXCIjYzlkMmRjXCJdLFxuICAgICAgW1wiI2U4YjQ1NlwiLCBcIiNmNGU2Y2VcIl0sXG4gICAgXSxcbiAgICBkcmF3OiAoa2l0KSA9PlxuICAgICAgZmlndXJlKFxuICAgICAgICByb3VuZEVhcnMoa2l0LmJvZHksIGtpdC5zZWNvbmQsIDQ2LCA1MiwgMTkpLFxuICAgICAgICB0b3JzbyhraXQuYm9keSksXG4gICAgICAgIGhlYWQoa2l0LmJvZHkpLFxuICAgICAgICBlbGxpcHNlKDEwMCwgMTE2LCAyNiwgMjAsIGtpdC5zZWNvbmQpLFxuICAgICAgICBiZWxseShraXQuc2Vjb25kKSxcbiAgICAgICAgZXllcyhraXQsIDI4LCA5MiksXG4gICAgICAgIG5vc2UoMTA4LCA4LCA2LCBraXQuaW5rKSxcbiAgICAgICAgc21pbGUoMTE4LCA4LCA3LCBraXQuaW5rKVxuICAgICAgKSxcbiAgfSxcbiAgZm94OiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbXCIjZWU4YTRjXCIsIFBFQVJMXSxcbiAgICAgIFtcIiNmMmEzM2FcIiwgXCIjZjRlNmNlXCJdLFxuICAgIF0sXG4gICAgZHJhdzogKGtpdCkgPT5cbiAgICAgIGZpZ3VyZShcbiAgICAgICAgcG9pbnRFYXJzKGtpdC5ib2R5LCBraXQuaW5rKSxcbiAgICAgICAgdG9yc28oa2l0LmJvZHkpLFxuICAgICAgICBoZWFkKGtpdC5ib2R5KSxcbiAgICAgICAgcGF0aChcbiAgICAgICAgICBcIk00MiwxMDQgQzYwLDk2IDg2LDEwNCAxMDAsMTI0IEMxMTQsMTA0IDE0MCw5NiAxNTgsMTA0IEMxNTYsMTM0IDEzMiwxNTAgMTAwLDE1MCBDNjgsMTUwIDQ0LDEzNCA0MiwxMDQgWlwiLFxuICAgICAgICAgIGtpdC5zZWNvbmRcbiAgICAgICAgKSxcbiAgICAgICAgYmVsbHkoa2l0LnNlY29uZCksXG4gICAgICAgIGV5ZXMoa2l0LCAyOCwgOTIpLFxuICAgICAgICBub3NlKDEyNCwgNywgNS40LCBraXQuaW5rKSxcbiAgICAgICAgc21pbGUoMTMyLCA3LCA2LCBraXQuaW5rKVxuICAgICAgKSxcbiAgfSxcbiAgcGFuZGE6IHtcbiAgICBjb2xvcnM6IFtcbiAgICAgIFtQRUFSTCwgUEVBUkxdLFxuICAgICAgW1wiI2Y0ZTZjZVwiLCBcIiNmNGU2Y2VcIl0sXG4gICAgXSxcbiAgICBkcmF3OiAoa2l0KSA9PlxuICAgICAgZmlndXJlKFxuICAgICAgICByb3VuZEVhcnMoa2l0LmluaywgbnVsbCwgNDYsIDUyLCAxOSksXG4gICAgICAgIHRvcnNvKGtpdC5ib2R5KSxcbiAgICAgICAgYm90aCgoc2lkZSkgPT5cbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiA1MCwgMTc4LCAyMCwgMzQsIGtpdC5pbmssIHNpZGUgKiAxNilcbiAgICAgICAgKSxcbiAgICAgICAgaGVhZChraXQuYm9keSksXG4gICAgICAgIGJvdGgoKHNpZGUpID0+XG4gICAgICAgICAgZWxsaXBzZSgxMDAgKyBzaWRlICogMjcsIDk4LCAxNSwgMTksIGtpdC5pbmssIHNpZGUgKiAyMilcbiAgICAgICAgKSxcbiAgICAgICAgYm90aCgoc2lkZSkgPT5cbiAgICAgICAgICBleWUoXCJvcGVuXCIsIDEwMCArIHNpZGUgKiAyNiArIGtpdC5sb29rLCA5NywgNSwga2l0LmJvZHkpXG4gICAgICAgICksXG4gICAgICAgIG5vc2UoMTE4LCA3LCA1LCBraXQuaW5rKSxcbiAgICAgICAgc21pbGUoMTI2LCA4LCA3LCBraXQuaW5rKVxuICAgICAgKSxcbiAgfSxcbiAgdGlnZXI6IHtcbiAgICBjb2xvcnM6IFtcbiAgICAgIFtcIiNmMmEzM2FcIiwgXCIjZjRlNmNlXCJdLFxuICAgICAgW1wiI2VlOGE0Y1wiLCBQRUFSTF0sXG4gICAgXSxcbiAgICBkcmF3OiAoa2l0KSA9PlxuICAgICAgZmlndXJlKFxuICAgICAgICByb3VuZEVhcnMoa2l0LmJvZHksIGtpdC5pbmssIDQ2LCA1MiwgMTgpLFxuICAgICAgICB0b3JzbyhraXQuYm9keSksXG4gICAgICAgIGhlYWQoa2l0LmJvZHkpLFxuICAgICAgICBibG9iKFsxMDAsIDUwLCA5NiwgNjYsIDEwNCwgNjZdLCBraXQuaW5rLCA0KSxcbiAgICAgICAgYm90aCgoc2lkZSkgPT4gW1xuICAgICAgICAgIGJsb2IoXG4gICAgICAgICAgICBbMTAwICsgc2lkZSAqIDIyLCA1NCwgMTAwICsgc2lkZSAqIDE4LCA2NiwgMTAwICsgc2lkZSAqIDI2LCA2Nl0sXG4gICAgICAgICAgICBraXQuaW5rLFxuICAgICAgICAgICAgMy40XG4gICAgICAgICAgKSxcbiAgICAgICAgICBibG9iKFxuICAgICAgICAgICAgWzEwMCArIHNpZGUgKiA1OCwgOTYsIDEwMCArIHNpZGUgKiA0NCwgMTAwLCAxMDAgKyBzaWRlICogNTYsIDEwNF0sXG4gICAgICAgICAgICBraXQuaW5rLFxuICAgICAgICAgICAgMy40XG4gICAgICAgICAgKSxcbiAgICAgICAgICBibG9iKFxuICAgICAgICAgICAgWzEwMCArIHNpZGUgKiA1NiwgMTE0LCAxMDAgKyBzaWRlICogNDQsIDExNiwgMTAwICsgc2lkZSAqIDUyLCAxMjJdLFxuICAgICAgICAgICAga2l0LmluayxcbiAgICAgICAgICAgIDMuNFxuICAgICAgICAgICksXG4gICAgICAgIF0pLFxuICAgICAgICBlbGxpcHNlKDEwMCwgMTE4LCAyNiwgMTksIGtpdC5zZWNvbmQpLFxuICAgICAgICBiZWxseShraXQuc2Vjb25kKSxcbiAgICAgICAgZXllcyhraXQsIDI2LCA5MiksXG4gICAgICAgIG5vc2UoMTEwLCA3LCA1LCBraXQuaW5rKSxcbiAgICAgICAgc21pbGUoMTE5LCA4LCA3LCBraXQuaW5rKVxuICAgICAgKSxcbiAgfSxcbiAgbGlvbjoge1xuICAgIGNvbG9yczogW1xuICAgICAgW1wiI2U4YjQ1NlwiLCBcIiNjOTc4M2FcIl0sXG4gICAgICBbXCIjZjdkNzc0XCIsIFwiI2VlOGE0Y1wiXSxcbiAgICBdLFxuICAgIGRyYXc6IChraXQpID0+XG4gICAgICBmaWd1cmUoXG4gICAgICAgIEFyci5tYWtlQnkoMTIsIChpbmRleCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGFuZ2xlID0gKGluZGV4IC8gMTIpICogTWF0aC5QSSAqIDI7XG4gICAgICAgICAgcmV0dXJuIGVsbGlwc2UoXG4gICAgICAgICAgICAxMDAgKyBNYXRoLmNvcyhhbmdsZSkgKiA1NCxcbiAgICAgICAgICAgIDk4ICsgTWF0aC5zaW4oYW5nbGUpICogNTAsXG4gICAgICAgICAgICAyMixcbiAgICAgICAgICAgIDIyLFxuICAgICAgICAgICAga2l0LnNlY29uZFxuICAgICAgICAgICk7XG4gICAgICAgIH0pLFxuICAgICAgICBlbGxpcHNlKDEwMCwgOTgsIDU2LCA1Miwga2l0LnNlY29uZCksXG4gICAgICAgIHRvcnNvKGtpdC5ib2R5LCA1MCksXG4gICAgICAgIHJvdW5kRWFycyhraXQuYm9keSwgbnVsbCwgMzQsIDYyLCAxMyksXG4gICAgICAgIGhlYWQoa2l0LmJvZHksIDQ0LCA0MiwgMTAwKSxcbiAgICAgICAgZXllcyhraXQsIDE5LCA5NCksXG4gICAgICAgIG5vc2UoMTA4LCA3LCA1LCBraXQuaW5rKSxcbiAgICAgICAgc21pbGUoMTE3LCA4LCA3LCBraXQuaW5rKVxuICAgICAgKSxcbiAgfSxcbiAgZG9nOiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbXCIjZWZkMmE2XCIsIFwiI2I5OGE2M1wiXSxcbiAgICAgIFtQRUFSTCwgXCIjYzg5NDY4XCJdLFxuICAgICAgW1wiI2U4YjQ1NlwiLCBcIiNhODY4M2FcIl0sXG4gICAgXSxcbiAgICBkcmF3OiAoa2l0KSA9PlxuICAgICAgZmlndXJlKFxuICAgICAgICB0b3JzbyhraXQuYm9keSksXG4gICAgICAgIGhlYWQoa2l0LmJvZHkpLFxuICAgICAgICBib3RoKChzaWRlKSA9PlxuICAgICAgICAgIGVsbGlwc2UoMTAwICsgc2lkZSAqIDU0LCA5NiwgMTcsIDM2LCBraXQuc2Vjb25kLCBzaWRlICogOClcbiAgICAgICAgKSxcbiAgICAgICAgZWxsaXBzZSgxMDAsIDExNiwgMjgsIDIxLCBQRUFSTCksXG4gICAgICAgIGJlbGx5KFBFQVJMKSxcbiAgICAgICAgZXllcyhraXQsIDI1LCA5MiksXG4gICAgICAgIG5vc2UoMTA3LCA4LjQsIDYsIGtpdC5pbmspLFxuICAgICAgICBzbWlsZSgxMTcsIDgsIDYsIGtpdC5pbmspLFxuICAgICAgICBlbGxpcHNlKDEwMCwgMTI4LCA1LjYsIDcsIFwiI2VjOWFiMFwiKVxuICAgICAgKSxcbiAgfSxcbiAgY2l2ZXQ6IHtcbiAgICBjb2xvcnM6IFtcbiAgICAgIFtcIiNiOWMwY2NcIiwgUEVBUkxdLFxuICAgICAgW1wiI2M5YTI3ZVwiLCBcIiNmNGU2Y2VcIl0sXG4gICAgXSxcbiAgICBkcmF3OiAoa2l0KSA9PlxuICAgICAgZmlndXJlKFxuICAgICAgICByb3VuZEVhcnMoa2l0LmJvZHksIGtpdC5pbmssIDQ2LCA1NCwgMTYpLFxuICAgICAgICB0b3JzbyhraXQuYm9keSksXG4gICAgICAgIGhlYWQoa2l0LmJvZHkpLFxuICAgICAgICBlbGxpcHNlKDEwMCwgNjYsIDYsIDE2LCBraXQuc2Vjb25kKSxcbiAgICAgICAgYm90aCgoc2lkZSkgPT5cbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiAyOCwgOTYsIDIzLCAxNSwga2l0Lmluaywgc2lkZSAqIDE4KVxuICAgICAgICApLFxuICAgICAgICBib3RoKChzaWRlKSA9PlxuICAgICAgICAgIGV5ZShcIm9wZW5cIiwgMTAwICsgc2lkZSAqIDI2ICsga2l0Lmxvb2ssIDk2LCA1LCBraXQuc2Vjb25kKVxuICAgICAgICApLFxuICAgICAgICBlbGxpcHNlKDEwMCwgMTIwLCAyMiwgMTcsIGtpdC5zZWNvbmQpLFxuICAgICAgICBiZWxseShraXQuc2Vjb25kKSxcbiAgICAgICAgbm9zZSgxMTQsIDYuNCwgNC44LCBraXQuaW5rKSxcbiAgICAgICAgc21pbGUoMTIzLCA3LCA2LCBraXQuaW5rKVxuICAgICAgKSxcbiAgfSxcbiAgcmFjY29vbjoge1xuICAgIGNvbG9yczogW1xuICAgICAgW1wiIzlhYTNiMFwiLCBQRUFSTF0sXG4gICAgICBbXCIjYjhhNThjXCIsIFwiI2Y0ZTZjZVwiXSxcbiAgICBdLFxuICAgIGRyYXc6IChraXQpID0+XG4gICAgICBmaWd1cmUoXG4gICAgICAgIHJvdW5kRWFycyhraXQuYm9keSwga2l0LmluaywgNDYsIDU0LCAxNyksXG4gICAgICAgIHRvcnNvKGtpdC5ib2R5KSxcbiAgICAgICAgaGVhZChraXQuYm9keSksXG4gICAgICAgIGVsbGlwc2UoMTAwLCAxMTgsIDI3LCAyMSwga2l0LnNlY29uZCksXG4gICAgICAgIGVsbGlwc2UoMTAwLCA3MCwgOCwgMTYsIGtpdC5zZWNvbmQpLFxuICAgICAgICBib3RoKChzaWRlKSA9PlxuICAgICAgICAgIGVsbGlwc2UoMTAwICsgc2lkZSAqIDI3LCA5NiwgMjMsIDE1LCBraXQuaW5rLCBzaWRlICogMTgpXG4gICAgICAgICksXG4gICAgICAgIGJlbGx5KGtpdC5zZWNvbmQpLFxuICAgICAgICBleWVzKGtpdCwgMjYsIDk2LCA1LCBQRUFSTCksXG4gICAgICAgIG5vc2UoMTEwLCA2LCA0LjYsIGtpdC5pbmspLFxuICAgICAgICBzbWlsZSgxMjAsIDgsIDYsIGtpdC5pbmspXG4gICAgICApLFxuICB9LFxuICBzZWFsOiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbXCIjYzlkMmRjXCIsIFBFQVJMXSxcbiAgICAgIFtcIiNjZmU2ZjdcIiwgUEVBUkxdLFxuICAgIF0sXG4gICAgZHJhdzogKGtpdCkgPT5cbiAgICAgIGZpZ3VyZShcbiAgICAgICAgdG9yc28oa2l0LmJvZHksIDYyKSxcbiAgICAgICAgaGVhZChraXQuYm9keSwgNTgsIDU0LCA5NiksXG4gICAgICAgIGJvdGgoKHNpZGUpID0+IGVsbGlwc2UoMTAwICsgc2lkZSAqIDEzLCAxMTYsIDE3LCAxNSwga2l0LnNlY29uZCkpLFxuICAgICAgICBiZWxseShraXQuc2Vjb25kLCAzNCwgMTUwKSxcbiAgICAgICAgYm90aCgoc2lkZSkgPT4gW1xuICAgICAgICAgIGVsbGlwc2UoMTAwICsgc2lkZSAqIDEwLCAxMTQsIDEuNywgMS43LCBraXQuaW5rKSxcbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiAxNywgMTE4LCAxLjcsIDEuNywga2l0LmluayksXG4gICAgICAgICAgZWxsaXBzZSgxMDAgKyBzaWRlICogMjAsIDExMSwgMS43LCAxLjcsIGtpdC5pbmspLFxuICAgICAgICBdKSxcbiAgICAgICAgZXllcyhraXQsIDI4LCA5MCksXG4gICAgICAgIG5vc2UoMTA1LCA3LCA1LCBraXQuaW5rKVxuICAgICAgKSxcbiAgfSxcbiAgd2FscnVzOiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbXCIjYjA4OTY4XCIsIFwiI2Y0ZTZjZVwiXSxcbiAgICAgIFtcIiNhODg3NmZcIiwgUEVBUkxdLFxuICAgIF0sXG4gICAgZHJhdzogKGtpdCkgPT5cbiAgICAgIGZpZ3VyZShcbiAgICAgICAgYm90aCgoc2lkZSkgPT5cbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiA1OCwgMTc4LCAxOCwgMzIsIGtpdC5ib2R5LCBzaWRlICogLTE2KVxuICAgICAgICApLFxuICAgICAgICB0b3JzbyhraXQuYm9keSwgNjIpLFxuICAgICAgICBoZWFkKGtpdC5ib2R5LCA1OCwgNTIsIDk2KSxcbiAgICAgICAgYm90aCgoc2lkZSkgPT5cbiAgICAgICAgICBibG9iKFxuICAgICAgICAgICAgWzEwMCArIHNpZGUgKiAxMSwgMTMyLCAxMDAgKyBzaWRlICogMjEsIDEzMiwgMTAwICsgc2lkZSAqIDE1LCAxNzBdLFxuICAgICAgICAgICAgUEVBUkwsXG4gICAgICAgICAgICA3XG4gICAgICAgICAgKVxuICAgICAgICApLFxuICAgICAgICBib3RoKChzaWRlKSA9PiBbXG4gICAgICAgICAgZWxsaXBzZSgxMDAgKyBzaWRlICogMjAsIDExOCwgMjUsIDIxLCBraXQuc2Vjb25kKSxcbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiAxMywgMTE0LCAyLjEsIDIuMSwga2l0LmluayksXG4gICAgICAgICAgZWxsaXBzZSgxMDAgKyBzaWRlICogMjUsIDExMSwgMi4xLCAyLjEsIGtpdC5pbmspLFxuICAgICAgICAgIGVsbGlwc2UoMTAwICsgc2lkZSAqIDIxLCAxMjIsIDIuMSwgMi4xLCBraXQuaW5rKSxcbiAgICAgICAgXSksXG4gICAgICAgIGV5ZXMoa2l0LCAyNywgODYsIDUuNiksXG4gICAgICAgIG5vc2UoMTA0LCA4LjQsIDUuNiwga2l0LmluaylcbiAgICAgICksXG4gIH0sXG59IHNhdGlzZmllcyBSZWNvcmQ8c3RyaW5nLCBEZXNpZ24+O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL21hc2NvdC9mYW1pbHkvZmFybS50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvbWFzY290L2ZhbWlseVwiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvbWFzY290L2ZhbWlseS9mYXJtLnRzXCI7aW1wb3J0IHtcbiAgYmVsbHksXG4gIGJsb2IsXG4gIGJvdGgsXG4gIHR5cGUgRGVzaWduLFxuICBlbGxpcHNlLFxuICBleWVzLFxuICBmaWd1cmUsXG4gIGhlYWQsXG4gIGxpbmUsXG4gIG5vc2UsXG4gIFBFQVJMLFxuICBwYXRoLFxuICBzbWlsZSxcbiAgdG9yc28sXG59IGZyb20gXCJAcmVwby9tYXNjb3Qva2l0XCI7XG5pbXBvcnQgeyBBcnJheSBhcyBBcnIgfSBmcm9tIFwiZWZmZWN0XCI7XG5cbi8qKiBUaGUgYW5pbWFscyBvZiB0aGUgZmFybTogdGhlIG9uZXMgdGhhdCBncmF6ZSBpbiBhIHBhZGRvY2sgb3IgY2FycnkgYSBsb2FkLiAqL1xuZXhwb3J0IGNvbnN0IGZhcm0gPSB7XG4gIHNoZWVwOiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbUEVBUkwsIFwiI2VmZDJhNlwiXSxcbiAgICAgIFtcIiNmNGU2Y2VcIiwgXCIjYzlhMjdlXCJdLFxuICAgIF0sXG4gICAgZHJhdzogKGtpdCkgPT5cbiAgICAgIGZpZ3VyZShcbiAgICAgICAgdG9yc28oa2l0LmJvZHksIDYwKSxcbiAgICAgICAgYm90aCgoc2lkZSkgPT4gW1xuICAgICAgICAgIGVsbGlwc2UoMTAwICsgc2lkZSAqIDQ2LCAxNTAsIDIyLCAyMiwga2l0LmJvZHkpLFxuICAgICAgICAgIGVsbGlwc2UoMTAwICsgc2lkZSAqIDI4LCAxNzYsIDI0LCAyNCwga2l0LmJvZHkpLFxuICAgICAgICBdKSxcbiAgICAgICAgQXJyLm1hcChcbiAgICAgICAgICBbXG4gICAgICAgICAgICBbNTIsIDk2XSxcbiAgICAgICAgICAgIFs2MCwgNjhdLFxuICAgICAgICAgICAgWzgyLCA1MF0sXG4gICAgICAgICAgICBbMTE4LCA1MF0sXG4gICAgICAgICAgICBbMTQwLCA2OF0sXG4gICAgICAgICAgICBbMTQ4LCA5Nl0sXG4gICAgICAgICAgICBbMTAwLCA0NF0sXG4gICAgICAgICAgXSxcbiAgICAgICAgICAoW3gsIHldKSA9PiBlbGxpcHNlKHgsIHksIDI0LCAyNCwga2l0LmJvZHkpXG4gICAgICAgICksXG4gICAgICAgIGhlYWQoa2l0LmJvZHksIDUwLCA0NCwgMTAwKSxcbiAgICAgICAgYm90aCgoc2lkZSkgPT5cbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiA1MCwgMTAyLCAxNywgOSwga2l0LnNlY29uZCwgc2lkZSAqIC0yNClcbiAgICAgICAgKSxcbiAgICAgICAgZWxsaXBzZSgxMDAsIDEwOCwgMzYsIDM4LCBraXQuc2Vjb25kKSxcbiAgICAgICAgZXllcyhraXQsIDE2LCAxMDIpLFxuICAgICAgICBub3NlKDEyMCwgNSwgMy42LCBraXQuaW5rKSxcbiAgICAgICAgc21pbGUoMTI2LCA3LCA2LCBraXQuaW5rKVxuICAgICAgKSxcbiAgfSxcbiAgY293OiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbUEVBUkwsIFwiI2Y0YzdjZlwiXSxcbiAgICAgIFtcIiNmNGU2Y2VcIiwgXCIjZjZjM2E2XCJdLFxuICAgIF0sXG4gICAgZHJhdzogKGtpdCkgPT5cbiAgICAgIGZpZ3VyZShcbiAgICAgICAgYm90aCgoc2lkZSkgPT5cbiAgICAgICAgICBibG9iKFxuICAgICAgICAgICAgWzEwMCArIHNpZGUgKiAzMCwgNTYsIDEwMCArIHNpZGUgKiA0NCwgMzQsIDEwMCArIHNpZGUgKiA0NiwgNThdLFxuICAgICAgICAgICAgXCIjZWZkMmE2XCIsXG4gICAgICAgICAgICA4XG4gICAgICAgICAgKVxuICAgICAgICApLFxuICAgICAgICBib3RoKChzaWRlKSA9PlxuICAgICAgICAgIGVsbGlwc2UoMTAwICsgc2lkZSAqIDY0LCA4NCwgMTgsIDEwLCBraXQuYm9keSwgc2lkZSAqIC0yMilcbiAgICAgICAgKSxcbiAgICAgICAgdG9yc28oa2l0LmJvZHkpLFxuICAgICAgICBoZWFkKGtpdC5ib2R5KSxcbiAgICAgICAgcGF0aChcbiAgICAgICAgICBcIk0xMTgsNTAgQzE0MCw1MiAxNTgsNzAgMTYwLDkyIEMxNDYsOTYgMTI4LDkwIDEyMiw3NCBDMTE4LDY2IDExNiw1NiAxMTgsNTAgWlwiLFxuICAgICAgICAgIGtpdC5pbmtcbiAgICAgICAgKSxcbiAgICAgICAgZWxsaXBzZSgxMDAsIDEyNCwgMzYsIDIyLCBraXQuc2Vjb25kKSxcbiAgICAgICAgYmVsbHkoa2l0LnNlY29uZCksXG4gICAgICAgIGV5ZXMoa2l0LCAyOCwgOTIpLFxuICAgICAgICBib3RoKChzaWRlKSA9PiBlbGxpcHNlKDEwMCArIHNpZGUgKiAxMiwgMTI0LCAzLjYsIDQuNiwga2l0LmluaykpXG4gICAgICApLFxuICB9LFxuICBwaWc6IHtcbiAgICBjb2xvcnM6IFtcbiAgICAgIFtcIiNmNGM3Y2ZcIiwgXCIjZWM5YWIwXCJdLFxuICAgICAgW1wiI2Y2YzNhNlwiLCBcIiNmNWE0OGVcIl0sXG4gICAgXSxcbiAgICBkcmF3OiAoa2l0KSA9PlxuICAgICAgZmlndXJlKFxuICAgICAgICBib3RoKChzaWRlKSA9PiBbXG4gICAgICAgICAgYmxvYihcbiAgICAgICAgICAgIFsxMDAgKyBzaWRlICogNTAsIDcyLCAxMDAgKyBzaWRlICogNTgsIDQwLCAxMDAgKyBzaWRlICogMjYsIDU0XSxcbiAgICAgICAgICAgIGtpdC5ib2R5LFxuICAgICAgICAgICAgMTRcbiAgICAgICAgICApLFxuICAgICAgICAgIGJsb2IoXG4gICAgICAgICAgICBbMTAwICsgc2lkZSAqIDQ2LCA2MiwgMTAwICsgc2lkZSAqIDUwLCA0OCwgMTAwICsgc2lkZSAqIDM2LCA1Nl0sXG4gICAgICAgICAgICBraXQuc2Vjb25kLFxuICAgICAgICAgICAgNVxuICAgICAgICAgICksXG4gICAgICAgIF0pLFxuICAgICAgICB0b3JzbyhraXQuYm9keSksXG4gICAgICAgIGhlYWQoa2l0LmJvZHkpLFxuICAgICAgICBlbGxpcHNlKDEwMCwgMTE2LCAyNSwgMTgsIGtpdC5zZWNvbmQpLFxuICAgICAgICBib3RoKChzaWRlKSA9PiBlbGxpcHNlKDEwMCArIHNpZGUgKiA5LCAxMTYsIDMuNiwgNS40LCBraXQuaW5rKSksXG4gICAgICAgIGV5ZXMoa2l0LCAyOCwgOTApLFxuICAgICAgICBzbWlsZSgxMzgsIDcsIDUsIGtpdC5pbmspXG4gICAgICApLFxuICB9LFxuICBob3JzZToge1xuICAgIGNvbG9yczogW1xuICAgICAgW1wiI2M4OTQ2OFwiLCBcIiNmNGU2Y2VcIl0sXG4gICAgICBbXCIjOGY2YTRmXCIsIFwiI2VmZDJhNlwiXSxcbiAgICAgIFtcIiNiOWMwY2NcIiwgUEVBUkxdLFxuICAgIF0sXG4gICAgZHJhdzogKGtpdCkgPT5cbiAgICAgIGZpZ3VyZShcbiAgICAgICAgYm90aCgoc2lkZSkgPT5cbiAgICAgICAgICBibG9iKFxuICAgICAgICAgICAgWzEwMCArIHNpZGUgKiA0MiwgNjIsIDEwMCArIHNpZGUgKiA0NiwgMzAsIDEwMCArIHNpZGUgKiAyNiwgNTBdLFxuICAgICAgICAgICAga2l0LmJvZHksXG4gICAgICAgICAgICAxMVxuICAgICAgICAgIClcbiAgICAgICAgKSxcbiAgICAgICAgdG9yc28oa2l0LmJvZHkpLFxuICAgICAgICBoZWFkKGtpdC5ib2R5LCA0OCwgNTYsIDEwMCksXG4gICAgICAgIGVsbGlwc2UoMTAwLCA0NiwgMjAsIDE2LCBraXQuc2Vjb25kKSxcbiAgICAgICAgZWxsaXBzZSg4NiwgNjAsIDEyLCAxNiwga2l0LnNlY29uZCwgMjQpLFxuICAgICAgICBlbGxpcHNlKDExNCwgNjAsIDEyLCAxNiwga2l0LnNlY29uZCwgLTI0KSxcbiAgICAgICAgZWxsaXBzZSgxMDAsIDEzMiwgMzEsIDIyLCBraXQuc2Vjb25kKSxcbiAgICAgICAgYm90aCgoc2lkZSkgPT4gZWxsaXBzZSgxMDAgKyBzaWRlICogMTAsIDEzMiwgMi44LCAzLjgsIGtpdC5pbmspKSxcbiAgICAgICAgZXllcyhraXQsIDI3LCA5NiksXG4gICAgICAgIGxpbmUoXCJNODgsMTQyIFExMDAsMTQ4IDExMiwxNDJcIiwga2l0LmluaywgMy42KVxuICAgICAgKSxcbiAgfSxcbiAgZ29hdDoge1xuICAgIGNvbG9yczogW1xuICAgICAgW1BFQVJMLCBcIiNjOWEyN2VcIl0sXG4gICAgICBbXCIjYzlkMmRjXCIsIFwiIzhmNmE0ZlwiXSxcbiAgICAgIFtcIiNlZmQyYTZcIiwgXCIjYjk4YTYzXCJdLFxuICAgIF0sXG4gICAgZHJhdzogKGtpdCkgPT5cbiAgICAgIGZpZ3VyZShcbiAgICAgICAgYm90aCgoc2lkZSkgPT5cbiAgICAgICAgICBsaW5lKFxuICAgICAgICAgICAgYE0kezEwMCArIHNpZGUgKiAyMn0sNTggUSR7MTAwICsgc2lkZSAqIDMwfSwyOCAkezEwMCArIHNpZGUgKiA1NH0sMjRgLFxuICAgICAgICAgICAga2l0LnNlY29uZCxcbiAgICAgICAgICAgIDEwXG4gICAgICAgICAgKVxuICAgICAgICApLFxuICAgICAgICBib3RoKChzaWRlKSA9PlxuICAgICAgICAgIGVsbGlwc2UoMTAwICsgc2lkZSAqIDYyLCA5MiwgMjEsIDksIGtpdC5ib2R5LCBzaWRlICogMTYpXG4gICAgICAgICksXG4gICAgICAgIHRvcnNvKGtpdC5ib2R5KSxcbiAgICAgICAgYmxvYihbOTAsIDE0NiwgMTEwLCAxNDYsIDEwMCwgMTcyXSwga2l0LnNlY29uZCwgOCksXG4gICAgICAgIGhlYWQoa2l0LmJvZHksIDUyLCA1NCwgOTgpLFxuICAgICAgICBlbGxpcHNlKDEwMCwgMTI0LCAyMiwgMTcsIFwiI2Y0YzdjZlwiKSxcbiAgICAgICAgZXllcyhraXQsIDI2LCA5NCksXG4gICAgICAgIGJvdGgoKHNpZGUpID0+IGVsbGlwc2UoMTAwICsgc2lkZSAqIDYsIDEyMCwgMi4yLCAzLCBraXQuaW5rKSksXG4gICAgICAgIHNtaWxlKDEyOCwgNywgNSwga2l0LmluaylcbiAgICAgICksXG4gIH0sXG4gIGFscGFjYToge1xuICAgIGNvbG9yczogW1xuICAgICAgW1wiI2Y0ZTZjZVwiLCBQRUFSTF0sXG4gICAgICBbXCIjYzlhMjdlXCIsIFwiI2Y0ZTZjZVwiXSxcbiAgICAgIFtQRUFSTCwgXCIjZjRjN2NmXCJdLFxuICAgIF0sXG4gICAgZHJhdzogKGtpdCkgPT5cbiAgICAgIGZpZ3VyZShcbiAgICAgICAgYm90aCgoc2lkZSkgPT4gW1xuICAgICAgICAgIGVsbGlwc2UoMTAwICsgc2lkZSAqIDM0LCA0OCwgMTAsIDI0LCBraXQuYm9keSwgc2lkZSAqIDIyKSxcbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiAzNCwgNTAsIDQuNiwgMTUsIGtpdC5zZWNvbmQsIHNpZGUgKiAyMiksXG4gICAgICAgIF0pLFxuICAgICAgICB0b3JzbyhraXQuYm9keSwgNTApLFxuICAgICAgICBib3RoKChzaWRlKSA9PiBbXG4gICAgICAgICAgZWxsaXBzZSgxMDAgKyBzaWRlICogMzAsIDE1NiwgMjQsIDI0LCBraXQuYm9keSksXG4gICAgICAgICAgZWxsaXBzZSgxMDAgKyBzaWRlICogNDQsIDE4NCwgMjQsIDI0LCBraXQuYm9keSksXG4gICAgICAgIF0pLFxuICAgICAgICBlbGxpcHNlKDEwMCwgMTUwLCAzMCwgNTYsIGtpdC5ib2R5KSxcbiAgICAgICAgaGVhZChraXQuYm9keSwgNDQsIDQ2LCA5NiksXG4gICAgICAgIGVsbGlwc2UoMTAwLCA1MCwgMjgsIDIwLCBraXQuYm9keSksXG4gICAgICAgIGVsbGlwc2UoNzgsIDYwLCAxOCwgMTYsIGtpdC5ib2R5KSxcbiAgICAgICAgZWxsaXBzZSgxMjIsIDYwLCAxOCwgMTYsIGtpdC5ib2R5KSxcbiAgICAgICAgZWxsaXBzZSgxMDAsIDExNCwgMjMsIDE5LCBraXQuc2Vjb25kKSxcbiAgICAgICAgZXllcyhraXQsIDIxLCA5MiwgNS40KSxcbiAgICAgICAgbm9zZSgxMDcsIDUuNCwgMy44LCBraXQuaW5rKSxcbiAgICAgICAgbGluZShcIk0xMDAsMTEwIFYxMTcgTTkyLDExOSBRMTAwLDEyNiAxMDgsMTE5XCIsIGtpdC5pbmssIDMuNilcbiAgICAgICksXG4gIH0sXG59IHNhdGlzZmllcyBSZWNvcmQ8c3RyaW5nLCBEZXNpZ24+O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL21hc2NvdC9mYW1pbHkvbWFyaW5lLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9tYXNjb3QvZmFtaWx5XCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9tYXNjb3QvZmFtaWx5L21hcmluZS50c1wiO2ltcG9ydCB7XG4gIGJsb2IsXG4gIGJvdGgsXG4gIHR5cGUgRGVzaWduLFxuICBlbGxpcHNlLFxuICBleWUsXG4gIGV5ZXMsXG4gIGZhZGVkLFxuICBmaWd1cmUsXG4gIGhlYWQsXG4gIGtpbmRBdCxcbiAgbGluZSxcbiAgb3V0bGluZWQsXG4gIFBFQVJMLFxuICBwYXRoLFxuICBzbWlsZSxcbiAgc3Bpa2VzLFxuICB0b3Jzbyxcbn0gZnJvbSBcIkByZXBvL21hc2NvdC9raXRcIjtcbmltcG9ydCB7IEFycmF5IGFzIEFyciB9IGZyb20gXCJlZmZlY3RcIjtcblxuLyoqIFRoZSBhbmltYWxzIG9mIHRoZSBvcGVuIHNlYSwgdGhlIHJlZWYsIGFuZCB0aGUgc2hvcmUuICovXG5leHBvcnQgY29uc3QgbWFyaW5lID0ge1xuICB3aGFsZToge1xuICAgIGNvbG9yczogW1xuICAgICAgW1wiI2FlYjhmNVwiLCBcIiNlZWYxZmRcIl0sXG4gICAgICBbXCIjOGZiN2U4XCIsIFBFQVJMXSxcbiAgICBdLFxuICAgIGRyYXc6IChraXQpID0+XG4gICAgICBmaWd1cmUoXG4gICAgICAgIGxpbmUoXCJNMTAwLDQ2IEwxMDAsMzRcIiwga2l0LnNlY29uZCwgNiksXG4gICAgICAgIGJvdGgoKHNpZGUpID0+XG4gICAgICAgICAgbGluZShcbiAgICAgICAgICAgIGBNMTAwLDM0IFEkezEwMCArIHNpZGUgKiA2fSwxOCAkezEwMCArIHNpZGUgKiAyMn0sMjJgLFxuICAgICAgICAgICAga2l0LnNlY29uZCxcbiAgICAgICAgICAgIDZcbiAgICAgICAgICApXG4gICAgICAgICksXG4gICAgICAgIHBhdGgoXG4gICAgICAgICAgXCJNMjYsMjAwIEMyMCwxNTAgMzQsNTggMTAwLDU2IEMxNjYsNTggMTgwLDE1MCAxNzQsMjAwIFpcIixcbiAgICAgICAgICBraXQuYm9keVxuICAgICAgICApLFxuICAgICAgICBwYXRoKFxuICAgICAgICAgIFwiTTI4LDEyOCBDNjAsMTQyIDE0MCwxNDIgMTcyLDEyOCBDMTcwLDE2MiAxNDIsMjAwIDEwMCwyMDAgQzU4LDIwMCAzMCwxNjIgMjgsMTI4IFpcIixcbiAgICAgICAgICBraXQuc2Vjb25kXG4gICAgICAgICksXG4gICAgICAgIGV5ZXMoa2l0LCA1MCwgMTEyKSxcbiAgICAgICAgc21pbGUoMTI4LCAyMCwgOSwga2l0LmluaylcbiAgICAgICksXG4gIH0sXG4gIHR1cnRsZToge1xuICAgIGNvbG9yczogW1xuICAgICAgW1wiIzk4Y2Y4MlwiLCBcIiNlOGI0NTZcIl0sXG4gICAgICBbXCIjN2ZjN2EwXCIsIFwiI2VmZDJhNlwiXSxcbiAgICBdLFxuICAgIGRyYXc6IChraXQpID0+XG4gICAgICBmaWd1cmUoXG4gICAgICAgIHBhdGgoXG4gICAgICAgICAgXCJNMTQsMjAwIEMxNCwxNTAgNTAsMTEyIDEwMCwxMTIgQzE1MCwxMTIgMTg2LDE1MCAxODYsMjAwIFpcIixcbiAgICAgICAgICBraXQuc2Vjb25kXG4gICAgICAgICksXG4gICAgICAgIGZhZGVkKDAuMywgW1xuICAgICAgICAgIC4uLmJvdGgoKHNpZGUpID0+IGVsbGlwc2UoMTAwICsgc2lkZSAqIDUyLCAxNzAsIDE2LCAxOCwga2l0LmJvZHkpKSxcbiAgICAgICAgICBlbGxpcHNlKDEwMCwgMTY0LCAxNiwgMTgsIGtpdC5ib2R5KSxcbiAgICAgICAgXSksXG4gICAgICAgIHBhdGgoXG4gICAgICAgICAgXCJNNzAsMjAwIEM3MCwxNzYgNzYsMTUwIDg0LDEzNCBMMTE2LDEzNCBDMTI0LDE1MCAxMzAsMTc2IDEzMCwyMDAgWlwiLFxuICAgICAgICAgIGtpdC5ib2R5XG4gICAgICAgICksXG4gICAgICAgIGhlYWQoa2l0LmJvZHksIDQ2LCA0NCwgOTIpLFxuICAgICAgICBleWVzKGtpdCwgMjIsIDg4KSxcbiAgICAgICAgc21pbGUoMTAyLCAxNCwgMTAsIGtpdC5pbmspXG4gICAgICApLFxuICB9LFxuICBvY3RvcHVzOiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbXCIjZjVhNDhlXCIsIFwiI2Y2YzNhNlwiXSxcbiAgICAgIFtcIiNkY2QzZjRcIiwgUEVBUkxdLFxuICAgICAgW1wiI2VjOWFiMFwiLCBcIiNmNGM3Y2ZcIl0sXG4gICAgXSxcbiAgICBkcmF3OiAoa2l0KSA9PlxuICAgICAgZmlndXJlKFxuICAgICAgICBBcnIubWFwKFsyOCwgNjQsIDEwMCwgMTM2LCAxNzJdLCAoYXQpID0+XG4gICAgICAgICAgcGF0aChcbiAgICAgICAgICAgIGBNJHthdCAtIDIwfSwyMDAgTCR7YXQgLSAyMH0sMTUwIEMke2F0IC0gMjB9LDEzNiAke2F0ICsgMjB9LDEzNiAke2F0ICsgMjB9LDE1MCBMJHthdCArIDIwfSwyMDAgWmAsXG4gICAgICAgICAgICBraXQuYm9keVxuICAgICAgICAgIClcbiAgICAgICAgKSxcbiAgICAgICAgZWxsaXBzZSgxMDAsIDk0LCA2NCwgNjAsIGtpdC5ib2R5KSxcbiAgICAgICAgQXJyLm1hcChbMjgsIDY0LCAxMDAsIDEzNiwgMTcyXSwgKGF0KSA9PlxuICAgICAgICAgIGVsbGlwc2UoYXQsIDE4MCwgNS42LCA1LjYsIGtpdC5zZWNvbmQpXG4gICAgICAgICksXG4gICAgICAgIGV5ZXMoa2l0LCAyNCwgOTgpLFxuICAgICAgICBzbWlsZSgxMTIsIDEwLCA5LCBraXQuaW5rKVxuICAgICAgKSxcbiAgfSxcbiAgamVsbHlmaXNoOiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbXCIjZGNkM2Y0XCIsIFBFQVJMXSxcbiAgICAgIFtcIiNmNGM3Y2ZcIiwgUEVBUkxdLFxuICAgICAgW1wiI2NmZTZmN1wiLCBQRUFSTF0sXG4gICAgXSxcbiAgICBkcmF3OiAoa2l0KSA9PlxuICAgICAgZmlndXJlKFxuICAgICAgICBBcnIubWFwKFs1NiwgNzgsIDEwMCwgMTIyLCAxNDRdLCAoYXQpID0+XG4gICAgICAgICAgbGluZShcbiAgICAgICAgICAgIGBNJHthdH0sMTM0IFEke2F0IC0gOX0sMTUyICR7YXR9LDE2OCBRJHthdCArIDl9LDE4NCAke2F0fSwyMDRgLFxuICAgICAgICAgICAga2l0LmJvZHksXG4gICAgICAgICAgICA5XG4gICAgICAgICAgKVxuICAgICAgICApLFxuICAgICAgICBwYXRoKFwiTTM4LDEzMiBDMzgsNzYgNjQsNDQgMTAwLDQ0IEMxMzYsNDQgMTYyLDc2IDE2MiwxMzIgWlwiLCBraXQuYm9keSksXG4gICAgICAgIEFyci5tYXAoWzU2LCA3OCwgMTAwLCAxMjIsIDE0NF0sIChhdCkgPT5cbiAgICAgICAgICBlbGxpcHNlKGF0LCAxMzIsIDEzLCAxMCwga2l0LmJvZHkpXG4gICAgICAgICksXG4gICAgICAgIGVsbGlwc2UoNzAsIDcyLCA4LCA2LCBraXQuc2Vjb25kLCAtMzApLFxuICAgICAgICBlbGxpcHNlKDEyOCwgNjYsIDYsIDUsIGtpdC5zZWNvbmQsIDMwKSxcbiAgICAgICAgZXllcyhraXQsIDI0LCAxMDIpLFxuICAgICAgICBzbWlsZSgxMTIsIDEwLCA4LCBraXQuaW5rKVxuICAgICAgKSxcbiAgfSxcbiAgcHVmZmVyZmlzaDoge1xuICAgIGNvbG9yczogW1xuICAgICAgW1wiI2YzZTdhNlwiLCBQRUFSTF0sXG4gICAgICBbXCIjOGZkMGM0XCIsIFBFQVJMXSxcbiAgICAgIFtcIiNmNmMzYTZcIiwgUEVBUkxdLFxuICAgIF0sXG4gICAgZHJhdzogKGtpdCkgPT5cbiAgICAgIGZpZ3VyZShcbiAgICAgICAgc3Bpa2VzKDEwMCwgMTIwLCA2NCwgODIsIDE5MiwgMzQ4LCA5LCBraXQuYm9keSwgNSksXG4gICAgICAgIGJvdGgoKHNpZGUpID0+XG4gICAgICAgICAgZWxsaXBzZSgxMDAgKyBzaWRlICogNzQsIDEyNiwgMTMsIDIxLCBraXQuYm9keSwgc2lkZSAqIDI4KVxuICAgICAgICApLFxuICAgICAgICBwYXRoKFxuICAgICAgICAgIFwiTTMwLDIwMCBDMjIsMTUwIDQ0LDUyIDEwMCw1MiBDMTU2LDUyIDE3OCwxNTAgMTcwLDIwMCBaXCIsXG4gICAgICAgICAga2l0LmJvZHlcbiAgICAgICAgKSxcbiAgICAgICAgcGF0aChcbiAgICAgICAgICBcIk0zNCwxMzYgQzU2LDE2MCAxNDQsMTYwIDE2NiwxMzYgQzE2NCwxNzYgMTM0LDIwMCAxMDAsMjAwIEM2NiwyMDAgMzYsMTc2IDM0LDEzNiBaXCIsXG4gICAgICAgICAga2l0LnNlY29uZFxuICAgICAgICApLFxuICAgICAgICBib3RoKChzaWRlKSA9PiBlbGxpcHNlKDEwMCArIHNpZGUgKiA0NCwgMTIyLCA4LCA1LjYsIFwiI2Y1YTQ4ZVwiKSksXG4gICAgICAgIGV5ZXMoa2l0LCAyOCwgMTAwLCA4KSxcbiAgICAgICAgZWxsaXBzZSgxMDAsIDEyNiwgOC40LCA3LjQsIGtpdC5pbmspXG4gICAgICApLFxuICB9LFxuICBjbG93bmZpc2g6IHtcbiAgICBjb2xvcnM6IFtcbiAgICAgIFtcIiNmNDdjM2NcIiwgUEVBUkxdLFxuICAgICAgW1wiI2YyYTMzYVwiLCBQRUFSTF0sXG4gICAgXSxcbiAgICBkcmF3OiAoa2l0KSA9PlxuICAgICAgZmlndXJlKFxuICAgICAgICBvdXRsaW5lZChcIk03Niw2MiBDODAsMzYgMTIwLDM2IDEyNCw2MiBaXCIsIGtpdC5ib2R5LCBraXQuaW5rLCAzLjQpLFxuICAgICAgICBib3RoKChzaWRlKSA9PiBbXG4gICAgICAgICAgZWxsaXBzZSgxMDAgKyBzaWRlICogNjYsIDEzNCwgMTgsIDI3LCBraXQuYm9keSwgc2lkZSAqIC0yNCksXG4gICAgICAgICAgZWxsaXBzZSgxMDAgKyBzaWRlICogNzYsIDE0MiwgNiwgMTMsIGtpdC5pbmssIHNpZGUgKiAtMjQpLFxuICAgICAgICBdKSxcbiAgICAgICAgdG9yc28oa2l0LmJvZHksIDQ0KSxcbiAgICAgICAgZWxsaXBzZSgxMDAsIDEyMiwgNjYsIDY4LCBraXQuYm9keSksXG4gICAgICAgIGJvdGgoKHNpZGUpID0+XG4gICAgICAgICAgb3V0bGluZWQoXG4gICAgICAgICAgICBgTSR7MTAwICsgc2lkZSAqIDM0fSw2NCBDJHsxMDAgKyBzaWRlICogNTB9LDk2ICR7MTAwICsgc2lkZSAqIDUwfSwxNTAgJHsxMDAgKyBzaWRlICogMzR9LDE4MiBMJHsxMDAgKyBzaWRlICogNTB9LDE3NCBDJHsxMDAgKyBzaWRlICogNjR9LDE0NiAkezEwMCArIHNpZGUgKiA2NH0sMTAwICR7MTAwICsgc2lkZSAqIDUwfSw3MiBaYCxcbiAgICAgICAgICAgIGtpdC5zZWNvbmQsXG4gICAgICAgICAgICBraXQuaW5rLFxuICAgICAgICAgICAgMy40XG4gICAgICAgICAgKVxuICAgICAgICApLFxuICAgICAgICBleWVzKGtpdCwgMTUsIDEwNCwgNi42KSxcbiAgICAgICAgc21pbGUoMTIxLCAxMSwgOSwga2l0LmluaylcbiAgICAgICksXG4gIH0sXG4gIHN0YXJmaXNoOiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbXCIjZjQ4YTZhXCIsIFwiI2Y3ZDc3NFwiXSxcbiAgICAgIFtcIiNmMmEzM2FcIiwgXCIjZjRlNmNlXCJdLFxuICAgICAgW1wiI2U4OGZiMFwiLCBQRUFSTF0sXG4gICAgXSxcbiAgICBkcmF3OiAoa2l0KSA9PlxuICAgICAgZmlndXJlKFxuICAgICAgICBibG9iKFxuICAgICAgICAgIEFyci5mbGF0TWFwKEFyci5yYW5nZSgwLCA5KSwgKGluZGV4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCByZWFjaCA9IGluZGV4ICUgMiA9PT0gMCA/IDkyIDogNDQ7XG4gICAgICAgICAgICBjb25zdCBhbmdsZSA9IC1NYXRoLlBJIC8gMiArIChpbmRleCAqIE1hdGguUEkpIC8gNTtcbiAgICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAgIDEwMCArIHJlYWNoICogTWF0aC5jb3MoYW5nbGUpLFxuICAgICAgICAgICAgICAxMjIgKyByZWFjaCAqIE1hdGguc2luKGFuZ2xlKSxcbiAgICAgICAgICAgIF07XG4gICAgICAgICAgfSksXG4gICAgICAgICAga2l0LmJvZHksXG4gICAgICAgICAgMjJcbiAgICAgICAgKSxcbiAgICAgICAgZWxsaXBzZSgxMDAsIDU0LCA0LjQsIDQuNCwga2l0LnNlY29uZCksXG4gICAgICAgIGVsbGlwc2UoMTAwLCA3MiwgMy40LCAzLjQsIGtpdC5zZWNvbmQpLFxuICAgICAgICBib3RoKChzaWRlKSA9PiBbXG4gICAgICAgICAgZWxsaXBzZSgxMDAgKyBzaWRlICogNjIsIDEwNCwgNC40LCA0LjQsIGtpdC5zZWNvbmQpLFxuICAgICAgICAgIGVsbGlwc2UoMTAwICsgc2lkZSAqIDQ2LCAxMTAsIDMuNCwgMy40LCBraXQuc2Vjb25kKSxcbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiA0NCwgMTc2LCA0LjQsIDQuNCwga2l0LnNlY29uZCksXG4gICAgICAgIF0pLFxuICAgICAgICBib3RoKChzaWRlKSA9PiBlbGxpcHNlKDEwMCArIHNpZGUgKiAyNiwgMTI2LCA3LCA1LCBraXQuc2Vjb25kKSksXG4gICAgICAgIGV5ZXMoa2l0LCAxNSwgMTEyLCA1LjYpLFxuICAgICAgICBzbWlsZSgxMjQsIDksIDcsIGtpdC5pbmspXG4gICAgICApLFxuICB9LFxuICBjcmFiOiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbXCIjZWU2YTVhXCIsIFwiI2Y2YzNhNlwiXSxcbiAgICAgIFtcIiNmMmEzM2FcIiwgXCIjZjRlNmNlXCJdLFxuICAgIF0sXG4gICAgZHJhdzogKGtpdCkgPT5cbiAgICAgIGZpZ3VyZShcbiAgICAgICAgYm90aCgoc2lkZSkgPT4gW1xuICAgICAgICAgIGxpbmUoXG4gICAgICAgICAgICBgTSR7MTAwICsgc2lkZSAqIDU4fSwxNDAgUSR7MTAwICsgc2lkZSAqIDg2fSwxMjggJHsxMDAgKyBzaWRlICogODB9LDk4YCxcbiAgICAgICAgICAgIGtpdC5ib2R5LFxuICAgICAgICAgICAgMTFcbiAgICAgICAgICApLFxuICAgICAgICAgIGVsbGlwc2UoMTAwICsgc2lkZSAqIDc4LCA4MiwgMjEsIDE3LCBraXQuYm9keSwgc2lkZSAqIC0yNCksXG4gICAgICAgICAgYmxvYihcbiAgICAgICAgICAgIFsxMDAgKyBzaWRlICogNzgsIDgyLCAxMDAgKyBzaWRlICogOTQsIDY0LCAxMDAgKyBzaWRlICogODYsIDgyXSxcbiAgICAgICAgICAgIGtpdC5zZWNvbmQsXG4gICAgICAgICAgICAzXG4gICAgICAgICAgKSxcbiAgICAgICAgXSksXG4gICAgICAgIGJvdGgoKHNpZGUpID0+IFtcbiAgICAgICAgICBsaW5lKGBNJHsxMDAgKyBzaWRlICogMjJ9LDExMiBMJHsxMDAgKyBzaWRlICogMjZ9LDc0YCwga2l0LmJvZHksIDEwKSxcbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiAyNiwgNjYsIDE1LCAxNSwga2l0LmJvZHkpLFxuICAgICAgICBdKSxcbiAgICAgICAgcGF0aChcbiAgICAgICAgICBcIk0yNiwyMDAgQzIwLDE0NiA1MiwxMDQgMTAwLDEwNCBDMTQ4LDEwNCAxODAsMTQ2IDE3NCwyMDAgWlwiLFxuICAgICAgICAgIGtpdC5ib2R5XG4gICAgICAgICksXG4gICAgICAgIHBhdGgoXG4gICAgICAgICAgXCJNNTgsMjAwIEM1OCwxODAgNzYsMTY2IDEwMCwxNjYgQzEyNCwxNjYgMTQyLDE4MCAxNDIsMjAwIFpcIixcbiAgICAgICAgICBraXQuc2Vjb25kXG4gICAgICAgICksXG4gICAgICAgIGJvdGgoKHNpZGUpID0+XG4gICAgICAgICAgZXllKFxuICAgICAgICAgICAga2luZEF0KGtpdC5leWVzLCBzaWRlKSxcbiAgICAgICAgICAgIDEwMCArIHNpZGUgKiAyNiArIGtpdC5sb29rLFxuICAgICAgICAgICAgNjYsXG4gICAgICAgICAgICA2LFxuICAgICAgICAgICAga2l0Lmlua1xuICAgICAgICAgIClcbiAgICAgICAgKSxcbiAgICAgICAgc21pbGUoMTMyLCAxNiwgMTAsIGtpdC5pbmspXG4gICAgICApLFxuICB9LFxufSBzYXRpc2ZpZXMgUmVjb3JkPHN0cmluZywgRGVzaWduPjtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9tYXNjb3QvZmFtaWx5L3ByaW1hdGUudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL21hc2NvdC9mYW1pbHlcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL21hc2NvdC9mYW1pbHkvcHJpbWF0ZS50c1wiO2ltcG9ydCB7XG4gIGJlbGx5LFxuICBibG9iLFxuICBib3RoLFxuICB0eXBlIERlc2lnbixcbiAgZWxsaXBzZSxcbiAgZXllcyxcbiAgZmlndXJlLFxuICBoZWFkLFxuICBub3NlLFxuICBQRUFSTCxcbiAgcm91bmRFYXJzLFxuICBzbWlsZSxcbiAgdG9yc28sXG59IGZyb20gXCJAcmVwby9tYXNjb3Qva2l0XCI7XG5cbi8qKiBUaGUgYXBlcyBhbmQgbW9ua2V5cywgYW5kIHRoZSB0YXJzaWVyIHRoYXQgd2F0Y2hlcyBmcm9tIHRoZSB0cmVlcy4gKi9cbmV4cG9ydCBjb25zdCBwcmltYXRlID0ge1xuICBvcmFuZ3V0YW46IHtcbiAgICBjb2xvcnM6IFtcbiAgICAgIFtcIiNlZThhNGNcIiwgXCIjZjZjM2E2XCJdLFxuICAgICAgW1wiI2Q5ODI0YVwiLCBcIiNlZmQyYTZcIl0sXG4gICAgXSxcbiAgICBkcmF3OiAoa2l0KSA9PlxuICAgICAgZmlndXJlKFxuICAgICAgICBibG9iKFs4OCwgNTAsIDg0LCAzMCwgOTgsIDQ0XSwga2l0LmJvZHksIDgpLFxuICAgICAgICBibG9iKFsxMDAsIDQ2LCAxMDQsIDI0LCAxMTIsIDQ2XSwga2l0LmJvZHksIDgpLFxuICAgICAgICBibG9iKFsxMTIsIDUwLCAxMjIsIDM0LCAxMjAsIDUyXSwga2l0LmJvZHksIDgpLFxuICAgICAgICB0b3JzbyhraXQuYm9keSwgNjIpLFxuICAgICAgICBib3RoKChzaWRlKSA9PiBlbGxpcHNlKDEwMCArIHNpZGUgKiA0NCwgMTAyLCAyOCwgMzgsIGtpdC5ib2R5KSksXG4gICAgICAgIGhlYWQoa2l0LmJvZHksIDQ2LCA1MiwgOTgpLFxuICAgICAgICBlbGxpcHNlKDEwMCwgMTA0LCA0MCwgNDQsIGtpdC5zZWNvbmQpLFxuICAgICAgICBiZWxseShraXQuc2Vjb25kLCAzMCwgMTUyKSxcbiAgICAgICAgZXllcyhraXQsIDE1LCA5MiksXG4gICAgICAgIGJvdGgoKHNpZGUpID0+IGVsbGlwc2UoMTAwICsgc2lkZSAqIDUsIDExMCwgMiwgMi42LCBraXQuaW5rKSksXG4gICAgICAgIHNtaWxlKDEyMCwgMTQsIDEwLCBraXQuaW5rKVxuICAgICAgKSxcbiAgfSxcbiAgdGFyc2llcjoge1xuICAgIGNvbG9yczogW1xuICAgICAgW1wiI2VmZDJhNlwiLCBcIiNmN2Q3NzRcIl0sXG4gICAgICBbXCIjYzlhMjdlXCIsIFwiI2YzZTdhNlwiXSxcbiAgICBdLFxuICAgIGRyYXc6IChraXQpID0+XG4gICAgICBmaWd1cmUoXG4gICAgICAgIGJvdGgoKHNpZGUpID0+IFtcbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiA1NiwgNjIsIDIwLCAyNiwga2l0LmJvZHksIHNpZGUgKiAyNCksXG4gICAgICAgICAgZWxsaXBzZSgxMDAgKyBzaWRlICogNTYsIDY0LCAxMCwgMTUsIFwiI2Y0YzdjZlwiLCBzaWRlICogMjQpLFxuICAgICAgICBdKSxcbiAgICAgICAgdG9yc28oa2l0LmJvZHksIDQ4KSxcbiAgICAgICAgaGVhZChraXQuYm9keSwgNTgsIDUwLCAxMDApLFxuICAgICAgICBiZWxseShQRUFSTCwgMjQsIDE1MiksXG4gICAgICAgIGJvdGgoKHNpZGUpID0+IGVsbGlwc2UoMTAwICsgc2lkZSAqIDI4LCA5NiwgMjcsIDI3LCBraXQuc2Vjb25kKSksXG4gICAgICAgIGV5ZXMoa2l0LCAyOCwgOTYsIDEyKSxcbiAgICAgICAgbm9zZSgxMjQsIDQsIDMsIGtpdC5pbmspLFxuICAgICAgICBzbWlsZSgxMzAsIDYsIDUsIGtpdC5pbmspXG4gICAgICApLFxuICB9LFxuICBtb25rZXk6IHtcbiAgICBjb2xvcnM6IFtcbiAgICAgIFtcIiNiOThhNjNcIiwgXCIjZjRlNmNlXCJdLFxuICAgICAgW1wiI2M5YTI3ZVwiLCBcIiNmNmMzYTZcIl0sXG4gICAgICBbXCIjOGY2YTRmXCIsIFwiI2VmZDJhNlwiXSxcbiAgICBdLFxuICAgIGRyYXc6IChraXQpID0+XG4gICAgICBmaWd1cmUoXG4gICAgICAgIHJvdW5kRWFycyhraXQuYm9keSwga2l0LnNlY29uZCwgNjIsIDk2LCAxOCksXG4gICAgICAgIHRvcnNvKGtpdC5ib2R5KSxcbiAgICAgICAgaGVhZChraXQuYm9keSwgNTYsIDUyKSxcbiAgICAgICAgYm90aCgoc2lkZSkgPT4gZWxsaXBzZSgxMDAgKyBzaWRlICogMTksIDkyLCAyNCwgMjQsIGtpdC5zZWNvbmQpKSxcbiAgICAgICAgZWxsaXBzZSgxMDAsIDExNiwgMzQsIDI2LCBraXQuc2Vjb25kKSxcbiAgICAgICAgYmVsbHkoa2l0LnNlY29uZCksXG4gICAgICAgIGV5ZXMoa2l0LCAyMCwgOTIpLFxuICAgICAgICBib3RoKChzaWRlKSA9PiBlbGxpcHNlKDEwMCArIHNpZGUgKiA1LCAxMTAsIDIsIDIuNiwga2l0LmluaykpLFxuICAgICAgICBzbWlsZSgxMjAsIDEzLCA5LCBraXQuaW5rKVxuICAgICAgKSxcbiAgfSxcbiAgcHJvYm9zY2lzOiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbXCIjZDk4MjRhXCIsIFwiI2Y2YzNhNlwiXSxcbiAgICAgIFtcIiNjOTc4M2FcIiwgXCIjZWZkMmE2XCJdLFxuICAgIF0sXG4gICAgZHJhdzogKGtpdCkgPT5cbiAgICAgIGZpZ3VyZShcbiAgICAgICAgYmxvYihbOTAsIDUyLCA5MiwgMzYsIDEwMiwgNDhdLCBraXQuYm9keSwgOCksXG4gICAgICAgIGJsb2IoWzEwMiwgNTAsIDExMCwgMzIsIDExNCwgNTJdLCBraXQuYm9keSwgOCksXG4gICAgICAgIHJvdW5kRWFycyhraXQuYm9keSwga2l0LnNlY29uZCwgNjAsIDk4LCAxMyksXG4gICAgICAgIHRvcnNvKGtpdC5ib2R5LCA2MCksXG4gICAgICAgIGhlYWQoa2l0LmJvZHksIDU2LCA1NCwgOTgpLFxuICAgICAgICBib3RoKChzaWRlKSA9PiBlbGxpcHNlKDEwMCArIHNpZGUgKiAxOCwgOTIsIDIzLCAyMiwga2l0LnNlY29uZCkpLFxuICAgICAgICBlbGxpcHNlKDEwMCwgMTE2LCAzMywgMjcsIGtpdC5zZWNvbmQpLFxuICAgICAgICBiZWxseShQRUFSTCwgMzIsIDE1MCksXG4gICAgICAgIGV5ZXMoa2l0LCAxOSwgOTApLFxuICAgICAgICBzbWlsZSgxMzQsIDExLCA2LCBraXQuaW5rKSxcbiAgICAgICAgZWxsaXBzZSgxMDAsIDExNCwgMTEsIDE5LCBcIiNlODljN2NcIilcbiAgICAgICksXG4gIH0sXG59IHNhdGlzZmllcyBSZWNvcmQ8c3RyaW5nLCBEZXNpZ24+O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL21hc2NvdC9mYW1pbHkvcmVwdGlsZS50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvbWFzY290L2ZhbWlseVwiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvbWFzY290L2ZhbWlseS9yZXB0aWxlLnRzXCI7aW1wb3J0IHtcbiAgYmVsbHksXG4gIGJsb2IsXG4gIGJvdGgsXG4gIHR5cGUgRGVzaWduLFxuICBlbGxpcHNlLFxuICBleWUsXG4gIGV5ZXMsXG4gIGZhZGVkLFxuICBmaWd1cmUsXG4gIGhlYWQsXG4gIGtpbmRBdCxcbiAgbGluZSxcbiAgUEVBUkwsXG4gIHBhdGgsXG4gIHNtaWxlLFxuICB0b3Jzbyxcbn0gZnJvbSBcIkByZXBvL21hc2NvdC9raXRcIjtcbmltcG9ydCB7IEFycmF5IGFzIEFyciB9IGZyb20gXCJlZmZlY3RcIjtcblxuLyoqIFRoZSByZXB0aWxlcywgYW5kIHRoZSBhbXBoaWJpYW5zIHRoYXQgbGl2ZSBiZXNpZGUgdGhlbS4gKi9cbmV4cG9ydCBjb25zdCByZXB0aWxlID0ge1xuICBrb21vZG86IHtcbiAgICBjb2xvcnM6IFtcbiAgICAgIFtcIiNiNGJjODRcIiwgXCIjZWM5YWIwXCJdLFxuICAgICAgW1wiIzlmYjA3YVwiLCBcIiNmNWE0OGVcIl0sXG4gICAgXSxcbiAgICBkcmF3OiAoa2l0KSA9PlxuICAgICAgZmlndXJlKFxuICAgICAgICB0b3JzbyhraXQuYm9keSwgNTgpLFxuICAgICAgICBoZWFkKGtpdC5ib2R5LCA2NiwgNDQsIDEwNCksXG4gICAgICAgIGxpbmUoXG4gICAgICAgICAgXCJNMTAwLDEyOCBMMTAwLDE0NiBNMTAwLDE0NiBMOTIsMTU4IE0xMDAsMTQ2IEwxMDgsMTU4XCIsXG4gICAgICAgICAga2l0LnNlY29uZCxcbiAgICAgICAgICA2XG4gICAgICAgICksXG4gICAgICAgIGZhZGVkKDAuMjIsIFtcbiAgICAgICAgICAuLi5ib3RoKChzaWRlKSA9PiBbXG4gICAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiAxNCwgNjAsIDUsIDQsIGtpdC5pbmspLFxuICAgICAgICAgICAgZWxsaXBzZSgxMDAgKyBzaWRlICogMzAsIDY4LCA0LCAzLjQsIGtpdC5pbmspLFxuICAgICAgICAgIF0pLFxuICAgICAgICAgIGVsbGlwc2UoMTAwLCA1NiwgNSwgNCwga2l0LmluayksXG4gICAgICAgIF0pLFxuICAgICAgICBleWVzKGtpdCwgMzYsIDk2KSxcbiAgICAgICAgYm90aCgoc2lkZSkgPT4gZWxsaXBzZSgxMDAgKyBzaWRlICogOCwgMTEyLCAyLjQsIDIuNCwga2l0LmluaykpLFxuICAgICAgICBsaW5lKFwiTTcwLDEyNiBRMTAwLDEzNiAxMzAsMTI2XCIsIGtpdC5pbmssIDQuNClcbiAgICAgICksXG4gIH0sXG4gIGNyb2NvZGlsZToge1xuICAgIGNvbG9yczogW1xuICAgICAgW1wiIzZmYWU2YVwiLCBcIiNkZGViYjVcIl0sXG4gICAgICBbXCIjNWU5YzdjXCIsIFwiI2NmZWJkOVwiXSxcbiAgICBdLFxuICAgIGRyYXc6IChraXQpID0+XG4gICAgICBmaWd1cmUoXG4gICAgICAgIGJvdGgoKHNpZGUpID0+IGVsbGlwc2UoMTAwICsgc2lkZSAqIDI2LCA1OCwgMTksIDE5LCBraXQuYm9keSkpLFxuICAgICAgICB0b3JzbyhraXQuYm9keSwgNTgpLFxuICAgICAgICBiZWxseShraXQuc2Vjb25kLCAzNCwgMTY2KSxcbiAgICAgICAgaGVhZChraXQuYm9keSwgNDYsIDM0LCA4MCksXG4gICAgICAgIHBhdGgoXG4gICAgICAgICAgXCJNNjIsODQgQzYyLDcwIDEzOCw3MCAxMzgsODQgQzE0MCwxMDQgMTUyLDExOCAxNTIsMTMyIEMxNTIsMTUwIDEyNiwxNTggMTAwLDE1OCBDNzQsMTU4IDQ4LDE1MCA0OCwxMzIgQzQ4LDExOCA2MCwxMDQgNjIsODQgWlwiLFxuICAgICAgICAgIGtpdC5ib2R5XG4gICAgICAgICksXG4gICAgICAgIGVsbGlwc2UoMTAwLCA4NCwgNCwgNCwga2l0LnNlY29uZCksXG4gICAgICAgIGVsbGlwc2UoMTAwLCA5OCwgMy40LCAzLjQsIGtpdC5zZWNvbmQpLFxuICAgICAgICBib3RoKChzaWRlKSA9PlxuICAgICAgICAgIGV5ZShcbiAgICAgICAgICAgIGtpbmRBdChraXQuZXllcywgc2lkZSksXG4gICAgICAgICAgICAxMDAgKyBzaWRlICogMjYgKyBraXQubG9vayxcbiAgICAgICAgICAgIDU4LFxuICAgICAgICAgICAgNS44LFxuICAgICAgICAgICAga2l0Lmlua1xuICAgICAgICAgIClcbiAgICAgICAgKSxcbiAgICAgICAgYm90aCgoc2lkZSkgPT4gZWxsaXBzZSgxMDAgKyBzaWRlICogMTIsIDExOCwgMy4yLCA0LCBraXQuaW5rKSksXG4gICAgICAgIEFyci5tYXAoXG4gICAgICAgICAgW1xuICAgICAgICAgICAgWy00MCwgMTM5XSxcbiAgICAgICAgICAgIFstMjYsIDE0M10sXG4gICAgICAgICAgICBbLTEyLCAxNDVdLFxuICAgICAgICAgICAgWzEyLCAxNDVdLFxuICAgICAgICAgICAgWzI2LCAxNDNdLFxuICAgICAgICAgICAgWzQwLCAxMzldLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgKFt4LCB5XSkgPT5cbiAgICAgICAgICAgIGJsb2IoXG4gICAgICAgICAgICAgIFsxMDAgKyB4IC0gNC41LCB5LCAxMDAgKyB4ICsgNC41LCB5LCAxMDAgKyB4LCB5ICsgOV0sXG4gICAgICAgICAgICAgIFBFQVJMLFxuICAgICAgICAgICAgICAyLjRcbiAgICAgICAgICAgIClcbiAgICAgICAgKSxcbiAgICAgICAgbGluZShcIk01MCwxMzQgUTEwMCwxNTAgMTUwLDEzNFwiLCBraXQuaW5rLCA0LjYpXG4gICAgICApLFxuICB9LFxuICBzbmFrZToge1xuICAgIGNvbG9yczogW1xuICAgICAgW1wiIzdmYzdhMFwiLCBcIiNmN2Q3NzRcIl0sXG4gICAgICBbXCIjZjJhMzNhXCIsIFwiI2Y0ZTZjZVwiXSxcbiAgICAgIFtcIiM4ZTlhZDZcIiwgXCIjZjRjN2NmXCJdLFxuICAgIF0sXG4gICAgZHJhdzogKGtpdCkgPT5cbiAgICAgIGZpZ3VyZShcbiAgICAgICAgZWxsaXBzZSgxMDAsIDE5MCwgNzIsIDI4LCBraXQuYm9keSksXG4gICAgICAgIGxpbmUoXCJNNDgsMTkwIFExMDAsMjEyIDE1MiwxOTBcIiwga2l0LnNlY29uZCwgNi40KSxcbiAgICAgICAgZWxsaXBzZSgxMDAsIDE1OCwgNTQsIDIzLCBraXQuYm9keSksXG4gICAgICAgIGxpbmUoXCJNNjAsMTU4IFExMDAsMTc2IDE0MCwxNThcIiwga2l0LnNlY29uZCwgNi40KSxcbiAgICAgICAgZWxsaXBzZSgxMDAsIDEyNiwgMjIsIDM2LCBraXQuYm9keSksXG4gICAgICAgIGVsbGlwc2UoMTAwLCA4OCwgNDIsIDM1LCBraXQuYm9keSksXG4gICAgICAgIGVsbGlwc2UoMTAwLCA2NCwgNS40LCA0LjQsIGtpdC5zZWNvbmQpLFxuICAgICAgICBib3RoKChzaWRlKSA9PiBlbGxpcHNlKDEwMCArIHNpZGUgKiAyNCwgNzAsIDQuNCwgMy42LCBraXQuc2Vjb25kKSksXG4gICAgICAgIGxpbmUoXCJNMTAwLDEwNyBWMTI1IE0xMDAsMTI1IEw5MiwxMzUgTTEwMCwxMjUgTDEwOCwxMzVcIiwgXCIjZWU2YTVhXCIsIDQpLFxuICAgICAgICBleWVzKGtpdCwgMTksIDg0LCA1LjYpLFxuICAgICAgICBsaW5lKFwiTTg0LDEwMiBRMTAwLDExMyAxMTYsMTAyXCIsIGtpdC5pbmssIDQuMilcbiAgICAgICksXG4gIH0sXG4gIGZyb2c6IHtcbiAgICBjb2xvcnM6IFtcbiAgICAgIFtcIiM5OGNmODJcIiwgXCIjZGRlYmI1XCJdLFxuICAgICAgW1wiIzdmYzdhMFwiLCBcIiNjZmViZDlcIl0sXG4gICAgXSxcbiAgICBkcmF3OiAoa2l0KSA9PlxuICAgICAgZmlndXJlKFxuICAgICAgICBib3RoKChzaWRlKSA9PiBbXG4gICAgICAgICAgZWxsaXBzZSgxMDAgKyBzaWRlICogMzIsIDU4LCAyNSwgMjUsIGtpdC5ib2R5KSxcbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiAzMiwgNTgsIDE1LCAxNSwga2l0LnNlY29uZCksXG4gICAgICAgIF0pLFxuICAgICAgICB0b3JzbyhraXQuYm9keSwgNjIpLFxuICAgICAgICBoZWFkKGtpdC5ib2R5LCA2OCwgNDYsIDEwNiksXG4gICAgICAgIGJlbGx5KGtpdC5zZWNvbmQsIDM4LCAxNDApLFxuICAgICAgICBib3RoKChzaWRlKSA9PlxuICAgICAgICAgIGV5ZShraW5kQXQoa2l0LmV5ZXMsIHNpZGUpLCAxMDAgKyBzaWRlICogMzIsIDU4LCA2LjYsIGtpdC5pbmspXG4gICAgICAgICksXG4gICAgICAgIHNtaWxlKDExMiwgMzAsIDE2LCBraXQuaW5rKVxuICAgICAgKSxcbiAgfSxcbiAgYXhvbG90bDoge1xuICAgIGNvbG9yczogW1xuICAgICAgW1wiI2Y0YzdjZlwiLCBcIiNlYzlhYjBcIl0sXG4gICAgICBbXCIjZGNkM2Y0XCIsIFwiI2FlYjhmNVwiXSxcbiAgICBdLFxuICAgIGRyYXc6IChraXQpID0+XG4gICAgICBmaWd1cmUoXG4gICAgICAgIGJvdGgoKHNpZGUpID0+IFtcbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiA2NiwgNjYsIDIwLCA4LCBraXQuc2Vjb25kLCBzaWRlICogLTM2KSxcbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiA3MiwgOTIsIDIwLCA4LCBraXQuc2Vjb25kLCBzaWRlICogLTgpLFxuICAgICAgICAgIGVsbGlwc2UoMTAwICsgc2lkZSAqIDY4LCAxMTgsIDIwLCA4LCBraXQuc2Vjb25kLCBzaWRlICogMjIpLFxuICAgICAgICBdKSxcbiAgICAgICAgdG9yc28oa2l0LmJvZHkpLFxuICAgICAgICBoZWFkKGtpdC5ib2R5LCA2MiwgNDgsIDEwMCksXG4gICAgICAgIGV5ZXMoa2l0LCAzNCwgOTYpLFxuICAgICAgICBzbWlsZSgxMDgsIDIwLCAxMiwga2l0LmluaylcbiAgICAgICksXG4gIH0sXG59IHNhdGlzZmllcyBSZWNvcmQ8c3RyaW5nLCBEZXNpZ24+O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL21hc2NvdC9mYW1pbHkvc21hbGwudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL21hc2NvdC9mYW1pbHlcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL21hc2NvdC9mYW1pbHkvc21hbGwudHNcIjtpbXBvcnQge1xuICBiZWxseSxcbiAgYmxvYixcbiAgYm90aCxcbiAgdHlwZSBEZXNpZ24sXG4gIGVsbGlwc2UsXG4gIGV5ZXMsXG4gIGZpZ3VyZSxcbiAgaGVhZCxcbiAgbm9zZSxcbiAgUEVBUkwsXG4gIHBhdGgsXG4gIHJvdW5kRWFycyxcbiAgc21pbGUsXG4gIHNwaWtlcyxcbiAgdG9yc28sXG59IGZyb20gXCJAcmVwby9tYXNjb3Qva2l0XCI7XG5cbi8qKiBUaGUgc21hbGwgbWFtbWFsczogdGhlIGduYXdlcnMsIHRoZSByYWJiaXQsIHRoZSBrb2FsYSwgYW5kIHRoZSBiYXQuICovXG5leHBvcnQgY29uc3Qgc21hbGwgPSB7XG4gIHJhYmJpdDoge1xuICAgIGNvbG9yczogW1xuICAgICAgW1BFQVJMLCBcIiNmNGM3Y2ZcIl0sXG4gICAgICBbXCIjZGNkM2Y0XCIsIFBFQVJMXSxcbiAgICAgIFtcIiNlZmQyYTZcIiwgXCIjZjRlNmNlXCJdLFxuICAgIF0sXG4gICAgZHJhdzogKGtpdCkgPT5cbiAgICAgIGZpZ3VyZShcbiAgICAgICAgYm90aCgoc2lkZSkgPT4gW1xuICAgICAgICAgIGVsbGlwc2UoMTAwICsgc2lkZSAqIDI0LCAzNiwgMTUsIDQyLCBraXQuYm9keSwgc2lkZSAqIDgpLFxuICAgICAgICAgIGVsbGlwc2UoMTAwICsgc2lkZSAqIDI0LCAzOCwgNywgMzAsIGtpdC5zZWNvbmQsIHNpZGUgKiA4KSxcbiAgICAgICAgXSksXG4gICAgICAgIHRvcnNvKGtpdC5ib2R5KSxcbiAgICAgICAgaGVhZChraXQuYm9keSwgNTYsIDQ4LCAxMDIpLFxuICAgICAgICBiZWxseShraXQuc2Vjb25kKSxcbiAgICAgICAgZXllcyhraXQsIDI0LCA5OCksXG4gICAgICAgIG5vc2UoMTEwLCA0LjYsIDMuNiwga2l0LmluayksXG4gICAgICAgIHNtaWxlKDExNywgOCwgNywga2l0LmluaylcbiAgICAgICksXG4gIH0sXG4gIGhhbXN0ZXI6IHtcbiAgICBjb2xvcnM6IFtcbiAgICAgIFtcIiNlOGI0NTZcIiwgXCIjZjRlNmNlXCJdLFxuICAgICAgW1wiI2VmZDJhNlwiLCBQRUFSTF0sXG4gICAgXSxcbiAgICBkcmF3OiAoa2l0KSA9PlxuICAgICAgZmlndXJlKFxuICAgICAgICByb3VuZEVhcnMoa2l0LmJvZHksIGtpdC5zZWNvbmQsIDQyLCA1MiwgMTQpLFxuICAgICAgICB0b3JzbyhraXQuYm9keSwgNjApLFxuICAgICAgICBoZWFkKGtpdC5ib2R5LCA2NCwgNTQsIDEwMCksXG4gICAgICAgIGJvdGgoKHNpZGUpID0+IGVsbGlwc2UoMTAwICsgc2lkZSAqIDMwLCAxMTgsIDI2LCAyNCwga2l0LnNlY29uZCkpLFxuICAgICAgICBiZWxseShraXQuc2Vjb25kLCAzMCwgMTUwKSxcbiAgICAgICAgZXllcyhraXQsIDI0LCA5MiksXG4gICAgICAgIG5vc2UoMTA4LCA0LjYsIDMuNiwga2l0LmluayksXG4gICAgICAgIHNtaWxlKDExNCwgNiwgNiwga2l0LmluaylcbiAgICAgICksXG4gIH0sXG4gIG1vdXNlOiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbXCIjYzlkMmRjXCIsIFwiI2Y0YzdjZlwiXSxcbiAgICAgIFtcIiNlZmQyYTZcIiwgXCIjZjRjN2NmXCJdLFxuICAgIF0sXG4gICAgZHJhdzogKGtpdCkgPT5cbiAgICAgIGZpZ3VyZShcbiAgICAgICAgcm91bmRFYXJzKGtpdC5ib2R5LCBraXQuc2Vjb25kLCA1MCwgNTYsIDI4KSxcbiAgICAgICAgdG9yc28oa2l0LmJvZHksIDUwKSxcbiAgICAgICAgaGVhZChraXQuYm9keSwgNTAsIDQ2LCAxMDIpLFxuICAgICAgICBiZWxseShraXQuc2Vjb25kLCAyNiwgMTUyKSxcbiAgICAgICAgZXllcyhraXQsIDIyLCA5OCksXG4gICAgICAgIG5vc2UoMTEyLCA1LjYsIDQuNCwga2l0LnNlY29uZCksXG4gICAgICAgIHNtaWxlKDExOSwgNywgNiwga2l0LmluaylcbiAgICAgICksXG4gIH0sXG4gIHNxdWlycmVsOiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbXCIjZDk4MjRhXCIsIFwiI2Y0ZTZjZVwiXSxcbiAgICAgIFtcIiNiOThhNjNcIiwgUEVBUkxdLFxuICAgICAgW1wiI2I5YzBjY1wiLCBQRUFSTF0sXG4gICAgXSxcbiAgICBkcmF3OiAoa2l0KSA9PlxuICAgICAgZmlndXJlKFxuICAgICAgICBlbGxpcHNlKDE2MCwgMTMyLCAzNCwgNjYsIGtpdC5ib2R5LCAxMiksXG4gICAgICAgIGVsbGlwc2UoMTQ2LCA2NiwgMzAsIDMwLCBraXQuYm9keSksXG4gICAgICAgIGVsbGlwc2UoMTYwLCAxMjgsIDE0LCA0Niwga2l0LnNlY29uZCwgMTIpLFxuICAgICAgICBib3RoKChzaWRlKSA9PlxuICAgICAgICAgIGJsb2IoXG4gICAgICAgICAgICBbMTAwICsgc2lkZSAqIDQwLCA2MiwgMTAwICsgc2lkZSAqIDQ2LCAzMiwgMTAwICsgc2lkZSAqIDIyLCA1Ml0sXG4gICAgICAgICAgICBraXQuYm9keSxcbiAgICAgICAgICAgIDEwXG4gICAgICAgICAgKVxuICAgICAgICApLFxuICAgICAgICB0b3JzbyhraXQuYm9keSwgNTApLFxuICAgICAgICBoZWFkKGtpdC5ib2R5LCA1NCwgNTAsIDk4KSxcbiAgICAgICAgYm90aCgoc2lkZSkgPT4gZWxsaXBzZSgxMDAgKyBzaWRlICogMjMsIDExNCwgMjEsIDE4LCBraXQuc2Vjb25kKSksXG4gICAgICAgIGJlbGx5KGtpdC5zZWNvbmQsIDI2LCAxNTIpLFxuICAgICAgICBleWVzKGtpdCwgMjQsIDkyKSxcbiAgICAgICAgbm9zZSgxMDYsIDUsIDMuOCwga2l0LmluayksXG4gICAgICAgIHBhdGgoXCJNOTYsMTEyIEwxMDQsMTEyIEwxMDMsMTIyIEw5NywxMjIgWlwiLCBQRUFSTClcbiAgICAgICksXG4gIH0sXG4gIHBvcmN1cGluZToge1xuICAgIGNvbG9yczogW1xuICAgICAgW1wiI2I5OGE2M1wiLCBcIiNmNGU2Y2VcIl0sXG4gICAgICBbXCIjOGY2YTRmXCIsIFBFQVJMXSxcbiAgICBdLFxuICAgIGRyYXc6IChraXQpID0+XG4gICAgICBmaWd1cmUoXG4gICAgICAgIHNwaWtlcygxMDAsIDEwOCwgNTQsIDgwLCAxODgsIDM1MiwgMTEsIGtpdC5ib2R5LCA2KSxcbiAgICAgICAgcGF0aChcbiAgICAgICAgICBcIk0zNCwyMDAgQzMwLDE1MCA0Niw5NiAxMDAsOTYgQzE1NCw5NiAxNzAsMTUwIDE2NiwyMDAgWlwiLFxuICAgICAgICAgIGtpdC5ib2R5XG4gICAgICAgICksXG4gICAgICAgIGVsbGlwc2UoMTAwLCAxMDgsIDYwLCA1NCwga2l0LmJvZHkpLFxuICAgICAgICBib3RoKChzaWRlKSA9PiBlbGxpcHNlKDEwMCArIHNpZGUgKiAzNiwgODIsIDEwLCAxMCwga2l0LnNlY29uZCkpLFxuICAgICAgICBwYXRoKFxuICAgICAgICAgIFwiTTU2LDIwMCBDNTQsMTYwIDYyLDEwNCAxMDAsOTYgQzEzOCwxMDQgMTQ2LDE2MCAxNDQsMjAwIFpcIixcbiAgICAgICAgICBraXQuc2Vjb25kXG4gICAgICAgICksXG4gICAgICAgIGV5ZXMoa2l0LCAyMCwgMTE4KSxcbiAgICAgICAgbm9zZSgxMzIsIDYsIDQuNiwga2l0LmluayksXG4gICAgICAgIHNtaWxlKDE0MCwgNywgNSwga2l0LmluaylcbiAgICAgICksXG4gIH0sXG4gIGtvYWxhOiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbXCIjYzlkMmRjXCIsIFBFQVJMXSxcbiAgICAgIFtcIiNiOWMwY2NcIiwgXCIjZjRlNmNlXCJdLFxuICAgIF0sXG4gICAgZHJhdzogKGtpdCkgPT5cbiAgICAgIGZpZ3VyZShcbiAgICAgICAgcm91bmRFYXJzKGtpdC5ib2R5LCBraXQuc2Vjb25kLCA1OCwgNzIsIDI4KSxcbiAgICAgICAgdG9yc28oa2l0LmJvZHkpLFxuICAgICAgICBoZWFkKGtpdC5ib2R5LCA1NiwgNTIpLFxuICAgICAgICBiZWxseShraXQuc2Vjb25kKSxcbiAgICAgICAgZXllcyhraXQsIDMwLCA5NiksXG4gICAgICAgIGVsbGlwc2UoMTAwLCAxMDgsIDEyLCAxNywga2l0LmluayksXG4gICAgICAgIHNtaWxlKDEzMCwgOCwgNiwga2l0LmluaylcbiAgICAgICksXG4gIH0sXG4gIGJhdDoge1xuICAgIGNvbG9yczogW1xuICAgICAgW1wiIzhlN2ZiOFwiLCBcIiNmNGM3Y2ZcIl0sXG4gICAgICBbXCIjNmY3ZmE4XCIsIFwiI2RjZDNmNFwiXSxcbiAgICBdLFxuICAgIGRyYXc6IChraXQpID0+XG4gICAgICBmaWd1cmUoXG4gICAgICAgIGJvdGgoKHNpZGUpID0+IFtcbiAgICAgICAgICBibG9iKFxuICAgICAgICAgICAgWzEwMCArIHNpZGUgKiA1MiwgODAsIDEwMCArIHNpZGUgKiA1OCwgMjIsIDEwMCArIHNpZGUgKiAxOCwgNThdLFxuICAgICAgICAgICAga2l0LmJvZHksXG4gICAgICAgICAgICAxMlxuICAgICAgICAgICksXG4gICAgICAgICAgYmxvYihcbiAgICAgICAgICAgIFsxMDAgKyBzaWRlICogNDgsIDY4LCAxMDAgKyBzaWRlICogNTEsIDQwLCAxMDAgKyBzaWRlICogMzIsIDU4XSxcbiAgICAgICAgICAgIGtpdC5zZWNvbmQsXG4gICAgICAgICAgICA1XG4gICAgICAgICAgKSxcbiAgICAgICAgXSksXG4gICAgICAgIGJvdGgoKHNpZGUpID0+XG4gICAgICAgICAgYmxvYihcbiAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgMTAwICsgc2lkZSAqIDM2LFxuICAgICAgICAgICAgICAxNDAsXG4gICAgICAgICAgICAgIDEwMCArIHNpZGUgKiA5NixcbiAgICAgICAgICAgICAgMTEyLFxuICAgICAgICAgICAgICAxMDAgKyBzaWRlICogODYsXG4gICAgICAgICAgICAgIDE0NixcbiAgICAgICAgICAgICAgMTAwICsgc2lkZSAqIDk2LFxuICAgICAgICAgICAgICAxNzIsXG4gICAgICAgICAgICAgIDEwMCArIHNpZGUgKiA4MixcbiAgICAgICAgICAgICAgMjAwLFxuICAgICAgICAgICAgICAxMDAgKyBzaWRlICogMzYsXG4gICAgICAgICAgICAgIDIwMCxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBraXQuYm9keSxcbiAgICAgICAgICAgIDhcbiAgICAgICAgICApXG4gICAgICAgICksXG4gICAgICAgIHRvcnNvKGtpdC5ib2R5LCA0NCksXG4gICAgICAgIGhlYWQoa2l0LmJvZHksIDUwLCA0NiwgMTAwKSxcbiAgICAgICAgYmVsbHkoa2l0LnNlY29uZCwgMjIsIDE1NiksXG4gICAgICAgIGV5ZXMoa2l0LCAyMiwgOTYpLFxuICAgICAgICBub3NlKDEwOCwgNC40LCAzLjQsIGtpdC5pbmspLFxuICAgICAgICBzbWlsZSgxMTYsIDEwLCA3LCBraXQuaW5rKSxcbiAgICAgICAgYm90aCgoc2lkZSkgPT5cbiAgICAgICAgICBibG9iKFxuICAgICAgICAgICAgW1xuICAgICAgICAgICAgICAxMDAgKyBzaWRlICogNyAtIDIsXG4gICAgICAgICAgICAgIDEyMixcbiAgICAgICAgICAgICAgMTAwICsgc2lkZSAqIDcgKyAyLFxuICAgICAgICAgICAgICAxMjIsXG4gICAgICAgICAgICAgIDEwMCArIHNpZGUgKiA3LFxuICAgICAgICAgICAgICAxMjgsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgUEVBUkwsXG4gICAgICAgICAgICAyXG4gICAgICAgICAgKVxuICAgICAgICApXG4gICAgICApLFxuICB9LFxufSBzYXRpc2ZpZXMgUmVjb3JkPHN0cmluZywgRGVzaWduPjtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9tYXNjb3QvZmFtaWx5L3dpbGQudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL21hc2NvdC9mYW1pbHlcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL21hc2NvdC9mYW1pbHkvd2lsZC50c1wiO2ltcG9ydCB7XG4gIGJlbGx5LFxuICBibG9iLFxuICBib3RoLFxuICB0eXBlIERlc2lnbixcbiAgZWxsaXBzZSxcbiAgZXllcyxcbiAgZmlndXJlLFxuICBoZWFkLFxuICBsaW5lLFxuICBub3NlLFxuICBQRUFSTCxcbiAgcGF0aCxcbiAgcm91bmRFYXJzLFxuICBzbWlsZSxcbiAgdG9yc28sXG59IGZyb20gXCJAcmVwby9tYXNjb3Qva2l0XCI7XG5cbi8qKiBUaGUgd2lsZCBncmF6ZXJzIGFuZCBicm93c2VycywgZnJvbSB0aGUgZm9yZXN0IGVkZ2UgdG8gdGhlIHNhdmFubmEgYW5kIHRoZSByaXZlci4gKi9cbmV4cG9ydCBjb25zdCB3aWxkID0ge1xuICBhbm9hOiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbXCIjYjk4YTYzXCIsIFwiI2Y0ZTZjZVwiXSxcbiAgICAgIFtcIiNjODk0NjhcIiwgXCIjZWZkMmE2XCJdLFxuICAgIF0sXG4gICAgZHJhdzogKGtpdCkgPT5cbiAgICAgIGZpZ3VyZShcbiAgICAgICAgYm90aCgoc2lkZSkgPT5cbiAgICAgICAgICBibG9iKFxuICAgICAgICAgICAgWzEwMCArIHNpZGUgKiAxOCwgNTYsIDEwMCArIHNpZGUgKiAzMCwgNTQsIDEwMCArIHNpZGUgKiA0MCwgMTRdLFxuICAgICAgICAgICAga2l0LnNlY29uZCxcbiAgICAgICAgICAgIDhcbiAgICAgICAgICApXG4gICAgICAgICksXG4gICAgICAgIGJvdGgoKHNpZGUpID0+XG4gICAgICAgICAgZWxsaXBzZSgxMDAgKyBzaWRlICogNjIsIDgyLCAxOCwgOSwga2l0LmJvZHksIHNpZGUgKiAtMTgpXG4gICAgICAgICksXG4gICAgICAgIHRvcnNvKGtpdC5ib2R5KSxcbiAgICAgICAgaGVhZChraXQuYm9keSwgNTQsIDUyLCA5OCksXG4gICAgICAgIGJvdGgoKHNpZGUpID0+IGVsbGlwc2UoMTAwICsgc2lkZSAqIDM0LCAxMTYsIDksIDYsIGtpdC5zZWNvbmQpKSxcbiAgICAgICAgZWxsaXBzZSgxMDAsIDEyNiwgMjQsIDE2LCBraXQuc2Vjb25kKSxcbiAgICAgICAgZXllcyhraXQsIDI2LCA5NCksXG4gICAgICAgIGJvdGgoKHNpZGUpID0+IGVsbGlwc2UoMTAwICsgc2lkZSAqIDgsIDEyNiwgMi44LCAzLjYsIGtpdC5pbmspKVxuICAgICAgKSxcbiAgfSxcbiAgZGVlcjoge1xuICAgIGNvbG9yczogW1xuICAgICAgW1wiI2M4OTQ2OFwiLCBcIiNmNGU2Y2VcIl0sXG4gICAgICBbXCIjZDlhMzZhXCIsIFBFQVJMXSxcbiAgICBdLFxuICAgIGRyYXc6IChraXQpID0+XG4gICAgICBmaWd1cmUoXG4gICAgICAgIGJvdGgoKHNpZGUpID0+IFtcbiAgICAgICAgICBsaW5lKFxuICAgICAgICAgICAgYE0kezEwMCArIHNpZGUgKiAyMn0sNTggUSR7MTAwICsgc2lkZSAqIDMwfSwzMiAkezEwMCArIHNpZGUgKiA0Nn0sMTRgLFxuICAgICAgICAgICAga2l0LnNlY29uZCxcbiAgICAgICAgICAgIDcuNFxuICAgICAgICAgICksXG4gICAgICAgICAgbGluZShcbiAgICAgICAgICAgIGBNJHsxMDAgKyBzaWRlICogMjl9LDM4IEwkezEwMCArIHNpZGUgKiA1Mn0sMzZgLFxuICAgICAgICAgICAga2l0LnNlY29uZCxcbiAgICAgICAgICAgIDcuNFxuICAgICAgICAgICksXG4gICAgICAgICAgbGluZShcbiAgICAgICAgICAgIGBNJHsxMDAgKyBzaWRlICogMjV9LDUwIEwkezEwMCArIHNpZGUgKiAxMn0sMzBgLFxuICAgICAgICAgICAga2l0LnNlY29uZCxcbiAgICAgICAgICAgIDcuNFxuICAgICAgICAgICksXG4gICAgICAgIF0pLFxuICAgICAgICBib3RoKChzaWRlKSA9PiBbXG4gICAgICAgICAgZWxsaXBzZSgxMDAgKyBzaWRlICogNjIsIDgyLCAyMCwgMTAsIGtpdC5ib2R5LCBzaWRlICogLTI0KSxcbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiA2MiwgODIsIDExLCA1LCBraXQuc2Vjb25kLCBzaWRlICogLTI0KSxcbiAgICAgICAgXSksXG4gICAgICAgIHRvcnNvKGtpdC5ib2R5KSxcbiAgICAgICAgaGVhZChraXQuYm9keSwgNTQsIDUyLCA5OCksXG4gICAgICAgIGJvdGgoKHNpZGUpID0+IFtcbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiAxOCwgNjIsIDMuNiwgMy42LCBraXQuc2Vjb25kKSxcbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiAzMiwgNzAsIDMsIDMsIGtpdC5zZWNvbmQpLFxuICAgICAgICBdKSxcbiAgICAgICAgZWxsaXBzZSgxMDAsIDEyMiwgMjMsIDE4LCBraXQuc2Vjb25kKSxcbiAgICAgICAgYmVsbHkoa2l0LnNlY29uZCksXG4gICAgICAgIGV5ZXMoa2l0LCAyNywgOTQpLFxuICAgICAgICBub3NlKDExNCwgNy40LCA1LjQsIGtpdC5pbmspLFxuICAgICAgICBzbWlsZSgxMjQsIDcsIDYsIGtpdC5pbmspXG4gICAgICApLFxuICB9LFxuICBnaXJhZmZlOiB7XG4gICAgY29sb3JzOiBbXG4gICAgICBbXCIjZjdkNzc0XCIsIFwiI2M5NzgzYVwiXSxcbiAgICAgIFtcIiNmM2U3YTZcIiwgXCIjZDk4MjRhXCJdLFxuICAgIF0sXG4gICAgZHJhdzogKGtpdCkgPT5cbiAgICAgIGZpZ3VyZShcbiAgICAgICAgYm90aCgoc2lkZSkgPT4gW1xuICAgICAgICAgIGxpbmUoYE0kezEwMCArIHNpZGUgKiAxNn0sNTIgTCR7MTAwICsgc2lkZSAqIDIwfSwyOGAsIGtpdC5ib2R5LCA5KSxcbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiAyMCwgMjQsIDgsIDgsIGtpdC5zZWNvbmQpLFxuICAgICAgICBdKSxcbiAgICAgICAgYm90aCgoc2lkZSkgPT5cbiAgICAgICAgICBlbGxpcHNlKDEwMCArIHNpZGUgKiA1NCwgNzAsIDE3LCA5LCBraXQuYm9keSwgc2lkZSAqIC0yMilcbiAgICAgICAgKSxcbiAgICAgICAgcGF0aChcbiAgICAgICAgICBcIk02OCwyMDAgQzcwLDE3MCA3NCwxNDAgNzgsMTE2IEwxMjIsMTE2IEMxMjYsMTQwIDEzMCwxNzAgMTMyLDIwMCBaXCIsXG4gICAgICAgICAga2l0LmJvZHlcbiAgICAgICAgKSxcbiAgICAgICAgaGVhZChraXQuYm9keSwgNDYsIDQyLCA4NCksXG4gICAgICAgIGVsbGlwc2UoODYsIDE1MiwgOSwgMTEsIGtpdC5zZWNvbmQpLFxuICAgICAgICBlbGxpcHNlKDExMywgMTcwLCAxMCwgMTIsIGtpdC5zZWNvbmQpLFxuICAgICAgICBlbGxpcHNlKDEwNiwgMTM4LCA3LCA4LCBraXQuc2Vjb25kKSxcbiAgICAgICAgZWxsaXBzZSg4NCwgMTg2LCA4LCA5LCBraXQuc2Vjb25kKSxcbiAgICAgICAgZWxsaXBzZSg3MCwgNjIsIDcsIDYsIGtpdC5zZWNvbmQpLFxuICAgICAgICBlbGxpcHNlKDEyOCwgNTYsIDYsIDUsIGtpdC5zZWNvbmQpLFxuICAgICAgICBlbGxpcHNlKDEwMCwgMTA0LCAyOSwgMjAsIFwiI2Y0ZTZjZVwiKSxcbiAgICAgICAgZXllcyhraXQsIDI1LCA3OCksXG4gICAgICAgIGJvdGgoKHNpZGUpID0+IGVsbGlwc2UoMTAwICsgc2lkZSAqIDgsIDEwMiwgMi42LCAzLjQsIGtpdC5pbmspKSxcbiAgICAgICAgc21pbGUoMTEwLCA4LCA2LCBraXQuaW5rKVxuICAgICAgKSxcbiAgfSxcbiAgemVicmE6IHtcbiAgICBjb2xvcnM6IFtcbiAgICAgIFtQRUFSTCwgUEVBUkxdLFxuICAgICAgW1wiI2Y0ZTZjZVwiLCBcIiNmNGU2Y2VcIl0sXG4gICAgXSxcbiAgICBkcmF3OiAoa2l0KSA9PlxuICAgICAgZmlndXJlKFxuICAgICAgICBib3RoKChzaWRlKSA9PiBbXG4gICAgICAgICAgYmxvYihcbiAgICAgICAgICAgIFsxMDAgKyBzaWRlICogNDQsIDYwLCAxMDAgKyBzaWRlICogNDgsIDI2LCAxMDAgKyBzaWRlICogMjQsIDQ4XSxcbiAgICAgICAgICAgIGtpdC5ib2R5LFxuICAgICAgICAgICAgMTJcbiAgICAgICAgICApLFxuICAgICAgICAgIGJsb2IoXG4gICAgICAgICAgICBbMTAwICsgc2lkZSAqIDQyLCA1MCwgMTAwICsgc2lkZSAqIDQ0LCAzNiwgMTAwICsgc2lkZSAqIDM0LCA0Nl0sXG4gICAgICAgICAgICBraXQuaW5rLFxuICAgICAgICAgICAgNFxuICAgICAgICAgICksXG4gICAgICAgIF0pLFxuICAgICAgICBibG9iKFs5MiwgNTAsIDk2LCAyMiwgMTA4LCA1MF0sIGtpdC5pbmssIDgpLFxuICAgICAgICB0b3JzbyhraXQuYm9keSksXG4gICAgICAgIGhlYWQoa2l0LmJvZHksIDUwLCA1NCwgOTgpLFxuICAgICAgICBibG9iKFsxMDAsIDU2LCA5NiwgNzQsIDEwNCwgNzRdLCBraXQuaW5rLCAzLjQpLFxuICAgICAgICBib3RoKChzaWRlKSA9PiBbXG4gICAgICAgICAgYmxvYihcbiAgICAgICAgICAgIFsxMDAgKyBzaWRlICogNTAsIDgwLCAxMDAgKyBzaWRlICogMzAsIDg0LCAxMDAgKyBzaWRlICogNDksIDkwXSxcbiAgICAgICAgICAgIGtpdC5pbmssXG4gICAgICAgICAgICAzLjRcbiAgICAgICAgICApLFxuICAgICAgICAgIGJsb2IoXG4gICAgICAgICAgICBbMTAwICsgc2lkZSAqIDUyLCAxMDAsIDEwMCArIHNpZGUgKiAzNCwgMTAyLCAxMDAgKyBzaWRlICogNTAsIDEwOF0sXG4gICAgICAgICAgICBraXQuaW5rLFxuICAgICAgICAgICAgMy40XG4gICAgICAgICAgKSxcbiAgICAgICAgICBibG9iKFxuICAgICAgICAgICAgWzEwMCArIHNpZGUgKiAyMiwgNTgsIDEwMCArIHNpZGUgKiAxOCwgNzIsIDEwMCArIHNpZGUgKiAyNywgNzBdLFxuICAgICAgICAgICAga2l0LmluayxcbiAgICAgICAgICAgIDMuMlxuICAgICAgICAgICksXG4gICAgICAgICAgYmxvYihcbiAgICAgICAgICAgIFsxMDAgKyBzaWRlICogNTgsIDE1NiwgMTAwICsgc2lkZSAqIDM4LCAxNjIsIDEwMCArIHNpZGUgKiA2MCwgMTY4XSxcbiAgICAgICAgICAgIGtpdC5pbmssXG4gICAgICAgICAgICAzLjRcbiAgICAgICAgICApLFxuICAgICAgICAgIGJsb2IoXG4gICAgICAgICAgICBbMTAwICsgc2lkZSAqIDYwLCAxODAsIDEwMCArIHNpZGUgKiA0MCwgMTg2LCAxMDAgKyBzaWRlICogNjAsIDE5Ml0sXG4gICAgICAgICAgICBraXQuaW5rLFxuICAgICAgICAgICAgMy40XG4gICAgICAgICAgKSxcbiAgICAgICAgXSksXG4gICAgICAgIGVsbGlwc2UoMTAwLCAxMzAsIDMwLCAyMCwga2l0LmluayksXG4gICAgICAgIGJvdGgoKHNpZGUpID0+IGVsbGlwc2UoMTAwICsgc2lkZSAqIDksIDEzMCwgMi44LCAzLjYsIGtpdC5ib2R5KSksXG4gICAgICAgIGV5ZXMoa2l0LCAyNCwgOTQpXG4gICAgICApLFxuICB9LFxuICBoaXBwbzoge1xuICAgIGNvbG9yczogW1xuICAgICAgW1wiI2I5YTdkNlwiLCBcIiNmNGM3Y2ZcIl0sXG4gICAgICBbXCIjYWFiOGQ4XCIsIFwiI2Y2YzNhNlwiXSxcbiAgICAgIFtcIiNjOWI2YzhcIiwgXCIjZjRjN2NmXCJdLFxuICAgIF0sXG4gICAgZHJhdzogKGtpdCkgPT5cbiAgICAgIGZpZ3VyZShcbiAgICAgICAgcm91bmRFYXJzKGtpdC5ib2R5LCBraXQuc2Vjb25kLCA0MCwgNDgsIDEyKSxcbiAgICAgICAgdG9yc28oa2l0LmJvZHksIDYyKSxcbiAgICAgICAgaGVhZChraXQuYm9keSwgNTQsIDQ0LCA4OCksXG4gICAgICAgIGJvdGgoKHNpZGUpID0+XG4gICAgICAgICAgcGF0aChcbiAgICAgICAgICAgIGBNJHsxMDAgKyBzaWRlICogMTYgLSA2fSwxNDYgTCR7MTAwICsgc2lkZSAqIDE2ICsgNn0sMTQ2IEwkezEwMCArIHNpZGUgKiAxNiArIDV9LDE1OCBMJHsxMDAgKyBzaWRlICogMTYgLSA1fSwxNTggWmAsXG4gICAgICAgICAgICBQRUFSTFxuICAgICAgICAgIClcbiAgICAgICAgKSxcbiAgICAgICAgZWxsaXBzZSgxMDAsIDEyMiwgNTYsIDMyLCBraXQuYm9keSksXG4gICAgICAgIGJvdGgoKHNpZGUpID0+IGVsbGlwc2UoMTAwICsgc2lkZSAqIDIwLCAxMTAsIDUsIDYuNCwga2l0LmluaykpLFxuICAgICAgICBleWVzKGtpdCwgMjYsIDgyKSxcbiAgICAgICAgbGluZShcIk02NiwxMzggUTEwMCwxNTAgMTM0LDEzOFwiLCBraXQuaW5rLCA0LjQpXG4gICAgICApLFxuICB9LFxuICByaGlubzoge1xuICAgIGNvbG9yczogW1xuICAgICAgW1wiI2M5ZDJkY1wiLCBQRUFSTF0sXG4gICAgICBbXCIjYjljMGNjXCIsIFwiI2Y0ZTZjZVwiXSxcbiAgICBdLFxuICAgIGRyYXc6IChraXQpID0+XG4gICAgICBmaWd1cmUoXG4gICAgICAgIGJvdGgoKHNpZGUpID0+XG4gICAgICAgICAgYmxvYihcbiAgICAgICAgICAgIFsxMDAgKyBzaWRlICogNDQsIDYyLCAxMDAgKyBzaWRlICogNTIsIDM2LCAxMDAgKyBzaWRlICogMzAsIDU0XSxcbiAgICAgICAgICAgIGtpdC5ib2R5LFxuICAgICAgICAgICAgMTBcbiAgICAgICAgICApXG4gICAgICAgICksXG4gICAgICAgIHRvcnNvKGtpdC5ib2R5LCA2MCksXG4gICAgICAgIGhlYWQoa2l0LmJvZHksIDYwLCA1NCwgMTAwKSxcbiAgICAgICAgYmxvYihbOTAsIDExNiwgMTEwLCAxMTYsIDEwMCwgNzhdLCBraXQuc2Vjb25kLCA4KSxcbiAgICAgICAgYmxvYihbOTQsIDgwLCAxMDYsIDgwLCAxMDAsIDYyXSwga2l0LnNlY29uZCwgNiksXG4gICAgICAgIGV5ZXMoa2l0LCAzNCwgOTYpLFxuICAgICAgICBib3RoKChzaWRlKSA9PiBlbGxpcHNlKDEwMCArIHNpZGUgKiAxNCwgMTMyLCAzLjQsIDQuMiwga2l0LmluaykpXG4gICAgICApLFxuICB9LFxuICBlbGVwaGFudDoge1xuICAgIGNvbG9yczogW1xuICAgICAgW1wiI2M5ZDJkY1wiLCBcIiNmNGM3Y2ZcIl0sXG4gICAgICBbXCIjY2ZlNmY3XCIsIFBFQVJMXSxcbiAgICAgIFtcIiNiOWMwY2NcIiwgUEVBUkxdLFxuICAgIF0sXG4gICAgZHJhdzogKGtpdCkgPT5cbiAgICAgIGZpZ3VyZShcbiAgICAgICAgYm90aCgoc2lkZSkgPT4gW1xuICAgICAgICAgIGVsbGlwc2UoMTAwICsgc2lkZSAqIDYyLCA5NiwgNDAsIDQ2LCBraXQuYm9keSksXG4gICAgICAgICAgZWxsaXBzZSgxMDAgKyBzaWRlICogNjQsIDk4LCAyNCwgMzAsIGtpdC5zZWNvbmQpLFxuICAgICAgICBdKSxcbiAgICAgICAgdG9yc28oa2l0LmJvZHksIDUwKSxcbiAgICAgICAgaGVhZChraXQuYm9keSwgNTAsIDUyLCA5NiksXG4gICAgICAgIGJlbGx5KGtpdC5zZWNvbmQsIDM2LCAxMzYpLFxuICAgICAgICBib3RoKChzaWRlKSA9PlxuICAgICAgICAgIGVsbGlwc2UoMTAwICsgc2lkZSAqIDI0LCAxMzIsIDUuNiwgMTEsIFBFQVJMLCBzaWRlICogLTEyKVxuICAgICAgICApLFxuICAgICAgICBwYXRoKFxuICAgICAgICAgIFwiTTg0LDExMiBDODQsMTUwIDg4LDE3OCAxMDAsMTkwIEMxMTIsMTc4IDExNiwxNTAgMTE2LDExMiBaXCIsXG4gICAgICAgICAga2l0LmJvZHlcbiAgICAgICAgKSxcbiAgICAgICAgZXllcyhraXQsIDI2LCA5MClcbiAgICAgICksXG4gIH0sXG59IHNhdGlzZmllcyBSZWNvcmQ8c3RyaW5nLCBEZXNpZ24+O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL21hc2NvdC9hbmltYWwudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL21hc2NvdFwiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvbWFzY290L2FuaW1hbC50c1wiO2ltcG9ydCB7IGJpcmQgfSBmcm9tIFwiQHJlcG8vbWFzY290L2ZhbWlseS9iaXJkXCI7XG5pbXBvcnQgeyBidWcgfSBmcm9tIFwiQHJlcG8vbWFzY290L2ZhbWlseS9idWdcIjtcbmltcG9ydCB7IGNhcm5pdm9yZSB9IGZyb20gXCJAcmVwby9tYXNjb3QvZmFtaWx5L2Nhcm5pdm9yZVwiO1xuaW1wb3J0IHsgZmFybSB9IGZyb20gXCJAcmVwby9tYXNjb3QvZmFtaWx5L2Zhcm1cIjtcbmltcG9ydCB7IG1hcmluZSB9IGZyb20gXCJAcmVwby9tYXNjb3QvZmFtaWx5L21hcmluZVwiO1xuaW1wb3J0IHsgcHJpbWF0ZSB9IGZyb20gXCJAcmVwby9tYXNjb3QvZmFtaWx5L3ByaW1hdGVcIjtcbmltcG9ydCB7IHJlcHRpbGUgfSBmcm9tIFwiQHJlcG8vbWFzY290L2ZhbWlseS9yZXB0aWxlXCI7XG5pbXBvcnQgeyBzbWFsbCB9IGZyb20gXCJAcmVwby9tYXNjb3QvZmFtaWx5L3NtYWxsXCI7XG5pbXBvcnQgeyB3aWxkIH0gZnJvbSBcIkByZXBvL21hc2NvdC9mYW1pbHkvd2lsZFwiO1xuaW1wb3J0IHR5cGUgeyBEZXNpZ24gfSBmcm9tIFwiQHJlcG8vbWFzY290L2tpdFwiO1xuaW1wb3J0IHsgU2NoZW1hIH0gZnJvbSBcImVmZmVjdFwiO1xuXG4vKiogRXZlcnkgYW5pbWFsIGJ5IG5hbWUsIGluIHRoZSBvcmRlciB0aGF0IGEgc2VlZCBwaWNrcyBmcm9tLiAqL1xuZXhwb3J0IGNvbnN0IEFuaW1hbCA9IFNjaGVtYS5MaXRlcmFscyhbXG4gIFwiY2F0XCIsXG4gIFwiYmVhclwiLFxuICBcInJhYmJpdFwiLFxuICBcInNoZWVwXCIsXG4gIFwiZm94XCIsXG4gIFwicGFuZGFcIixcbiAgXCJrb2FsYVwiLFxuICBcImZyb2dcIixcbiAgXCJjaGlja2VuXCIsXG4gIFwib3dsXCIsXG4gIFwicGVuZ3VpblwiLFxuICBcImhhbXN0ZXJcIixcbiAgXCJtb3VzZVwiLFxuICBcImNvd1wiLFxuICBcInRpZ2VyXCIsXG4gIFwibGlvblwiLFxuICBcImJlZVwiLFxuICBcInNlYWxcIixcbiAgXCJheG9sb3RsXCIsXG4gIFwid2hhbGVcIixcbiAgXCJvY3RvcHVzXCIsXG4gIFwia29tb2RvXCIsXG4gIFwib3Jhbmd1dGFuXCIsXG4gIFwidGFyc2llclwiLFxuICBcImVsZXBoYW50XCIsXG4gIFwicmhpbm9cIixcbiAgXCJhbm9hXCIsXG4gIFwidHVydGxlXCIsXG4gIFwiZG9nXCIsXG4gIFwicGlnXCIsXG4gIFwibW9ua2V5XCIsXG4gIFwicHJvYm9zY2lzXCIsXG4gIFwiZGVlclwiLFxuICBcImdpcmFmZmVcIixcbiAgXCJ6ZWJyYVwiLFxuICBcImhpcHBvXCIsXG4gIFwiaG9yc2VcIixcbiAgXCJnb2F0XCIsXG4gIFwiZHVja1wiLFxuICBcImNvY2thdG9vXCIsXG4gIFwiaG9ybmJpbGxcIixcbiAgXCJlYWdsZVwiLFxuICBcInBhcnJvdFwiLFxuICBcImJhdFwiLFxuICBcInBvcmN1cGluZVwiLFxuICBcImNpdmV0XCIsXG4gIFwic3F1aXJyZWxcIixcbiAgXCJjcmFiXCIsXG4gIFwiamVsbHlmaXNoXCIsXG4gIFwicHVmZmVyZmlzaFwiLFxuICBcInNuYWlsXCIsXG4gIFwiYmVldGxlXCIsXG4gIFwiY3JvY29kaWxlXCIsXG4gIFwicmFjY29vblwiLFxuICBcImZsYW1pbmdvXCIsXG4gIFwicGVhY29ja1wiLFxuICBcImNsb3duZmlzaFwiLFxuICBcImFscGFjYVwiLFxuICBcImRyYWdvbmZseVwiLFxuICBcInNwaWRlclwiLFxuICBcImNhc3Nvd2FyeVwiLFxuICBcImJ1dHRlcmZseVwiLFxuICBcInN0YXJmaXNoXCIsXG4gIFwid2FscnVzXCIsXG4gIFwic25ha2VcIixcbl0pO1xuXG4vKiogVGhlIHBhbGV0dGVzIGFuZCB0aGUgZHJhd2luZyBvZiBldmVyeSBhbmltYWwsIGdhdGhlcmVkIGZyb20gaXRzIGZhbWlseS4gKi9cbmV4cG9ydCBjb25zdCBERVNJR05TOiBSZWNvcmQ8dHlwZW9mIEFuaW1hbC5UeXBlLCBEZXNpZ24+ID0ge1xuICAuLi5iaXJkLFxuICAuLi5idWcsXG4gIC4uLmNhcm5pdm9yZSxcbiAgLi4uZmFybSxcbiAgLi4ubWFyaW5lLFxuICAuLi5wcmltYXRlLFxuICAuLi5yZXB0aWxlLFxuICAuLi5zbWFsbCxcbiAgLi4ud2lsZCxcbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvbWFzY290L2dyb3VuZC50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvbWFzY290XCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9tYXNjb3QvZ3JvdW5kLnRzXCI7aW1wb3J0IHsgQXJyYXkgYXMgQXJyLCBTY2hlbWEgfSBmcm9tIFwiZWZmZWN0XCI7XG5cbi8qKlxuICogVGhlIGdyb3VuZHMgdGhhdCBhbiBhbmltYWwgY2FuIHN0YW5kIG9uLCBlYWNoIGFzIHNpeCBsb3dlci1jYXNlIGhleGFkZWNpbWFsXG4gKiBkaWdpdHMgd2l0aG91dCB0aGUgYCNgLiBBIGNvZGUgd2l0aCBhbnkgb3RoZXIgY29sb3VyIGlzIG5vdCBhIG1hc2NvdC5cbiAqL1xuZXhwb3J0IGNvbnN0IEdyb3VuZCA9IFNjaGVtYS5MaXRlcmFscyhbXG4gIFwiYjk2MjRiXCIsXG4gIFwiMmY3YjZlXCIsXG4gIFwiNmQ0Yjc4XCIsXG4gIFwiMjQzZTY2XCIsXG4gIFwiNzA3YTUyXCIsXG4gIFwiYjg4YTMzXCIsXG4gIFwiNTY3MDhjXCIsXG4gIFwiMmU1YjQ1XCIsXG4gIFwiYjQ1YzZlXCIsXG4gIFwiNGI0ZmIwXCIsXG4gIFwiOGU5YWQ2XCIsXG4gIFwiNWU4ZjljXCIsXG4gIFwiOGM1YThmXCIsXG4gIFwiM2Y2ZmEwXCIsXG4gIFwiN2M5YTZlXCIsXG4gIFwiYzc3ODhhXCIsXG4gIFwiZjRlNmNlXCIsXG4gIFwiY2ZlNmY3XCIsXG4gIFwiZjdkNzc0XCIsXG4gIFwiZjRjN2NmXCIsXG4gIFwiZGRlYmI1XCIsXG4gIFwiZGNkM2Y0XCIsXG5dKTtcblxuLyoqIEhvdyBtdWNoIGJyaWdodGVyIG9yIGRhcmtlciB0aGFuIGl0cyBncm91bmQgYW4gYW5pbWFsJ3MgYm9keSBtdXN0IGJlLiAqL1xuY29uc3QgU1RBTkRTX09VVCA9IDIuNDtcblxuLyoqIFRoZSByZWxhdGl2ZSBsdW1pbmFuY2Ugb2YgYSBjb2xvdXIsIGZyb20gYCNycmdnYmJgIG9yIGBycmdnYmJgLiAqL1xuZnVuY3Rpb24gbHVtaW5hbmNlKGNvbG9yOiBzdHJpbmcpIHtcbiAgY29uc3QgZGlnaXRzID0gY29sb3IucmVwbGFjZShcIiNcIiwgXCJcIik7XG4gIGNvbnN0IGNoYW5uZWwgPSAoc3RhcnQ6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gTnVtYmVyLnBhcnNlSW50KGRpZ2l0cy5zbGljZShzdGFydCwgc3RhcnQgKyAyKSwgMTYpIC8gMjU1O1xuICAgIHJldHVybiB2YWx1ZSA8PSAwLjA0MF80NSA/IHZhbHVlIC8gMTIuOTIgOiAoKHZhbHVlICsgMC4wNTUpIC8gMS4wNTUpICoqIDIuNDtcbiAgfTtcbiAgcmV0dXJuIDAuMjEyNiAqIGNoYW5uZWwoMCkgKyAwLjcxNTIgKiBjaGFubmVsKDIpICsgMC4wNzIyICogY2hhbm5lbCg0KTtcbn1cblxuLyoqIFRoZSBjb250cmFzdCByYXRpbyBiZXR3ZWVuIHR3byBjb2xvdXJzLCBmcm9tIDEgdXAgdG8gMjEuICovXG5leHBvcnQgZnVuY3Rpb24gY29udHJhc3QoZmlyc3Q6IHN0cmluZywgc2Vjb25kOiBzdHJpbmcpIHtcbiAgY29uc3QgYSA9IGx1bWluYW5jZShmaXJzdCk7XG4gIGNvbnN0IGIgPSBsdW1pbmFuY2Uoc2Vjb25kKTtcbiAgcmV0dXJuIChNYXRoLm1heChhLCBiKSArIDAuMDUpIC8gKE1hdGgubWluKGEsIGIpICsgMC4wNSk7XG59XG5cbi8qKiBUaGUgZ3JvdW5kcyB0aGF0IGEgYm9keSBjb2xvdXIgc3RhbmRzIG91dCBmcm9tLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdyb3VuZHNGb3IoYm9keTogc3RyaW5nKSB7XG4gIHJldHVybiBBcnIuZmlsdGVyKFxuICAgIEdyb3VuZC5saXRlcmFscyxcbiAgICAoZ3JvdW5kKSA9PiBjb250cmFzdChib2R5LCBncm91bmQpID49IFNUQU5EU19PVVRcbiAgKTtcbn1cbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9tYXNjb3QvcG9zZS50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvbWFzY290XCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9tYXNjb3QvcG9zZS50c1wiO2ltcG9ydCB7IFJlY29yZCwgU2NoZW1hIH0gZnJvbSBcImVmZmVjdFwiO1xuXG4vKipcbiAqIFdoZXJlIGFuIGFuaW1hbCBzdGFuZHMuIEl0IHJhcmVseSBzdGFuZHMgaW4gdGhlIG1pZGRsZTogaXQgbGVhbnMgaW4gZnJvbSBhXG4gKiBsb3dlciBjb3JuZXIsIG9yIHBlZWtzIG92ZXIgdGhlIGJvdHRvbSBlZGdlLiBBIHBvc2UgaXMgYSB0dXJuIGluIGRlZ3JlZXMsIGFcbiAqIHNjYWxlLCBhbmQgYSBzaGlmdCBmcm9tIHRoZSBtaWRkbGUgb2YgdGhlIGJvdHRvbSBlZGdlLCBwbHVzIGhvdyBmYXIgdGhlIGV5ZXNcbiAqIGxvb2sgdG8gdGhlIHNpZGUuXG4gKi9cbmV4cG9ydCBjb25zdCBQT1NFUyA9IHtcbiAgcmlnaHQ6IHsgbG9vazogLTIuNiwgc2l6ZTogMS4xNiwgdHVybjogLTEwLCB4OiAzNCwgeTogMTggfSxcbiAgbGVmdDogeyBsb29rOiAyLjYsIHNpemU6IDEuMTYsIHR1cm46IDEwLCB4OiAtMzQsIHk6IDE4IH0sXG4gIGNlbnRlcjogeyBsb29rOiAwLCBzaXplOiAxLjA0LCB0dXJuOiAwLCB4OiAwLCB5OiA0IH0sXG4gIHBlZWs6IHsgbG9vazogMCwgc2l6ZTogMS4xMiwgdHVybjogMCwgeDogMCwgeTogNTQgfSxcbiAgXCJwZWVrLXJpZ2h0XCI6IHsgbG9vazogLTIuNiwgc2l6ZTogMS4xNCwgdHVybjogLTE0LCB4OiA0NCwgeTogNDYgfSxcbiAgXCJwZWVrLWxlZnRcIjogeyBsb29rOiAyLjYsIHNpemU6IDEuMTQsIHR1cm46IDE0LCB4OiAtNDQsIHk6IDQ2IH0sXG59O1xuXG4vKiogVGhlIG5hbWUgb2YgYSBwb3NlLiAqL1xuZXhwb3J0IGNvbnN0IFBvc2UgPSBTY2hlbWEuTGl0ZXJhbHMoUmVjb3JkLmtleXMoUE9TRVMpKTtcblxuLyoqIFRoZSBwb3NlcyB0aGF0IGEgc2VlZCBwaWNrcyBmcm9tLCBpbiBvcmRlci4gVGhlIGxlYW5pbmcgcG9zZXMgY29tZSB0d2ljZS4gKi9cbmV4cG9ydCBjb25zdCBQT1NFX09SREVSID0gW1xuICBcInJpZ2h0XCIsXG4gIFwibGVmdFwiLFxuICBcInJpZ2h0XCIsXG4gIFwibGVmdFwiLFxuICBcImNlbnRlclwiLFxuICBcInBlZWstcmlnaHRcIixcbiAgXCJwZWVrLWxlZnRcIixcbiAgXCJwZWVrXCIsXG5dIHNhdGlzZmllcyByZWFkb25seSAodHlwZW9mIFBvc2UuVHlwZSlbXTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9tYXNjb3QvY29kZS50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvbWFzY290XCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9tYXNjb3QvY29kZS50c1wiO2ltcG9ydCB7IEFuaW1hbCwgREVTSUdOUyB9IGZyb20gXCJAcmVwby9tYXNjb3QvYW5pbWFsXCI7XG5pbXBvcnQgeyBHcm91bmQgfSBmcm9tIFwiQHJlcG8vbWFzY290L2dyb3VuZFwiO1xuaW1wb3J0IHsgRXllcyB9IGZyb20gXCJAcmVwby9tYXNjb3Qva2l0XCI7XG5pbXBvcnQgeyBQb3NlIH0gZnJvbSBcIkByZXBvL21hc2NvdC9wb3NlXCI7XG5pbXBvcnQgeyBTY2hlbWEsIFNjaGVtYVBhcnNlciwgU2NoZW1hVHJhbnNmb3JtYXRpb24gfSBmcm9tIFwiZWZmZWN0XCI7XG5cbi8qKlxuICogT25lIG1hc2NvdDogd2hpY2ggYW5pbWFsLCBpbiB3aGljaCBvZiBpdHMgcGFsZXR0ZXMsIG9uIHdoaWNoIGdyb3VuZCwgaW4gd2hpY2hcbiAqIHBvc2UsIGFuZCB3aXRoIHdoaWNoIGV5ZXMuIFRoZSBwYWxldHRlIGlzIHRoZSBpbmRleCBpbnRvIHRoZSBhbmltYWwncyBvd25cbiAqIHBhbGV0dGVzLCBzbyBpdCBtdXN0IGV4aXN0LlxuICovXG5leHBvcnQgY29uc3QgTWFzY290ID0gU2NoZW1hLlN0cnVjdCh7XG4gIGFuaW1hbDogQW5pbWFsLFxuICBleWVzOiBFeWVzLFxuICBncm91bmQ6IEdyb3VuZCxcbiAgcGFsZXR0ZTogU2NoZW1hLkludC5jaGVjayhTY2hlbWEuaXNHcmVhdGVyVGhhbk9yRXF1YWxUbygwKSksXG4gIHBvc2U6IFBvc2UsXG59KS5jaGVjayhcbiAgU2NoZW1hLm1ha2VGaWx0ZXIoKHsgYW5pbWFsLCBwYWxldHRlIH0pID0+XG4gICAgcGFsZXR0ZSA8IERFU0lHTlNbYW5pbWFsXS5jb2xvcnMubGVuZ3RoXG4gICAgICA/IHVuZGVmaW5lZFxuICAgICAgOiB7IGlzc3VlOiBgJHthbmltYWx9IGhhcyBubyBwYWxldHRlICR7cGFsZXR0ZX1gLCBwYXRoOiBbXCJwYWxldHRlXCJdIH1cbiAgKVxuKTtcblxuLyoqIFRoZSBpbmRleCBvZiBhIHBhbGV0dGUsIHNwZWxsZWQgYXMgaXQgaXMgd3JpdHRlbiBpbiBhIGNvZGU6IG5vIHNpZ24sIG5vIGxlYWRpbmcgemVyby4gKi9cbmNvbnN0IFBhbGV0dGVEaWdpdHMgPSBTY2hlbWEuU3RyaW5nLmNoZWNrKFxuICBTY2hlbWEuaXNQYXR0ZXJuKC9eKD86MHxbMS05XVswLTldKikkL3UpXG4pLnBpcGUoXG4gIFNjaGVtYS5kZWNvZGVUbyhcbiAgICBTY2hlbWEuSW50LFxuICAgIFNjaGVtYVRyYW5zZm9ybWF0aW9uLnRyYW5zZm9ybSh7IGRlY29kZTogTnVtYmVyLCBlbmNvZGU6IFN0cmluZyB9KVxuICApXG4pO1xuXG4vKipcbiAqIFRoZSB0ZXh0IG9mIGEgbWFzY290IHJlYWQgYnkgaXRzIHBhcnRzOiB0aGUgdGVtcGxhdGUgbGl0ZXJhbCBvZiB0aGUgY29kZSxcbiAqIGRlY29kZWQgaW50byBhIGBNYXNjb3RgLiBBIHRleHQgdGhhdCBuYW1lcyBubyBwYXJ0IG9mIGEgbWFzY290IGZhaWxzLlxuICovXG5jb25zdCBNYXNjb3RUZXh0ID0gU2NoZW1hLlRlbXBsYXRlTGl0ZXJhbFBhcnNlcihbXG4gIEFuaW1hbCxcbiAgXCIuXCIsXG4gIFBhbGV0dGVEaWdpdHMsXG4gIFwiLlwiLFxuICBHcm91bmQsXG4gIFwiLlwiLFxuICBQb3NlLFxuICBcIi5cIixcbiAgRXllcyxcbl0pLnBpcGUoXG4gIFNjaGVtYS5kZWNvZGVUbyhcbiAgICBNYXNjb3QsXG4gICAgU2NoZW1hVHJhbnNmb3JtYXRpb24udHJhbnNmb3JtKHtcbiAgICAgIGRlY29kZTogKFthbmltYWwsICwgcGFsZXR0ZSwgLCBncm91bmQsICwgcG9zZSwgLCBleWVzXSkgPT4gKHtcbiAgICAgICAgYW5pbWFsLFxuICAgICAgICBleWVzLFxuICAgICAgICBncm91bmQsXG4gICAgICAgIHBhbGV0dGUsXG4gICAgICAgIHBvc2UsXG4gICAgICB9KSxcbiAgICAgIGVuY29kZTogKHsgYW5pbWFsLCBleWVzLCBncm91bmQsIHBhbGV0dGUsIHBvc2UgfSkgPT5cbiAgICAgICAgW2FuaW1hbCwgXCIuXCIsIHBhbGV0dGUsIFwiLlwiLCBncm91bmQsIFwiLlwiLCBwb3NlLCBcIi5cIiwgZXllc10gYXMgY29uc3QsXG4gICAgfSlcbiAgKVxuKTtcblxuLyoqXG4gKiBBIG1hc2NvdCBhcyB0aGUgdGV4dCB0aGF0IGlzIHN0b3JlZCwgYGFuaW1hbC5wYWxldHRlLmdyb3VuZC5wb3NlLmV5ZXNgLCBmb3JcbiAqIGV4YW1wbGUgYGNhdC4wLjI0M2U2Ni5yaWdodC5vcGVuYC4gRGVjb2RlZCwgaXQgaXMgYSBgTWFzY290YDsgZW5jb2RlZCwgaXQgaXNcbiAqIHRoYXQgdGV4dCBhcyBhIHBsYWluIHN0cmluZywgd2hpY2ggaXMgd2hhdCB0aGUgZGF0YWJhc2Ugc3RvcmVzLiBEZWNvZGluZyB0ZXh0XG4gKiB0aGF0IG5hbWVzIG5vIG1hc2NvdCBmYWlsczsgbm90aGluZyBpcyBndWVzc2VkLlxuICovXG5leHBvcnQgY29uc3QgTWFzY290Q29kZSA9IFNjaGVtYS5TdHJpbmcucGlwZShcbiAgU2NoZW1hLmRlY29kZVRvKFxuICAgIE1hc2NvdCxcbiAgICBTY2hlbWFUcmFuc2Zvcm1hdGlvbi50cmFuc2Zvcm1FZmZlY3Qoe1xuICAgICAgZGVjb2RlOiAodGV4dCwgb3B0aW9ucykgPT5cbiAgICAgICAgU2NoZW1hUGFyc2VyLmRlY29kZVVua25vd25FZmZlY3QoTWFzY290VGV4dCkodGV4dCwgb3B0aW9ucyksXG4gICAgICBlbmNvZGU6IChtYXNjb3QsIG9wdGlvbnMpID0+XG4gICAgICAgIFNjaGVtYVBhcnNlci5lbmNvZGVFZmZlY3QoTWFzY290VGV4dCkobWFzY290LCBvcHRpb25zKSxcbiAgICB9KVxuICApXG4pO1xuXG5jb25zdCBlbmNvZGVDb2RlID0gU2NoZW1hLmVuY29kZVN5bmMoTWFzY290Q29kZSk7XG5cbi8qKiBXcml0ZXMgdGhlIGNvZGUgb2YgYSBtYXNjb3QsIHRoZSBmb3JtIHRoYXQgaXMgc3RvcmVkLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVuY29kZShtYXNjb3Q6IHR5cGVvZiBNYXNjb3QuVHlwZSkge1xuICByZXR1cm4gZW5jb2RlQ29kZShtYXNjb3QpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF5VCxTQUFTLFVBQVUsV0FBVztBQUdoVixTQUFTLE1BQU0sT0FBZTtBQUNuQyxTQUFPLElBQUksTUFBTSxPQUFPLENBQUM7QUFDM0I7OztBQ0x5VCxTQUFTLGNBQWM7QUFNaFYsSUFBTSxRQUFRO0FBQUE7QUFBQSxFQUVaLE9BQU8sT0FBTyxZQUFZLE9BQU8sTUFBTTtBQUFBLEVBQ3ZDLE1BQU0sT0FBTyxZQUFZLE9BQU8sTUFBTTtBQUFBLEVBQ3RDLGFBQWEsT0FBTyxZQUFZLE9BQU8sTUFBTTtBQUFBLEVBQzdDLFVBQVUsT0FBTyxZQUFZ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QUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQ0YsQ0FBQztBQUdNLElBQU0sVUFBOEM7QUFBQSxFQUN6RCxHQUFHO0FBQUEsRUFDSCxHQUFHO0FBQUEsRUFDSCxHQUFHO0FBQUEsRUFDSCxHQUFHO0FBQUEsRUFDSCxHQUFHO0FBQUEsRUFDSCxHQUFHO0FBQUEsRUFDSCxHQUFHO0FBQUEsRUFDSCxHQUFHO0FBQUEsRUFDSCxHQUFHO0FBQ0w7OztBQzVGMlQsU0FBUyxTQUFTQyxNQUFLLFVBQUFDLGVBQWM7QUFNelYsSUFBTSxTQUFTQyxRQUFPLFNBQVM7QUFBQSxFQUNwQztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEs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NUQsUUFBUSxDQUFDLFFBQVEsWUFDZixhQUFhLGFBQWEsVUFBVSxFQUFFLFFBQVEsT0FBTztBQUFBLElBQ3pELENBQUM7QUFBQSxFQUNIO0FBQ0Y7QUFFQSxJQUFNLGFBQWFBLFFBQU8sV0FBVyxVQUFVOyIsCiAgIm5hbWVzIjogWyJTY2hlbWEiLCAiU2NoZW1hIiwgImVsbGlwc2UiLCAicGF0aCIsICJleWVzIiwgIkFyciIsICJlbGxpcHNlIiwgInBhdGgiLCAiQXJyIiwgIkFyciIsICJlbGxpcHNlIiwgInBhdGgiLCAiQXJyIiwgIkFyciIsICJlbGxpcHNlIiwgInBhdGgiLCAiQXJyIiwgIkFyciIsICJlbGxpcHNlIiwgIkFyciIsICJwYXRoIiwgIkFyciIsICJwYXRoIiwgImVsbGlwc2UiLCAiQXJyIiwgImVsbGlwc2UiLCAiQXJyIiwgImVsbGlwc2UiLCAicGF0aCIsICJBcnIiLCAiZWxsaXBzZSIsICJwYXRoIiwgImVsbGlwc2UiLCAicGF0aCIsICJTY2hlbWEiLCAiU2NoZW1hIiwgIkFyciIsICJTY2hlbWEiLCAiU2NoZW1hIiwgIlNjaGVtYSIsICJTY2hlbWEiLCAiU2NoZW1hIiwgIlNjaGVtYSIsICJleWVzIl0KfQo=
