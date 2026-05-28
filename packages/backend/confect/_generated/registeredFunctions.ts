import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import impl from "@repo/backend/confect/impl";

export default RegisteredFunctions.make(impl, RegisteredConvexFunction.make);
