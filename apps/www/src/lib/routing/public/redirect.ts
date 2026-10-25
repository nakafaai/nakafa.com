import { Schema } from "effect";

const PublicRedirectSchema = Schema.Struct({
  destination: Schema.String,
  status: Schema.Literals([307, 308]),
});
/**
 * The answer to one retired public URL: the pathname that the client is sent
 * to, and the status that says whether that answer can change later.
 */
type PublicRedirect = typeof PublicRedirectSchema.Type;

/**
 * Answers with a permanent redirect (308) to a successor that does not change,
 * such as a renamed section, a localized exam page, or a localized set.
 */
export function permanentRedirect(destination: string): PublicRedirect {
  return { destination, status: 308 };
}

/**
 * Answers with a temporary redirect (307) to a successor that a newer
 * publication can replace, such as the newest live year track of a track-less
 * URL.
 */
export function temporaryRedirect(destination: string): PublicRedirect {
  return { destination, status: 307 };
}
