import { describe, expect, it } from "@effect/vitest";
import { renderDomainModule } from "@repo/backend/scripts/refs/render";

describe("renderDomainModule", () => {
  it("writes the spec type and assembly that Confect writes for the leaves of a domain", () => {
    const module = renderDomainModule("nina", [
      {
        localName: "nina_memory",
        segments: ["nina", "memory"],
        specifier: "../nina/memory.spec",
      },
      {
        localName: "nina_reply_stream",
        segments: ["nina", "reply", "stream"],
        specifier: "../nina/reply/stream.spec",
      },
      {
        localName: "nina_lifecycle",
        segments: ["nina", "lifecycle"],
        specifier: "../nina/lifecycle.spec",
      },
      {
        localName: "nina_lifecycle_cancel",
        segments: ["nina", "lifecycle", "cancel"],
        specifier: "../nina/lifecycle/cancel.spec",
      },
    ]);

    expect(module).toBe(
      [
        `import { GroupSpec, Refs, Spec } from "@confect/core";`,
        `import nina_lifecycle from "../../nina/lifecycle.spec";`,
        `import nina_lifecycle_cancel from "../../nina/lifecycle/cancel.spec";`,
        `import nina_memory from "../../nina/memory.spec";`,
        `import nina_reply_stream from "../../nina/reply/stream.spec";`,
        "",
        "const spec: Spec.Spec<{",
        `  readonly nina: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "nina", never, GroupSpec.NamedAt<GroupSpec.AddGroups<typeof nina_lifecycle, GroupSpec.NamedAt<typeof nina_lifecycle_cancel, "cancel">>, "lifecycle"> | GroupSpec.NamedAt<typeof nina_memory, "memory"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "reply", never, GroupSpec.NamedAt<typeof nina_reply_stream, "stream">>, "reply">>, "nina">;`,
        `}> = Spec.make().addAt("nina", GroupSpec.makeAt("nina").addGroupAt("lifecycle", nina_lifecycle.addGroupAt("cancel", nina_lifecycle_cancel)).addGroupAt("memory", nina_memory).addGroupAt("reply", GroupSpec.makeAt("reply").addGroupAt("stream", nina_reply_stream)));`,
        "",
        "const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);",
        "",
        "export default refs.public.nina;",
        "",
      ].join("\n")
    );
  });

  it("writes a domain whose only leaf is the domain itself", () => {
    const module = renderDomainModule("storage", [
      {
        localName: "storage",
        segments: ["storage"],
        specifier: "../storage.spec",
      },
    ]);

    expect(module).toBe(
      [
        `import { GroupSpec, Refs, Spec } from "@confect/core";`,
        `import storage from "../../storage.spec";`,
        "",
        "const spec: Spec.Spec<{",
        `  readonly storage: GroupSpec.NamedAt<typeof storage, "storage">;`,
        `}> = Spec.make().addAt("storage", storage);`,
        "",
        "const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);",
        "",
        "export default refs.public.storage;",
        "",
      ].join("\n")
    );
  });
});
