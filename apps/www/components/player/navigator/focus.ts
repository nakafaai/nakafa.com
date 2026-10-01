/** Moves focus to the sidebar grid's current cell on wide screens. */
export function focusPlayerSidebar() {
  document
    .querySelector<HTMLElement>('[data-player-sidebar] [aria-current="step"]')
    ?.focus();
}
