import { GroupSpec, Refs, Spec } from "@confect/core";
import consents_current from "../../consents/current.spec";

const spec: Spec.Spec<{
  readonly consents: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "consents", never, GroupSpec.NamedAt<typeof consents_current, "current">>, "consents">;
}> = Spec.make().addAt("consents", GroupSpec.makeAt("consents").addGroupAt("current", consents_current));

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.consents;
