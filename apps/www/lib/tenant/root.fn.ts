import { createServerFn } from "@tanstack/react-start";

/** The locale and the messages of the school pages, read once for every page below the school layout. */
export const readSchoolRootFn = createServerFn({ method: "GET" }).handler(
  async (options) => {
    const { schoolRootHandler } = await import("@/lib/tenant/root.server");
    return schoolRootHandler(options);
  }
);
