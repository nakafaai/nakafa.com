/** Maps math item labels to stable translation keys. */
export function getItemLabelKey(label: string) {
  switch (label) {
    case "approximation":
      return "math-item-approximation";
    case "counterexample":
      return "math-item-counterexample";
    case "domain":
      return "math-item-domain";
    case "eigenvalue":
      return "math-item-eigenvalue";
    case "eigenvector":
      return "math-item-eigenvector";
    case "factor":
      return "math-item-factor";
    case "mode":
      return "math-item-mode";
    case "q1":
      return "math-item-q1";
    case "q2":
      return "math-item-q2";
    case "q3":
      return "math-item-q3";
    case "root":
      return "math-item-root";
    case "solution":
      return "math-item-solution";
    default:
      return "math-item-result";
  }
}
