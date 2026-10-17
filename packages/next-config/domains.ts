export const MAIN_DOMAIN = "nakafa.com" as const;

/**
 * The data cells of ADR 0026, each with the registrable domain that serves its
 * school hosts. The proxy reads this map, so a request never reads the database
 * to find a school. Only the `us` cell exists today.
 */
export const SCHOOL_CELL_DOMAINS = {
  us: MAIN_DOMAIN,
};
