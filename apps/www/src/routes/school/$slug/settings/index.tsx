import { createFileRoute, redirect } from "@tanstack/react-router";
import { Option } from "effect";
import { firstSettingsTarget } from "@/lib/settings/school";

/** The settings root opens the first section the member's actions open, which is the profile for a manager. */
export const Route = createFileRoute("/school/$slug/settings/")({
  beforeLoad: ({ context, params }) => {
    if (context.school._tag !== "Member") {
      return;
    }
    const first = firstSettingsTarget(params.slug, context.school.viewer.reach);
    if (Option.isSome(first)) {
      throw redirect(first.value);
    }
  },
});
