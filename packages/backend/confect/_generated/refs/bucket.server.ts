import { GroupSpec, Refs, Spec } from "@confect/core";
import bucket from "../../bucket.spec";

const spec: Spec.Spec<{
  readonly bucket: GroupSpec.NamedAt<typeof bucket, "bucket">;
}> = Spec.fromGroups({ ["bucket"]: bucket }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.bucket;
