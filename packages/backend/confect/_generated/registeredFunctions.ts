import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import impl from "../impl";

export default RegisteredFunctions.make(impl, (api, registryItem) =>
  RegisteredConvexFunction.make(api, registryItem),
);
