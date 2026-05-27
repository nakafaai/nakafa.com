import { RegisteredFunctions } from "@confect/server";
import { RegisteredNodeFunction } from "@confect/server/node";

import nodeImpl from "@repo/backend/confect/nodeImpl";

export default RegisteredFunctions.make(nodeImpl, RegisteredNodeFunction.make);
