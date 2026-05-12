import {
  AbacusIcon,
  ApproximatelyEqualIcon,
  ArrangeByNumbersOneNineIcon,
  ArrowDataTransferDiagonalIcon,
  ArrowDataTransferHorizontalIcon,
  ArrowExpand02Icon,
  CalculateIcon,
  CancelCircleIcon,
  ChartAverageIcon,
  ChartBarLineIcon,
  ChartEvaluationIcon,
  ChartHistogramIcon,
  ChartLineData01Icon,
  ChartMaximumIcon,
  ChartMediumIcon,
  CircleIcon,
  CongruentToCircleIcon,
  Coordinate01Icon,
  DiceFacesIcon,
  DiceIcon,
  DistributionIcon,
  DivideSignCircleIcon,
  FunctionCircleIcon,
  FunctionOfXIcon,
  FunctionSquareIcon,
  GridTableIcon,
  GroupIcon,
  GroupItemsIcon,
  HierarchySquare03Icon,
  Infinity01Icon,
  LineIcon,
  MatrixIcon,
  MultiplicationSignCircleIcon,
  MultiplicationSignSquareIcon,
  NThRootIcon,
  PathfinderIntersectIcon,
  PiCircleIcon,
  PiIcon,
  PlusMinusCircle01Icon,
  RankingIcon,
  RootCircleIcon,
  RulerIcon,
  SecondBracketIcon,
  SquareRootSquareIcon,
  Summation01Icon,
  SummationCircleIcon,
  TextNumberSignIcon,
  TriangleIcon,
  UngroupItemsIcon,
  XVariableSquareIcon,
} from "@hugeicons/core-free-icons";
import type { MathOperation } from "@repo/math/schema";

/** Selects the math-specific icon for each operation group. */
export function getMathIcon(operation: MathOperation) {
  switch (operation) {
    case "evaluate":
      return CalculateIcon;
    case "simplify":
      return ApproximatelyEqualIcon;
    case "factor":
      return SecondBracketIcon;
    case "expand":
      return ArrowExpand02Icon;
    case "cancel":
      return CancelCircleIcon;
    case "together":
      return GroupItemsIcon;
    case "apart":
      return UngroupItemsIcon;
    case "rationalize":
      return SquareRootSquareIcon;
    case "domain":
      return XVariableSquareIcon;
    case "compare":
      return CongruentToCircleIcon;
    case "solve":
      return RootCircleIcon;
    case "roots":
      return NThRootIcon;
    case "differentiate":
      return FunctionOfXIcon;
    case "integrate":
      return FunctionCircleIcon;
    case "limit":
      return Infinity01Icon;
    case "series":
      return SummationCircleIcon;
    case "summation":
      return Summation01Icon;
    case "product":
      return MultiplicationSignCircleIcon;
    case "determinant":
      return MatrixIcon;
    case "inverse":
      return ArrowDataTransferHorizontalIcon;
    case "rank":
      return RankingIcon;
    case "rref":
      return GridTableIcon;
    case "eigenvalues":
      return FunctionSquareIcon;
    case "eigenvectors":
      return ArrowDataTransferDiagonalIcon;
    case "linear_system":
      return HierarchySquare03Icon;
    case "matrix_multiply":
      return MultiplicationSignSquareIcon;
    case "mean":
      return ChartAverageIcon;
    case "median":
      return ChartMediumIcon;
    case "mode":
      return ChartMaximumIcon;
    case "quartiles":
      return ChartHistogramIcon;
    case "standard_deviation":
      return ChartLineData01Icon;
    case "variance":
      return ChartBarLineIcon;
    case "z_score":
      return ChartEvaluationIcon;
    case "distribution":
      return DistributionIcon;
    case "expected_value":
      return DiceIcon;
    case "variance_probability":
      return DiceFacesIcon;
    case "circle":
      return CircleIcon;
    case "distance":
      return RulerIcon;
    case "intersection":
      return PathfinderIntersectIcon;
    case "line":
      return LineIcon;
    case "midpoint":
      return Coordinate01Icon;
    case "slope":
      return TriangleIcon;
    case "combination":
      return GroupIcon;
    case "permutation":
      return ArrangeByNumbersOneNineIcon;
    case "gcd":
      return AbacusIcon;
    case "lcm":
      return PlusMinusCircle01Icon;
    case "is_prime":
      return PiIcon;
    case "modular":
      return DivideSignCircleIcon;
    case "prime_factorization":
      return TextNumberSignIcon;
    default:
      return PiCircleIcon;
  }
}
