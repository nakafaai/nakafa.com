import { ClassAddress } from "@repo/backend/confect/classroom/class";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** The first page of a class's forum channels, the forum tab's rows. */
export const ClassForumInput = Schema.Struct({
  classSlug: ClassAddress,
  numItems: Schema.Int.check(Schema.isBetween({ maximum: 100, minimum: 1 })),
  slug: TenantSlug,
});

/** The school whose classes the sidebar lists. */
export const ShellInput = Schema.Struct({ slug: TenantSlug });
