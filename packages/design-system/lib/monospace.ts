import "@repo/design-system/styles/monospace.css";

/**
 * Geist Mono's variable class. The root document does not carry it, so a route
 * loads the face only when a layout or component that renders monospace text
 * applies the class, and the class defines `--font-geist-mono` for that element
 * and every descendant. A portal outside that subtree must apply it too. The
 * faces have optional display (styles/monospace.css), so text never moves when
 * the face arrives.
 */
export const monospace = "geist-mono";
