import { createFileRoute, redirect } from "@tanstack/react-router";

/** The retired about page answers with a permanent redirect to the site root. */
export const Route = createFileRoute("/about")({
  beforeLoad: () => {
    throw redirect({ statusCode: 308, to: "/" });
  },
});
