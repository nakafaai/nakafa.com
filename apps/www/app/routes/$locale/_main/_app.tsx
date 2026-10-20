import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * The signed-in document shell. Every page under `_app` renders for one visitor
 * on each request, so no cache may keep it. Account screens pass the sign-in
 * gate in `_account`; chat, search and profiles stay open to visitors, as the
 * reference keeps them.
 */
export const Route = createFileRoute("/$locale/_app")({
  headers: () => ({ "Cache-Control": "private, no-store" }),
  component: Outlet,
});
