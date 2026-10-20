import { createFileRoute, redirect } from "@tanstack/react-router";

/** The retired about page of a locale answers with a permanent redirect to the locale home. */
export const Route = createFileRoute("/$locale/about")({
  beforeLoad: ({ params }) => {
    throw redirect({
      params: { locale: params.locale },
      statusCode: 308,
      to: "/$locale",
    });
  },
});
