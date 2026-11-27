import type {
  MatterSchema,
  MetalSchema,
  SHARED,
} from "@repo/design-system/components/three/matter/ask";
import {
  FinishSchema,
  isMetal,
} from "@repo/design-system/components/three/matter/ask";
import {
  hotness,
  matterGlow,
  tintOf,
} from "@repo/design-system/components/three/matter/glow";
import { SurfaceSchema } from "@repo/design-system/components/three/surface/detail";
import { MATTER_COLORS } from "@repo/design-system/lib/material/matter";
import { Option, Schema } from "effect";
import {
  AdditiveBlending,
  Color,
  CustomBlending,
  DoubleSide,
  FrontSide,
  NormalBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  SrcAlphaFactor,
} from "three";

/**
 * A material with relief: its surface, how light leaves it, how far one
 * `tile` of its detail reaches, in scene units, on a lab drawn at bench
 * scale, and whether it has a `grain` that runs along the length of
 * whatever is cut from it.
 */
const BodySchema = Schema.Struct({
  bump: Schema.Finite,
  coat: Schema.Finite,
  gloss: Schema.Finite,
  grain: Schema.Boolean,
  metalness: Schema.Finite,
  rough: Schema.Finite,
  surface: Schema.Option(SurfaceSchema),
  tile: Schema.Finite,
});
type Body = typeof BodySchema.Type;

/** A metal: its colour and the finish it leaves the workshop with. */
const AlloySchema = Schema.Struct({
  finish: FinishSchema,
  tint: Schema.String,
});

/** A material too smooth for relief: a pane, a melt, a liquid or light itself. */
const SmoothSchema = Schema.Struct({
  coat: Schema.Finite,
  gloss: Schema.Finite,
  ior: Schema.Finite,
  metalness: Schema.Finite,
  opacity: Schema.Finite,
  rough: Schema.Finite,
});
type Smooth = typeof SmoothSchema.Type;

/** The refractive index a renderer gives a material that names none. */
const PLAIN_IOR = 1.5;

/** Each way of working metal: `rough` scales the roughness its surface is painted with. */
const FINISHES: Record<typeof FinishSchema.Type, Body> = {
  brushed: body("brushed", { bump: 0.5, metalness: 1, tile: 0.3 }),
  cast: body("cast", { bump: 0.8, metalness: 1, tile: 0.4 }),
  knurled: body("knurl", { bump: 1, metalness: 1, tile: 0.12 }),
  machined: body("machined", { bump: 0.7, metalness: 1, tile: 0.3 }),
  polished: body("polished", { bump: 0.5, metalness: 1, tile: 0.4 }),
  // Magnet wire: every turn under its own coat of clear enamel.
  wound: body("winding", {
    bump: 1,
    coat: 0.7,
    gloss: 0.2,
    metalness: 1,
    tile: 0.25,
  }),
};

/**
 * Each metal: its colour and the finish it leaves the workshop with. Drawn
 * rod, tube and plate are satin, which spreads the light of a lamp along
 * them; only what is plated or cast for show is a mirror.
 */
const METALS: Record<typeof MetalSchema.Type, typeof AlloySchema.Type> = {
  aluminium: { finish: "brushed", tint: MATTER_COLORS.aluminium },
  brass: { finish: "machined", tint: MATTER_COLORS.brass },
  chrome: { finish: "polished", tint: MATTER_COLORS.chrome },
  copper: { finish: "brushed", tint: MATTER_COLORS.copper },
  gold: { finish: "polished", tint: MATTER_COLORS.gold },
  iron: { finish: "cast", tint: MATTER_COLORS.iron },
  nichrome: { finish: "brushed", tint: MATTER_COLORS.nichrome },
  nickel: { finish: "brushed", tint: MATTER_COLORS.nickel },
  solder: { finish: "brushed", tint: MATTER_COLORS.solder },
  steel: { finish: "brushed", tint: MATTER_COLORS.steel },
  tungsten: { finish: "brushed", tint: MATTER_COLORS.tungsten },
};

/** What a smooth material is, by name. */
const SMOOTHS = {
  // Borosilicate 3.3 laboratory glass (Schott Duran, n_d = 1.473).
  glass: smooth({
    coat: 1,
    gloss: 0.04,
    ior: 1.473,
    opacity: 0.24,
    rough: 0.05,
  }),
  ice: smooth({ coat: 1, gloss: 0.08, ior: 1.31, opacity: 0.78, rough: 0.08 }),
  light: smooth({ rough: 1 }),
  liquid: smooth({
    coat: 0.6,
    gloss: 0.1,
    ior: 1.33,
    opacity: 0.66,
    rough: 0.12,
  }),
  mercury: smooth({ metalness: 1, rough: 0.06 }),
} satisfies Record<string, Smooth>;

/**
 * Sawn wood under a thin varnish, as a baseboard or a turned stand leaves
 * the workshop: its pores stay open and it shines softly. One tile is a
 * board's width of growth rings.
 */
const WOOD = body("wood", {
  bump: 0.3,
  coat: 0.7,
  gloss: 0.12,
  grain: true,
  rough: 0.5,
  tile: 1,
});

/** What a material with relief is, by name. */
const BODIES = {
  anodised: body("anodised", { bump: 0.6, metalness: 0.85 }),
  bakelite: body("plastic", { bump: 0.5, coat: 0.4, gloss: 0.3 }),
  beech: WOOD,
  ceramic: body("ceramic", { bump: 0.4, coat: 0.8, gloss: 0.15 }),
  cloth: body("cloth", { bump: 0.5, tile: 0.25 }),
  cork: body("cork", { bump: 0.6, tile: 0.25 }),
  // Stove enamel: gloss paint baked on steel.
  enamel: body("paint", { bump: 0.6, coat: 0.6, gloss: 0.2, tile: 0.6 }),
  // Cast resin: the lens of an LED, the body of a chip, a die.
  epoxy: body("plastic", { bump: 0.3, coat: 1, gloss: 0.06, rough: 0.6 }),
  felt: body("felt", { bump: 0.6, tile: 0.3 }),
  foam: body("foam", { bump: 0.6, tile: 0.2 }),
  // Stained wood under a thick gloss lacquer that fills its pores.
  lacquer: body("wood", {
    bump: 0.08,
    coat: 1,
    gloss: 0.05,
    grain: true,
    rough: 0.4,
    tile: 1,
  }),
  maple: WOOD,
  mica: body("polished", { bump: 0.5, coat: 1, gloss: 0.1 }),
  oak: WOOD,
  paint: body("paint", { bump: 0.6, rough: 1.6, tile: 0.6 }),
  paper: body("paper", { bump: 0.6, tile: 0.3 }),
  plastic: body("plastic", { bump: 0.6 }),
  porcelain: body("ceramic", { bump: 0.3, coat: 0.8, gloss: 0.15 }),
  rubber: body("rubber", { bump: 0.5, tile: 0.25 }),
  walnut: WOOD,
  wax: body("plastic", { bump: 0.3, coat: 0.25, gloss: 0.6, rough: 1.4 }),
} satisfies Record<string, Body>;

/** How many wall thicknesses of clear material tint the light to the material's own colour. */
const REACH = 40;

/**
 * The reach of the bench the tile sizes above were measured on. A lab draws
 * its table at whatever size suits it, so a tile is laid as this share of
 * the lab's own reach and a grain reads the same in every lab.
 */
const BENCH = 2.8;

const DARK = new Color(MATTER_COLORS.dark);

/** How one layer is laid over what is behind it: each as much as its opacity says. */
const OVER = {
  blendDst: OneMinusSrcAlphaFactor,
  blendSrc: SrcAlphaFactor,
} as const;

const isSmooth = Schema.is(
  Schema.Literals(["glass", "ice", "light", "liquid", "mercury"])
);

/** One material with relief, from its surface and whatever sets it apart from a matt dielectric. */
function body(
  surface: typeof SurfaceSchema.Type,
  look: Partial<Omit<Body, "surface">>
): Body {
  return {
    bump: 0,
    coat: 0,
    gloss: 0,
    grain: false,
    metalness: 0,
    rough: 1,
    tile: 0.4,
    ...look,
    surface: Option.some(surface),
  };
}

/** One smooth material, from whatever sets it apart from an opaque, uncoated dielectric. */
function smooth(look: Partial<Smooth>): Smooth {
  return {
    coat: 0,
    gloss: 0,
    ior: PLAIN_IOR,
    metalness: 0,
    opacity: 1,
    rough: 1,
    ...look,
  };
}

/** What a renderer needs for a material with relief that lets `opacity` of the light behind it through. */
function shown(look: Body, opacity: number) {
  return {
    attenuationDistance: Number.POSITIVE_INFINITY,
    ...OVER,
    blending: NormalBlending,
    attenuationColor: MATTER_COLORS.glassEdge,
    clearcoat: look.coat,
    clearcoatRoughness: look.gloss,
    depthWrite: opacity >= 1,
    grain: look.grain,
    ior: PLAIN_IOR,
    metalness: look.metalness,
    opacity,
    relief: look.bump,
    roughness: look.rough,
    side: FrontSide,
    specularIntensity: 1,
    surface: look.surface,
    thickness: 0,
    tile: look.tile / BENCH,
    toneMapped: true,
    transmission: 0,
    transparent: opacity < 1,
  };
}

/**
 * The colour a metal reflects at `glow`: its own when cold, and darker the
 * hotter it runs, because an eye or a camera set for the glow of a hot wire
 * no longer sees the room in it.
 */
function dimmed(tint: string, glow: number) {
  return `#${new Color(tint).lerp(DARK, Math.min(1, glow * 2)).getHexString()}`;
}

/**
 * Resolves what an author asked for into everything a physically based
 * renderer needs: the colour, the surface whose detail tiles it carries (none
 * for a smooth material), how far one tile reaches as a share of the lab's
 * reach and whether its grain follows the part's length, how strongly its
 * relief bends the light, its roughness, metalness and clear coat, what it
 * radiates, and how it lets light through. Light itself keeps its hue, so a
 * renderer does not tone-map it. One material resolves the same way in
 * every lab. A stage that draws `direct` to the screen, with no photographic
 * finish, lays a clear pane the plain way: see `blend`.
 */
export function matterLook(ask: typeof MatterSchema.Type, direct = false) {
  const glow = matterGlow(ask);
  const lit = { emissive: glow.color, emissiveIntensity: glow.strength };
  if (isMetal(ask)) {
    const metal = METALS[ask.of];
    return {
      ...shown(FINISHES[ask.finish ?? metal.finish], ask.opacity ?? 1),
      ...lit,
      color: dimmed(metal.tint, hotness(ask.glow)),
    };
  }
  const { of } = ask;
  const color = tintOf(ask);
  if (!isSmooth(of)) {
    return { ...shown(BODIES[of], ask.opacity ?? 1), ...lit, color };
  }
  return { ...lit, ...clear(of, color, ask, glow.strength, direct) };
}

/**
 * How a smooth material is laid over what is behind it. Light adds to it.
 * A clear pane lets `opacity` of itself show and the rest of what is behind
 * it through, but what it reflects is laid over both in full: a window is
 * as bright a mirror of the room as a painted pane, however clear it is.
 * That holds only where layers add up in linear light, before the tones are
 * mapped. A stage that draws `direct` to the screen maps each layer first,
 * and panes laid in full over one another there burn out to white, so it
 * fades the whole pane, mirror and all, by its opacity.
 */
function blend(lit: boolean, opacity: number, direct: boolean) {
  if (opacity >= 1 || (direct && !lit)) {
    return { ...OVER, blending: NormalBlending };
  }
  if (lit) {
    return { ...OVER, blending: AdditiveBlending };
  }
  return {
    blendDst: OneMinusSrcAlphaFactor,
    blendSrc: OneFactor,
    blending: CustomBlending,
  };
}

/** A clear material's own colour, as large a `share` of it as shows. */
function faded(color: string, share: number) {
  return `#${new Color(color).multiplyScalar(share).getHexString()}`;
}

/**
 * What a renderer needs for a smooth material. A clear wall with a
 * `thickness` bends the scene behind it instead of fading it; light itself
 * has a dark body that reflects nothing, and adds to what lies behind it
 * where it is not opaque.
 */
function clear(
  of: keyof typeof SMOOTHS,
  color: string,
  ask: { readonly [Key in keyof typeof SHARED]?: number },
  strength: number,
  direct: boolean
) {
  const look = SMOOTHS[of];
  const thickness = ask.thickness ?? 0;
  const opacity = thickness > 0 ? 1 : (ask.opacity ?? look.opacity);
  const lit = of === "light";
  // A pane laid in full carries only its own share of colour and glow; one
  // the blending fades, or light itself, carries all of it.
  const share = lit || direct ? 1 : Math.min(1, opacity);
  return {
    attenuationColor: MATTER_COLORS.glassEdge,
    attenuationDistance:
      thickness > 0 ? thickness * REACH : Number.POSITIVE_INFINITY,
    ...blend(lit, opacity, direct),
    clearcoat: look.coat,
    clearcoatRoughness: look.gloss,
    color: lit ? MATTER_COLORS.dark : faded(color, share),
    depthWrite: opacity >= 1,
    emissiveIntensity: strength * share,
    grain: false,
    ior: look.ior,
    metalness: look.metalness,
    opacity,
    relief: 0,
    roughness: look.rough,
    side: of === "glass" ? DoubleSide : FrontSide,
    specularIntensity: lit ? 0 : 1,
    surface: Option.none<typeof SurfaceSchema.Type>(),
    thickness,
    tile: 1,
    toneMapped: !lit,
    transmission: thickness > 0 ? 1 : 0,
    transparent: opacity < 1,
  };
}
