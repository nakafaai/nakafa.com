const TRYOUT_CORPUS_ROOT = "packages/corpus/";

/** Returns the canonical Aksara corpus path for one retained try-out source. */
export function toTryoutCorpusPath(sourcePath: string) {
  if (sourcePath.startsWith(TRYOUT_CORPUS_ROOT)) {
    return sourcePath;
  }

  return `${TRYOUT_CORPUS_ROOT}${sourcePath}`;
}
