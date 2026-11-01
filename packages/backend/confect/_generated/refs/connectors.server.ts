import { GroupSpec, Refs, Spec } from "@confect/core";
import connectors_classroom from "../../connectors/classroom.spec";
import connectors_drive from "../../connectors/drive.spec";
import connectors_events from "../../connectors/events.spec";
import connectors_google from "../../connectors/google.spec";
import connectors_seed from "../../connectors/seed.spec";
import connectors_sync from "../../connectors/sync.spec";

const spec: Spec.Spec<{
  readonly connectors: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "connectors", never, GroupSpec.NamedAt<typeof connectors_classroom, "classroom"> | GroupSpec.NamedAt<typeof connectors_drive, "drive"> | GroupSpec.NamedAt<typeof connectors_events, "events"> | GroupSpec.NamedAt<typeof connectors_google, "google"> | GroupSpec.NamedAt<typeof connectors_seed, "seed"> | GroupSpec.NamedAt<typeof connectors_sync, "sync">>, "connectors">;
}> = Spec.fromGroups({ ["connectors"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["classroom"]: connectors_classroom, ["drive"]: connectors_drive, ["events"]: connectors_events, ["google"]: connectors_google, ["seed"]: connectors_seed, ["sync"]: connectors_sync }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.connectors;
