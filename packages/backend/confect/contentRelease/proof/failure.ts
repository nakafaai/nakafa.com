import {
  ArtifactPayloadFieldByteLimitError,
  ArtifactRendererComponentMissingError,
  ArtifactVerificationByteLimitError,
} from "@nakafa/aksara-contracts/artifact/spec";
import {
  PublicKeyParseError,
  PublicKeyTypeError,
  SigningKeyNotFoundError,
  SigningKeyResolutionError,
} from "@nakafa/aksara-contracts/signature/spec";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { Predicate, Schema } from "effect";

/** Recognizes exact contract errors caused by unsupported trust or rendering. */
function isUnsupported(error: unknown) {
  return (
    Schema.is(SigningKeyNotFoundError)(error) ||
    Schema.is(SigningKeyResolutionError)(error) ||
    Schema.is(PublicKeyParseError)(error) ||
    Schema.is(PublicKeyTypeError)(error) ||
    Schema.is(ArtifactRendererComponentMissingError)(error)
  );
}

/** Recognizes exact shared-contract size failures without tag heuristics. */
function isSize(error: unknown) {
  return (
    Schema.is(ArtifactVerificationByteLimitError)(error) ||
    Schema.is(ArtifactPayloadFieldByteLimitError)(error)
  );
}

/** Reads the concrete contract failure tag from unknown thrown values. */
function readContractTag(error: unknown) {
  if (!(Predicate.isObject(error) && Predicate.hasProperty(error, "_tag"))) {
    return "UnknownContractError";
  }
  const { _tag } = error;
  return Predicate.isString(_tag) ? _tag : "UnknownContractError";
}

/** Maps one concrete Aksara contract failure into publication semantics. */
export function contractFailure(error: unknown) {
  if (Schema.is(ReleaseError)(error)) {
    return error;
  }
  let code: ReleaseError["code"] = "CONTENT_RELEASE_INTEGRITY";
  if (isUnsupported(error)) {
    code = "CONTENT_RELEASE_UNSUPPORTED";
  } else if (isSize(error)) {
    code = "CONTENT_RELEASE_SIZE";
  }
  return new ReleaseError({
    code,
    message: `Content release verification failed with ${readContractTag(error)}.`,
  });
}
