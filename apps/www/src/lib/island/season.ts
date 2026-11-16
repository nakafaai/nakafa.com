import { Array as Arr, DateTime, Schema } from "effect";
import { RAMPS, rgbOf } from "@/lib/island/palette";

/**
 * Every season the world knows (ADR 0047, D8): the four of the temperate
 * zones, and the wet and dry seasons of the tropics, where most Nakafa
 * learners live.
 */
export const Season = Schema.Literals([
  "spring",
  "summer",
  "autumn",
  "winter",
  "wet",
  "dry",
]);
export type Season = typeof Season.Type;

/** Time zones in the tropics, where the year turns between a wet and a dry season. */
const TROPICS = [
  "Asia/Jakarta",
  "Asia/Pontianak",
  "Asia/Makassar",
  "Asia/Jayapura",
  "Asia/Kuala_Lumpur",
  "Asia/Kuching",
  "Asia/Singapore",
  "Asia/Brunei",
  "Asia/Dili",
  "Asia/Manila",
  "Asia/Bangkok",
  "Asia/Ho_Chi_Minh",
  "Asia/Yangon",
  "Asia/Colombo",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Africa/Kinshasa",
  "America/Bogota",
  "America/Lima",
  "America/Caracas",
  "America/Manaus",
  "America/Panama",
  "Pacific/Port_Moresby",
  "Pacific/Fiji",
];

/** Beginnings of time zones south of the tropics, where the four seasons fall half a year apart from the north's. */
const SOUTH = [
  "Australia/",
  "Antarctica/",
  "Pacific/Auckland",
  "Pacific/Chatham",
  "America/Argentina/",
  "America/Santiago",
  "America/Montevideo",
  "America/Sao_Paulo",
  "America/Asuncion",
  "Africa/Johannesburg",
  "Africa/Maputo",
  "Africa/Windhoek",
  "Indian/Mauritius",
];

/** The season of a month (1 to 12) in a time zone, by the zone's climate and hemisphere. */
export function seasonOf(month: number, zone: string): Season {
  if (Arr.contains(TROPICS, zone)) {
    return month >= 5 && month <= 10 ? "dry" : "wet";
  }
  const south = Arr.some(SOUTH, (start) => zone.startsWith(start));
  const turned = south ? ((month + 5) % 12) + 1 : month;
  if (turned >= 3 && turned <= 5) {
    return "spring";
  }
  if (turned >= 6 && turned <= 8) {
    return "summer";
  }
  return turned >= 9 && turned <= 11 ? "autumn" : "winter";
}

/** The learner's season now, by their own clock and time zone. */
export function seasonNow() {
  const zone = DateTime.zoneMakeLocal();
  const month = DateTime.getPart(
    DateTime.setZone(DateTime.nowUnsafe(), zone),
    "month"
  );
  return seasonOf(month, zone.id);
}

/**
 * How a season repaints the grass and the leaves, tone by tone from shadow to
 * highlight; summer and the wet season keep the palette's own green.
 */
const REPAINTS = {
  autumn: {
    grass: ["#5d6b2e", "#7f8c39", "#a3ab47", "#c4c765"],
    leaf: ["#7a2f1c", "#b34f22", "#dc7f2c", "#f0b746"],
  },
  dry: {
    grass: ["#6f6a2c", "#918a3b", "#b4a952", "#d4c77a"],
    leaf: ["#44582a", "#647434", "#879544", "#acb15c"],
  },
  spring: {
    grass: ["#467f37", "#64a446", "#89c55a", "#b8e07a"],
    leaf: ["#386a37", "#5a9a49", "#82c05c", "#f0a6bf"],
  },
  winter: {
    grass: ["#a9b9cb", "#c9d5e2", "#e3eaf1", "#fbfdff"],
    leaf: ["#58796b", "#86a398", "#c3d7d3", "#f1f8f8"],
  },
} as const;

/**
 * The atlas repainted for a season, in place: every pixel in a tone of the
 * grass or leaf ramp takes the season's tone, so snow lies on the grass in
 * winter, the leaves turn in autumn and blossom in spring, and the grass dries
 * in the dry season. Summer and the wet season leave it as painted.
 */
export function repaintFor(pixels: Uint8ClampedArray, season: Season) {
  if (season === "summer" || season === "wet") {
    return pixels;
  }
  const repaint = REPAINTS[season];
  const swaps = Arr.flatMap(["grass", "leaf"] as const, (ramp) =>
    Arr.map(RAMPS[ramp], (from, tone) => ({
      from: rgbOf(from),
      to: rgbOf(repaint[ramp][tone]),
    }))
  );
  for (let at = 0; at < pixels.length; at += 4) {
    for (const swap of swaps) {
      if (
        pixels[at] === swap.from[0] &&
        pixels[at + 1] === swap.from[1] &&
        pixels[at + 2] === swap.from[2]
      ) {
        pixels.set(swap.to, at);
        break;
      }
    }
  }
  return pixels;
}
