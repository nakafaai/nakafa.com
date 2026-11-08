import { Number as Num } from "effect";

/** The tallest and the widest shape a lone photo keeps in the stream: one wide by two tall, and three wide by one tall. */
const RATIO = { maximum: 3, minimum: 0.5 };

/**
 * The shape a lone photo takes in the stream, width over height, from its size in pixels: its own shape between one
 * by two and three by one, so a panorama or a long screenshot never stretches the chat, and the picture fills the
 * rest by cropping. A photo whose size is unknown stands square.
 */
export const photoRatio = (width: number | null, height: number | null) =>
  width === null || height === null || width <= 0 || height <= 0
    ? 1
    : Num.clamp(width / height, RATIO);
