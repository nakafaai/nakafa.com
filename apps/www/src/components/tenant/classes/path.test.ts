import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option, Schema } from "effect";
import { classPath } from "@/components/tenant/classes/path";

const slug = Schema.decodeSync(TenantSlug)("harapan");
const root = {
  classSlug: "fisika-x-1",
  forum: "Forum",
  name: "Fisika X-1",
  slug,
  tasks: "Tasks",
};
const channelId = Schema.decodeUnknownSync(Id("classroomChannels"))("umum");
const channel = Option.some({ id: channelId, label: "Umum" });
const none = Option.none();

describe("class page path", () => {
  it("names the tasks after the class, and a task's title after a link to the tasks", () => {
    expect(
      Arr.map(
        classPath({ _tag: "tasks" }, root, none, none),
        (item) => item.label
      )
    ).toEqual(["Fisika X-1", "Tasks"]);
    const task = classPath(
      { _tag: "task", task: "latihan" },
      root,
      none,
      Option.some("Latihan")
    );
    expect(Arr.map(task, (item) => item.label)).toEqual([
      "Fisika X-1",
      "Tasks",
      "Latihan",
    ]);
    expect(Arr.get(task, 1).pipe(Option.map((item) => item.target))).toEqual(
      Option.some(
        expect.objectContaining({
          to: "/school/$slug/classes/$classSlug/tasks",
        })
      )
    );
  });

  it("names the class alone on its home, and the forum after it on the channel list", () => {
    expect(classPath({ _tag: "home" }, root, none, none)).toEqual([
      { label: "Fisika X-1" },
    ]);
    expect(
      Arr.map(
        classPath({ _tag: "forum" }, root, none, none),
        (item) => item.label
      )
    ).toEqual(["Fisika X-1", "Forum"]);
  });

  it("ends a channel with its name once it is known, and the forum before that", () => {
    const view = { _tag: "channel" as const, channelId, jump: Option.none() };
    expect(
      Arr.map(classPath(view, root, none, none), (item) => item.label)
    ).toEqual(["Fisika X-1", "Forum"]);
    expect(Arr.last(classPath(view, root, channel, none))).toEqual(
      Option.some({ label: "Umum" })
    );
  });

  it("ends a discussion with its title after a link to its channel", () => {
    const view = {
      _tag: "discussion" as const,
      jump: Option.none(),
      number: 12,
    };
    const path = classPath(view, root, channel, Option.some("#12 Gaya gesek"));
    expect(Arr.map(path, (item) => item.label)).toEqual([
      "Fisika X-1",
      "Forum",
      "Umum",
      "#12 Gaya gesek",
    ]);
    expect(path[2]?.target).toEqual(
      expect.objectContaining({ search: { channel: channelId } })
    );
    expect(
      Arr.map(classPath(view, root, none, none), (item) => item.label)
    ).toEqual(["Fisika X-1", "Forum"]);
  });
});
