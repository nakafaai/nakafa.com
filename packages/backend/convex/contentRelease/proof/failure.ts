import {
  ArtifactPayloadFieldByteLimitError,
  ArtifactRendererComponentMissingError,
  ArtifactRendererVersionUnsupportedError,
  ArtifactVerificationByteLimitError,
  RendererContractVersionMismatchError,
} from "@nakafa/aksara-contracts/artifact/spec";
import {
  PublicKeyParseError,
  PublicKeyTypeError,
  SigningKeyNotFoundError,
  SigningKeyResolutionError,
} from "@nakafa/aksara-contracts/signature/spec";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";

/** Recognizes exact contract errors caused by unsupported trust or rendering. */
function isUnsupported(error: unknown) {
  return (
    error instanceof SigningKeyNotFoundError ||
    error instanceof SigningKeyResolutionError ||
    error instanceof PublicKeyParseError ||
    error instanceof PublicKeyTypeError ||
    error instanceof RendererContractVersionMismatchError ||
    error instanceof ArtifactRendererComponentMissingError ||
    error instanceof ArtifactRendererVersionUnsupportedError
  );
}

/** Recognizes exact shared-contract size failures without tag heuristics. */
function isSize(error: unknown) {
  return (
    error instanceof ArtifactVerificationByteLimitError ||
    error instanceof ArtifactPayloadFieldByteLimitError
  );
}

/** Maps one concrete Aksara contract failure into publication semantics. */
export function contractFailure(error: unknown) {
  let code: ReleaseError["code"] = "CONTENT_RELEASE_INTEGRITY";
  if (isUnsupported(error)) {
    code = "CONTENT_RELEASE_UNSUPPORTED";
  } else if (isSize(error)) {
    code = "CONTENT_RELEASE_SIZE";
  }
  const tag =
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    typeof error._tag === "string"
      ? error._tag
      : "UnknownContractError";
  return new ReleaseError({
    code,
    message: `Content release verification failed with ${tag}.`,
  });
}
