/** Return whether a new read boundary sequence is strictly newer. */
export function shouldAdvanceForumReadBoundary({
  existingLastReadSequence,
  nextLastReadSequence,
}: {
  existingLastReadSequence: number;
  nextLastReadSequence: number;
}) {
  return nextLastReadSequence > existingLastReadSequence;
}
