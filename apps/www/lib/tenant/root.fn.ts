import { createServerFn } from "@tanstack/react-start";
import { schoolRootHandler } from "@/lib/tenant/root.server";

/** The locale and the messages of the school pages, read once for every page below the school layout. */
export const readSchoolRootFn = createServerFn({ method: "GET" }).handler(
  schoolRootHandler
);
