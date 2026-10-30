import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { MemberRoomJoin } from "@/components/tenant/room";

/**
 * The address where a student types an exam room's code without its QR code. A member joins the
 * room here; a signed-in account that is not a member gets the same form on the outsider page, and a
 * signed-out visitor signs in first and comes back here.
 */
export const Route = createFileRoute("/school/$slug/join")({
  component: SchoolJoinPage,
});

function SchoolJoinPage(): ReactElement {
  return <MemberRoomJoin />;
}
