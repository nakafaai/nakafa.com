import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

/** The school whose frame the browser asks for. */
export const SchoolFrameInput = Schema.Struct({ slug: TenantSlug });

/** The school frame server function, which returns no credential. */
export const readSchoolFrameFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SchoolFrameInput))
  .handler(async (options) => {
    const { frameHandler } = await import("@/lib/tenant/frame.server");
    return frameHandler(options);
  });
