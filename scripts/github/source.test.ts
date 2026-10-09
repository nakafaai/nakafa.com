import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, FileSystem, Path, Record as Rec } from "effect";
import {
  inspectGithubActionPolicy,
  readCompositeActionUses,
  readWorkflowActionUses,
} from "#scripts/github/source";

/** Creates a repository root whose workflow directory holds the given files. */
const makeWorkflows = Effect.fn("GithubSourceTest.makeWorkflows")(function* (
  files: Record<string, string>
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const root = yield* fileSystem.makeTempDirectoryScoped({
    prefix: "github-policy-",
  });
  yield* fileSystem.makeDirectory(`${root}/.github/workflows`, {
    recursive: true,
  });
  for (const [file, content] of Rec.toEntries(files)) {
    yield* fileSystem.writeFileString(
      `${root}/.github/workflows/${file}`,
      content
    );
  }
  return root;
});

/** Creates a repository root whose .github folder holds the given files, keyed by their path under .github. */
const makeGithubTree = Effect.fn("GithubSourceTest.makeGithubTree")(function* (
  files: Record<string, string>
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fileSystem.makeTempDirectoryScoped({
    prefix: "github-policy-tree-",
  });
  for (const [file, content] of Rec.toEntries(files)) {
    const target = path.join(root, ".github", file);
    yield* fileSystem.makeDirectory(path.dirname(target), { recursive: true });
    yield* fileSystem.writeFileString(target, content);
  }
  return root;
});

describe("GitHub Action sources", () => {
  it.effect("reads action uses from every workflow file", () =>
    Effect.gen(function* () {
      const root = yield* makeWorkflows({
        "README.md": "uses: example/ignored@0123456789abcdef\n",
        "ci.yml": Arr.join(
          [
            "jobs:",
            "  build:",
            "    steps:",
            "      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
            "      - uses: ./.github/actions/local",
            "      - uses: pnpm/setup@84cb39b217b10273981911c288cd62326dc7c6d2",
            "        with:",
            "          cache: true",
            "",
          ],
          "\n"
        ),
        "release.yaml":
          "jobs:\n  release:\n    uses: example/reusable/.github/workflows/release.yml@main\n",
      });

      expect(yield* readWorkflowActionUses(root)).toEqual([
        {
          inputs: {},
          reference:
            "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
          workflowPath: ".github/workflows/ci.yml",
        },
        {
          inputs: {},
          reference: "./.github/actions/local",
          workflowPath: ".github/workflows/ci.yml",
        },
        {
          inputs: { cache: true },
          reference: "pnpm/setup@84cb39b217b10273981911c288cd62326dc7c6d2",
          workflowPath: ".github/workflows/ci.yml",
        },
        {
          inputs: {},
          reference: "example/reusable/.github/workflows/release.yml@main",
          workflowPath: ".github/workflows/release.yaml",
        },
      ]);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("reports workflows it cannot read or decode", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const missing = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "github-policy-missing-",
      });
      const unreadable = yield* makeWorkflows({});
      yield* fileSystem.makeDirectory(
        `${unreadable}/.github/workflows/broken.yml`
      );
      const invalid = yield* makeWorkflows({ "invalid.yml": "jobs: [\n" });

      const problems = yield* Effect.forEach(
        [missing, unreadable, invalid],
        inspectGithubActionPolicy
      );
      expect(Arr.flatten(problems)).toEqual([
        "Unable to inspect GitHub Actions: Unable to read GitHub workflow files.",
        "Unable to inspect GitHub Actions: Unable to read .github/workflows/broken.yml.",
        "Unable to inspect GitHub Actions: Unable to decode .github/workflows/invalid.yml.",
      ]);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("reads action uses from every composite action", () =>
    Effect.gen(function* () {
      const root = yield* makeGithubTree({
        "actions/README.md": "uses: example/ignored@0123456789abcdef\n",
        "actions/install/action.yml": Arr.join(
          [
            "runs:",
            "  using: composite",
            "  steps:",
            "    - uses: pnpm/setup@84cb39b217b10273981911c288cd62326dc7c6d2",
            "      with:",
            "        cache: false",
            "    - uses: ./.github/actions/local",
            "    - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
            "",
          ],
          "\n"
        ),
        "actions/nested/tool/action.yaml":
          "runs:\n  using: composite\n  steps:\n    - uses: example/tool@0123456789abcdef\n",
        "workflows/ci.yml":
          "jobs:\n  build:\n    steps:\n      - uses: example/workflow@0123456789abcdef\n",
      });

      expect(yield* readCompositeActionUses(root)).toEqual([
        {
          inputs: { cache: false },
          reference: "pnpm/setup@84cb39b217b10273981911c288cd62326dc7c6d2",
          workflowPath: ".github/actions/install/action.yml",
        },
        {
          inputs: {},
          reference: "./.github/actions/local",
          workflowPath: ".github/actions/install/action.yml",
        },
        {
          inputs: {},
          reference:
            "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
          workflowPath: ".github/actions/install/action.yml",
        },
        {
          inputs: {},
          reference: "example/tool@0123456789abcdef",
          workflowPath: ".github/actions/nested/tool/action.yaml",
        },
      ]);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("checks composite action uses against the same reviews", () =>
    Effect.gen(function* () {
      const root = yield* makeGithubTree({
        "actions/install/action.yml": Arr.join(
          [
            "runs:",
            "  using: composite",
            "  steps:",
            "    - uses: pnpm/setup@0123456789abcdef0123456789abcdef01234567",
            "      with:",
            "        cache: true",
            "        install: false",
            "",
          ],
          "\n"
        ),
        "workflows/ci.yml": "jobs: {}\n",
      });

      expect(yield* inspectGithubActionPolicy(root)).toEqual(
        expect.arrayContaining([
          ".github/actions/install/action.yml pins pnpm/setup to 0123456789abcdef0123456789abcdef01234567; approved fbda4c85fc2e1e08721cd8763afea8f48d60f024.",
          ".github/actions/install/action.yml configures pnpm/setup cache as true; approved false.",
        ])
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("reports composite action files it cannot read or decode", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const unreadable = yield* makeGithubTree({
        "workflows/ci.yml": "jobs: {}\n",
      });
      yield* fileSystem.makeDirectory(
        `${unreadable}/.github/actions/broken/action.yml`,
        { recursive: true }
      );
      const invalid = yield* makeGithubTree({
        "actions/invalid/action.yml": "runs: [\n",
        "workflows/ci.yml": "jobs: {}\n",
      });

      const problems = yield* Effect.forEach(
        [unreadable, invalid],
        inspectGithubActionPolicy
      );
      expect(Arr.flatten(problems)).toEqual([
        "Unable to inspect GitHub Actions: Unable to read .github/actions/broken/action.yml.",
        "Unable to inspect GitHub Actions: Unable to decode .github/actions/invalid/action.yml.",
      ]);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("reports a .github entry that cannot list composite actions", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const root = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "github-policy-file-",
      });
      yield* fileSystem.writeFileString(`${root}/.github`, "not a folder\n");

      const failure = yield* readCompositeActionUses(root).pipe(Effect.flip);
      expect(failure.message).toBe("Unable to read GitHub action files.");
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
