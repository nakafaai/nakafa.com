import guardians from "@repo/backend/confect/_generated/refs/guardians";
import { Effect } from "effect";
import { readRequired } from "@/lib/data/read.server";
import { memberHandler } from "@/lib/tenant/member.server";
import type { SchoolInput, SettingsListInput } from "@/lib/tenant/settings";

/** The children whose links name the signed-in guardian, which the parent home reads first. */
export const childrenHandler = memberHandler(
  ({ slug }: typeof SchoolInput.Type, token: string) =>
    readRequired(guardians.family.children, { slug }, token)
);

/** The first page of the school's guardian links, which the Staff page reads first. */
export const linksHandler = memberHandler(
  ({ numItems, slug }: typeof SettingsListInput.Type, token: string) =>
    readRequired(
      guardians.links.list,
      { paginationOpts: { cursor: null, numItems }, slug },
      token
    ).pipe(Effect.map(({ isDone, page }) => ({ isDone, page })))
);
