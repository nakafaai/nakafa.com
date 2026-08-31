import type { PublicationRequest } from "@nakafa/aksara-contracts/transport/request";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";

/** Publication request handled by the authenticated rollback reader. */
export type RollbackRequest = Extract<
  PublicationRequest,
  {
    readonly operation: "rollbackPage" | "routePage";
  }
>;

/** Body-bearing rollback request selected from the transport contract. */
export type BodyRequest = Extract<
  RollbackRequest,
  {
    readonly operation: "rollbackPage";
  }
>;

/** Route-only rollback request selected from the transport contract. */
export type RouteRequest = Extract<
  RollbackRequest,
  {
    readonly operation: "routePage";
  }
>;

/** Convex capability required by rollback page readers. */
export type ReadContext = Pick<ActionCtx, "runQuery">;
