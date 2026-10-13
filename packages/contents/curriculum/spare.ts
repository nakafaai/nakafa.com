import {
  BalloonIcon,
  BikeIcon,
  BinocularsIcon,
  CloverIcon,
  Cupcake01Icon,
  GiftIcon,
  KiteIcon,
  LanternIcon,
  OrigamiIcon,
  PandaIcon,
  SofaIcon,
  UmbrellaIcon,
} from "@hugeicons/core-free-icons";
import type { Array as Arr } from "effect";

/**
 * The icons that no known key uses, and that read as no subject in particular.
 *
 * A key that a content release brings in before the app knows it, such as a
 * new subject or exam, takes its icon from here, chosen from the key, so two
 * unknown keys show two icons and never one shared fallback. Nothing else in
 * the product draws these twelve, and they are more than the longest list of
 * tiles that the corpus holds. The product-wide test of icons in
 * `apps/www/components/tryout/catalog/icons.test.ts` keeps both so. No two of
 * them are the same object at 40px, since a list of unknown keys shows many
 * of them together.
 */
export const SPARE_ICONS: Arr.NonEmptyReadonlyArray<typeof KiteIcon> = [
  KiteIcon,
  BalloonIcon,
  GiftIcon,
  UmbrellaIcon,
  LanternIcon,
  SofaIcon,
  Cupcake01Icon,
  CloverIcon,
  BikeIcon,
  OrigamiIcon,
  BinocularsIcon,
  PandaIcon,
];
