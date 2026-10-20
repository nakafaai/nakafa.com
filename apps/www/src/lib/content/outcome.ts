/**
 * Tags one outcome of a content read. The tag is a literal type, so a match on
 * the outcome narrows every case, and the outcome stays plain data.
 */
export const outcome = <const Tag extends string, Fields extends object>(
  tag: Tag,
  fields: Fields
) => ({ _tag: tag, ...fields });
