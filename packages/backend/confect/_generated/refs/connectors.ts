import { GroupSpec, Refs, Spec } from "@confect/core";
import connectors_classroom from "../../connectors/classroom.spec";
import connectors_connections from "../../connectors/connections.spec";
import connectors_drive from "../../connectors/drive.spec";
import connectors_google from "../../connectors/google.spec";

const spec: Spec.Spec<{
  readonly connectors: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "connectors", never, GroupSpec.NamedAt<typeof connectors_classroom, "classroom"> | GroupSpec.NamedAt<typeof connectors_connections, "connections"> | GroupSpec.NamedAt<typeof connectors_drive, "drive"> | GroupSpec.NamedAt<typeof connectors_google, "google">>, "connectors">;
}> = Spec.fromGroups({ ["connectors"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["classroom"]: connectors_classroom, ["connections"]: connectors_connections, ["drive"]: connectors_drive, ["google"]: connectors_google }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.connectors;
