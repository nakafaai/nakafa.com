import { GeistMono } from "geist/font/mono";

/**
 * Geist Mono's variable class. The root document does not carry it, so a route
 * preloads the face only when a layout or component that renders monospace text
 * applies the class, and the class defines `--font-geist-mono` for that element
 * and every descendant. A portal outside that subtree must apply it too.
 */
export const monospace = GeistMono.variable;
