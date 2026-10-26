import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { SchoolInput, SettingsListInput } from "@/lib/tenant/settings";

/** The guardian's children, which the parent home's loader calls. */
export const readChildrenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SchoolInput))
  .handler(async (options) => {
    const { childrenHandler } = await import("@/lib/tenant/guardians.server");
    return childrenHandler(options);
  });

/** The first page of the school's guardian links, which the Staff page's loader calls. */
export const readLinksFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SettingsListInput))
  .handler(async (options) => {
    const { linksHandler } = await import("@/lib/tenant/guardians.server");
    return linksHandler(options);
  });
