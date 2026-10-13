/**
 * The window on her whole figure: room for raised arms and for what she holds.
 * A page reserves the room she takes from this window before she is drawn, so
 * the windows live apart from her outlines, which a page that only reserves
 * room must not load.
 */
export const WHOLE_BOX = [-48, -20, 300, 310] as const;

/** The window on her half figure. */
export const HALF_BOX = [0, 0, 200, 200] as const;
