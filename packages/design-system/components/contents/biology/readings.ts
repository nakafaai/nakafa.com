import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";

/** One reading of a lab item that its footer shows: a term and the value it names. */
interface BiologyReading {
  readonly key: "focus" | "takeaway";
  readonly label: ReactNode;
  readonly value: ReactNode;
}

/** The values of one lab item that its footer can show. */
interface BiologyReadingItem {
  readonly focus?: ReactNode;
  readonly takeaway?: ReactNode;
}

/** The terms of a lab footer. A lab may leave a term without text. */
interface BiologyReadingLabels {
  readonly focusLabel?: ReactNode;
  readonly takeawayLabel?: ReactNode;
}

/** A reading exists only when its term and its value both do. */
function readingOf(
  key: BiologyReading["key"],
  label: ReactNode,
  value: ReactNode
): Option.Option<BiologyReading> {
  if (label === undefined || value === undefined) {
    return Option.none();
  }
  return Option.some({ key, label, value });
}

/**
 * The readings of a lab footer for its selected item, in footer order. A value
 * without its term is left out, so no term stands without its name.
 */
export function biologyReadings(
  item: BiologyReadingItem,
  labels: BiologyReadingLabels
): readonly BiologyReading[] {
  return Arr.getSomes([
    readingOf("focus", labels.focusLabel, item.focus),
    readingOf("takeaway", labels.takeawayLabel, item.takeaway),
  ]);
}
