import { GroupSpec, Refs, Spec } from "@confect/core";
import integrations_clients from "../../integrations/clients.spec";

const spec: Spec.Spec<{
  readonly integrations: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "integrations", never, GroupSpec.NamedAt<typeof integrations_clients, "clients">>, "integrations">;
}> = Spec.make().addAt("integrations", GroupSpec.makeAt("integrations").addGroupAt("clients", integrations_clients));

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.integrations;
