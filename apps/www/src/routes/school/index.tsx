import { createFileRoute, notFound } from "@tanstack/react-router";

/** The school tree has no page at its root, so a bare school address answers not found. */
export const Route = createFileRoute("/school/")({
  beforeLoad: () => {
    throw notFound();
  },
});
