import { cva } from "class-variance-authority";
import { Schema } from "effect";

/**
 * The one scale a status takes, by what it means, each in its own colour token of the theme: neutral for a
 * state at rest or over, info for one that is under way or coming, success for one that went well, warning
 * for one that needs the reader before the work can go on, such as a question without its key, and
 * destructive for one that failed or is shut. The primary colour stays with actions, so no status reads as
 * a button.
 */
export const StatusTone = Schema.Literals([
  "neutral",
  "info",
  "success",
  "warning",
  "destructive",
]);

/** The badge variant that draws each tone, as a table's status cell and a card's state draw it. */
export const STATUS_BADGES = {
  destructive: "destructive",
  info: "info",
  neutral: "muted",
  success: "success",
  warning: "warning",
} as const satisfies Record<typeof StatusTone.Type, string>;

/**
 * The badge variant of each tone on a muted band, such as a pane's footer: a neutral state takes a border and the
 * page's fill there, because the muted fill it wears on a card would melt into the band.
 */
export const BAND_STATUS_BADGES = {
  ...STATUS_BADGES,
  neutral: "muted-subtle",
} as const satisfies Record<typeof StatusTone.Type, string>;

/**
 * The icon of a status line, a status said in a sentence rather than a badge: the icon takes the tone's
 * colour, and the words keep the muted text beside it, so one accent carries the meaning.
 */
export const statusIconVariants = cva("shrink-0", {
  variants: {
    tone: {
      destructive: "text-destructive",
      info: "text-info",
      neutral: "text-muted-foreground",
      success: "text-success",
      warning: "text-warning",
    },
  },
});
