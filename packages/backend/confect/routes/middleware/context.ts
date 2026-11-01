import { requestIdentity } from "@repo/backend/confect/routes/middleware/identity";
import { requestLogger } from "@repo/backend/confect/routes/middleware/logger";

/** What every route runs under: the request's correlation ID and its outcome log. */
export const requestContext = requestIdentity.combine(requestLogger);
