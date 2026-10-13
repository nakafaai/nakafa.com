import {
  BalloonIcon,
  BinocularsIcon,
  CloverIcon,
  Cupcake01Icon,
  GemIcon,
  GiftIcon,
  KiteIcon,
  LanternIcon,
  LollipopIcon,
  OrigamiIcon,
  PandaIcon,
  UmbrellaIcon,
} from "@hugeicons/core-free-icons";
import type { Array as Arr } from "effect";

/**
 * The icons that no known key uses, and that read as no subject in particular.
 *
 * A key that a content release brings in before the app knows it, such as a
 * new subject or exam, takes its icon from here, chosen from the key, so two
 * unknown keys show two icons and never one shared fallback. Nothing else in
 * the product draws these twelve, and a test keeps it so.
 */
export const SPARE_ICONS: Arr.NonEmptyReadonlyArray<typeof KiteIcon> = [
  KiteIcon,
  BalloonIcon,
  GiftIcon,
  UmbrellaIcon,
  LanternIcon,
  LollipopIcon,
  Cupcake01Icon,
  CloverIcon,
  GemIcon,
  OrigamiIcon,
  BinocularsIcon,
  PandaIcon,
];
