import { createFileRoute, redirect } from "@tanstack/react-router";

/** The settings root opens the school's first section, its profile, for a member who manages the school. */
export const Route = createFileRoute("/school/$slug/settings/")({
  beforeLoad: ({ context, params }) => {
    if (context.school._tag === "Member") {
      throw redirect({
        params: { slug: params.slug },
        to: "/school/$slug/settings/profile",
      });
    }
  },
});
