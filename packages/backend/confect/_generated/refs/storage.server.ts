import { GroupSpec, Refs, Spec } from "@confect/core";
import storage from "../../storage.spec";

const spec: Spec.Spec<{
  readonly storage: GroupSpec.NamedAt<typeof storage, "storage">;
}> = Spec.fromGroups({ ["storage"]: storage }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.storage;
