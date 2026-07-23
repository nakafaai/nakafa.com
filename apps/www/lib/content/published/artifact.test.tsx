// @vitest-environment node

import { Buffer } from "node:buffer";
import {
  createHash,
  generateKeyPairSync,
  sign as signBytes,
} from "node:crypto";
import { readFile } from "node:fs/promises";
import { compile } from "@mdx-js/mdx";
import {
  CompiledContentPayloadSchema,
  type ContentLocale,
  canonicalizeCompiledContentPayload,
  canonicalizeContentArtifactSigningInput,
  SignedContentArtifactSchema,
} from "@nakafa/aksara-contracts/content";
import {
  ContentKeySchema,
  Ed25519SignatureSchema,
  Sha256HashSchema,
  SigningKeyIdSchema,
} from "@nakafa/aksara-contracts/ids";
import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import {
  ContentVerificationKeyResolver,
  SigningKeyNotFoundError,
} from "@nakafa/aksara-contracts/signature/spec";
import { chemistryComponents } from "@repo/design-system/lib/markdown/domain/chemistry";
import { mathematicsComponents } from "@repo/design-system/lib/markdown/domain/mathematics";
import type { MDXComponents } from "@repo/design-system/types/markdown";
import { Effect } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { executeSignedArtifact } from "@/lib/content/published/artifact";
import { rendererManifest } from "@/lib/content/renderer/manifest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/internationalization/src/navigation", () => ({
  getPathname: vi.fn(),
  Link: vi.fn(),
  redirect: vi.fn(),
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}));
vi.mock("next-intl", () => ({
  /** Keeps artifact execution independent from navigation runtime behavior. */
  useTranslations: () => () => "",
}));

const keyId = SigningKeyIdSchema.make("runtime-test-key");
const signingKeys = generateKeyPairSync("ed25519");
const publicKey = signingKeys.publicKey
  .export({ format: "pem", type: "spki" })
  .toString();
const manifest = await Effect.runPromise(rendererManifest);
const resolver = ContentVerificationKeyResolver.of({
  /** Resolves only the test key used to sign this exact artifact. */
  resolve: (requestedKeyId) =>
    requestedKeyId === keyId
      ? Effect.succeed(publicKey)
      : Effect.fail(new SigningKeyNotFoundError({ keyId: requestedKeyId })),
});
const functionConceptRoot = new URL(
  "../../../../../packages/contents/material/lesson/mathematics/function-composition-inverse-function/function-concept/",
  import.meta.url
);
const atomShellRoot = new URL(
  "../../../../../packages/contents/material/lesson/chemistry/structure-matter/atom-shell/",
  import.meta.url
);
const functionMachineImport =
  'import { FunctionMachine } from "@repo/design-system/components/contents/mathematics/function-machine";\n\n';
const atomShellImport =
  'import { AtomShellLab } from "@repo/design-system/components/contents/chemistry/atom-shell/lab";\n\n';
const functionConceptRequirements = [
  { name: "FunctionMachine", version: 1 },
  { name: "InlineMath", version: 1 },
] as const;
const atomShellRequirements = [
  { name: "AtomShellLab", version: 1 },
  { name: "BlockMath", version: 1 },
  { name: "InlineMath", version: 1 },
] as const;

interface ArtifactDocument {
  readonly contentKey: string;
  readonly rendererDomain: Extract<RendererDomain, "chemistry" | "mathematics">;
}

const functionConceptDocument: ArtifactDocument = {
  contentKey:
    "material/lesson/mathematics/function-composition-inverse-function/function-concept",
  rendererDomain: "mathematics",
};
const atomShellDocument: ArtifactDocument = {
  contentKey: "material/lesson/chemistry/structure-matter/atom-shell",
  rendererDomain: "chemistry",
};

/** Hashes UTF-8 text with the canonical Aksara wire prefix. */
function hash(value: string) {
  return Sha256HashSchema.make(
    `sha256:${createHash("sha256").update(value).digest("hex")}`
  );
}

/** Signs one exact payload with the test-only Ed25519 key. */
function signArtifact(
  compiledCode: string,
  rawMdx: string,
  requiredComponents: readonly { readonly name: string; readonly version: 1 }[],
  locale: ContentLocale = "en",
  document: ArtifactDocument = functionConceptDocument
) {
  const payload = CompiledContentPayloadSchema.make({
    byteLength: Buffer.byteLength(compiledCode, "utf8"),
    compiledCode,
    compilerConfigHash: hash("runtime-test-config"),
    compilerVersion: "0.1.0",
    contentKey: ContentKeySchema.make(document.contentKey),
    format: "mdx-function-body-v1",
    locale,
    mdxCompilerVersion: "3.1.1",
    plainText: rawMdx,
    rawMdx,
    rendererDomain: document.rendererDomain,
    requiredComponents,
    sourceHash: hash(rawMdx),
  });
  const artifactHash = hash(canonicalizeCompiledContentPayload(payload));
  const signature = Ed25519SignatureSchema.make(
    signBytes(
      null,
      Buffer.from(
        canonicalizeContentArtifactSigningInput(artifactHash, payload),
        "utf8"
      ),
      signingKeys.privateKey
    ).toString("base64url")
  );
  return SignedContentArtifactSchema.make({
    artifactHash,
    keyId,
    payload,
    signature,
  });
}

/** Reads actual lesson MDX after removing its normalized registry import. */
async function readImportFreeMdx(
  root: URL,
  normalizedImport: string,
  locale: ContentLocale
) {
  const source = await readFile(new URL(`${locale}.mdx`, root), "utf8");

  expect(source.startsWith(normalizedImport)).toBe(true);

  return source.slice(normalizedImport.length);
}

/** Runs one artifact through the trusted test key boundary. */
function execute(
  artifact: unknown,
  components: MDXComponents = mathematicsComponents
) {
  return executeSignedArtifact({
    artifact,
    components,
    rendererContractVersion: manifest.rendererContractVersion,
    rendererManifest: manifest,
  }).pipe(Effect.provideService(ContentVerificationKeyResolver, resolver));
}

describe("published content artifact execution", () => {
  it.each([
    ["en", "What is a Function?", "Function Machine", "Function machine input"],
    ["id", "Apa Itu Fungsi?", "Mesin Fungsi", "Masukan mesin fungsi"],
  ] as const)("compiles and executes the actual %s Function Concept source", async (locale, heading, machineTitle, inputLabel) => {
    const rawMdx = await readImportFreeMdx(
      functionConceptRoot,
      functionMachineImport,
      locale
    );
    const compiledCode = String(
      await compile(rawMdx, {
        development: false,
        outputFormat: "function-body",
        providerImportSource: "nakafa-static-renderer-registry",
      })
    );
    const artifact = signArtifact(
      compiledCode,
      rawMdx,
      functionConceptRequirements,
      locale
    );
    const content = await Effect.runPromise(execute(artifact));
    const markup = renderToStaticMarkup(<content.Content />);

    expect(content.artifact).toEqual(artifact);
    expect(markup).toContain(heading);
    expect(markup).toContain(machineTitle);
    expect(markup).toContain(inputLabel);
    expect(markup).toContain("f(x)");
  });

  it.each([
    ["en", "Shells as Energy Levels", "Atomic Shell Model"],
    ["id", "Kulit Atom sebagai Tingkat Energi", "Model Kulit Atom"],
  ] as const)("compiles and executes the actual %s Atom Shell source", async (locale, heading, labTitle) => {
    const rawMdx = await readImportFreeMdx(
      atomShellRoot,
      atomShellImport,
      locale
    );
    const compiledCode = String(
      await compile(rawMdx, {
        development: false,
        outputFormat: "function-body",
        providerImportSource: "nakafa-static-renderer-registry",
      })
    );
    const artifact = signArtifact(
      compiledCode,
      rawMdx,
      atomShellRequirements,
      locale,
      atomShellDocument
    );
    const content = await Effect.runPromise(
      execute(artifact, chemistryComponents)
    );
    const markup = renderToStaticMarkup(<content.Content />);

    expect(content.artifact).toEqual(artifact);
    expect(markup).toContain(heading);
    expect(markup).toContain(labTitle);
    expect(markup).toContain("2n");
  });

  it("maps evaluation and invalid module results to typed failures", async () => {
    const evaluate = signArtifact(
      'throw new Error("unreachable detail")',
      "",
      []
    );
    const module = signArtifact("return { default: 1 }", "", []);
    const errors = await Promise.all([
      Effect.runPromise(execute(evaluate).pipe(Effect.flip)),
      Effect.runPromise(execute(module).pipe(Effect.flip)),
    ]);

    expect(errors).toMatchObject([
      { _tag: "ContentExecutionError", stage: "evaluate" },
      { _tag: "ContentExecutionError", stage: "module" },
    ]);
  });

  it("preserves verification failures before evaluating artifact code", async () => {
    const artifact = signArtifact("return { default: () => null }", "", []);
    const error = await Effect.runPromise(
      execute({ ...artifact, artifactHash: hash("different") }).pipe(
        Effect.flip
      )
    );

    expect(error._tag).toBe("ArtifactHashMismatchError");
  });
});
