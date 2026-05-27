import { Api } from "@confect/server";

import schema from "@repo/backend/confect/schema";
import nodeSpec from "@repo/backend/confect/nodeSpec";

export default Api.make(schema, nodeSpec);
