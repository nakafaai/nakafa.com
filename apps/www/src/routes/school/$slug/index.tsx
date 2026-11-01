import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The root of a school host, which holds no page of its own: a member lands on the page of their main work there
 * (`landingOf`), decided in the browser from the frame the school layout already read, so the address changes before
 * anything draws and no Worker renders it. A visitor and an account that is not a member see the school's entry or
 * outsider page, which the layout draws in place of every page.
 */
export const Route = createFileRoute("/school/$slug/")({
  beforeLoad: async ({ context, params }) => {
    const { school } = context;
    if (school._tag !== "Member") {
      return;
    }
    const { memberLandingOf } = await import("@/lib/tenant/landing");
    throw redirect({ params, replace: true, to: memberLandingOf(school) });
  },
});
