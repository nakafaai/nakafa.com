/** Maps math item labels to stable translation keys. */
export function getItemLabelKey(label: string) {
  switch (label) {
    case "algebraic_multiplicity":
      return "math-item-algebraic-multiplicity";
    case "approximation":
      return "math-item-approximation";
    case "counterexample":
      return "math-item-counterexample";
    case "diagonalizable":
      return "math-item-diagonalizable";
    case "domain":
      return "math-item-domain";
    case "eigenbasis":
      return "math-item-eigenbasis";
    case "eigenvalue":
      return "math-item-eigenvalue";
    case "eigenvector":
      return "math-item-eigenvector";
    case "factor":
      return "math-item-factor";
    case "geometric_multiplicity":
      return "math-item-geometric-multiplicity";
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
    case "singularity":
      return "math-item-singularity";
    case "status":
      return "math-item-status";
    default:
      return "math-item-result";
  }
}

/** Maps semantic math item values to localized display text. */
export function getItemValueKey(label: string, value: string) {
  if (label === "diagonalizable") {
    switch (value) {
      case "false":
        return "math-value-no";
      case "true":
        return "math-value-yes";
      default:
        return;
    }
  }

  if (label === "status") {
    switch (value) {
      case "divergent":
        return "math-value-divergent";
      default:
        return;
    }
  }
}
