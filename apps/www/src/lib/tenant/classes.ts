import { ClassAddress } from "@repo/backend/confect/classroom/class";
import { DiscussionNumber } from "@repo/backend/confect/classroom/forum/message";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** The first page of a class's forum channels, the forum tab's rows. */
export const ClassForumInput = Schema.Struct({
  classSlug: ClassAddress,
  numItems: Schema.Int.check(Schema.isBetween({ maximum: 100, minimum: 1 })),
  slug: TenantSlug,
});

/** One numbered discussion of a class, with the first page of the class's forum channels. */
export const ClassDiscussionInput = Schema.Struct({
  ...ClassForumInput.fields,
  number: DiscussionNumber,
});

/** The school whose classes the sidebar lists. */
export const ShellInput = Schema.Struct({ slug: TenantSlug });
