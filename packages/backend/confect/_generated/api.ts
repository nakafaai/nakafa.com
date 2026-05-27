import { Api } from "@confect/server";
import schema from "@repo/backend/confect/schema";
import spec from "@repo/backend/confect/spec";

export default Api.make(schema, spec);
