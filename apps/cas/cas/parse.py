"""Safe SymPy parsing helpers for fixed CAS inputs."""

import ast
import io
import keyword
import re
import tokenize

import sympy as sp
from sympy.core.relational import Relational

from cas.schema import MathRequest, PointInput

CONSTANTS = {
    "E": sp.E,
    "e": sp.E,
    "I": sp.I,
    "oo": sp.oo,
    "pi": sp.pi,
}

CALLS = {
    "Abs": sp.Abs,
    "Rational": sp.Rational,
    "acos": sp.acos,
    "asin": sp.asin,
    "atan": sp.atan,
    "cos": sp.cos,
    "exp": sp.exp,
    "factorial": sp.factorial,
    "factorial2": sp.factorial2,
    "ln": sp.log,
    "log": sp.log,
    "sin": sp.sin,
    "sqrt": sp.sqrt,
    "tan": sp.tan,
}

IDENTIFIER_PATTERN = re.compile(r"\b[A-Za-z_]\w*\b")
FACTORIAL_ATOM_PATTERN = re.compile(r"(\b[A-Za-z_]\w*|\b\d+(?:\.\d+)?|\([^()]*\))!")
RESERVED_SYMBOL_PREFIX = "__nakafa_symbol_"
NON_MATH_CONSTANT_NAMES = {"False", "None", "True"}

ParsedSymbolSource = sp.Expr | sp.Equality | Relational


def symbol(name: str | None) -> sp.Symbol:
    """Parse one symbol name, defaulting to `x` for school algebra."""
    return sp.Symbol(name or "x")


def symbols(names: list[str]) -> list[sp.Symbol]:
    """Parse symbol names, defaulting to `x` when omitted."""
    if not names:
        return [sp.Symbol("x")]

    return [sp.Symbol(name) for name in names]


def symbol_from_expression(name: str | None, value: str | None) -> sp.Symbol:
    """Use an explicit symbol or infer the only symbol in one expression."""
    if name:
        return symbol(name)

    return _single_symbol_or_default([expression(value)])


def symbol_from_equations(
    name: str | None, values: list[str]
) -> tuple[sp.Symbol, list[sp.Expr | sp.Equality | Relational]]:
    """Use an explicit symbol or infer the only symbol in parsed equations."""
    parsed = [equation(value) for value in values]

    if name:
        return symbol(name), parsed

    return _single_symbol_or_default(parsed), parsed


def expression(value: str | None, *, evaluate: bool = True) -> sp.Expr:
    """Parse a user expression with a small math-only AST."""
    if not value:
        raise ValueError("Expression is required.")

    normalized_value, symbols = _normalize_reserved_symbols(value)

    try:
        # SymPy parse_expr evaluates generated Python code, so user-originated
        # CAS input stays behind this allowlisted AST parser instead.
        # https://docs.sympy.org/latest/modules/parsing.html#sympy.parsing.sympy_parser.parse_expr
        source = _prepare_expression_source(normalized_value)
        parsed_ast = ast.parse(source, mode="eval")
        parsed = _parse_node(parsed_ast.body, symbols, evaluate)
    except (SyntaxError, TypeError, ValueError, tokenize.TokenError) as error:
        raise ValueError("Expression could not be parsed.") from error

    if not isinstance(parsed, sp.Expr):
        raise ValueError("Expression must be one mathematical value.")

    return parsed


def _prepare_expression_source(value: str) -> str:
    """Normalize math shorthand before Python parses the expression AST."""
    with_factorials = _replace_factorial_notation(value.strip())
    with_powers = with_factorials.replace("^", "**")

    return _insert_implicit_multiplication(with_powers)


def _replace_factorial_notation(value: str) -> str:
    """Convert postfix factorial shorthand into an explicit safe call."""
    current = value

    while True:
        updated = FACTORIAL_ATOM_PATTERN.sub(r"factorial(\1)", current)
        if updated == current:
            break

        current = updated

    if "!" in current:
        raise ValueError("Factorial notation could not be parsed.")

    return current


def _insert_implicit_multiplication(value: str) -> str:
    """Support compact school notation such as `2x` and `x y`."""
    tokens = [
        token
        for token in tokenize.generate_tokens(io.StringIO(value).readline)
        if token.type
        not in {
            tokenize.ENCODING,
            tokenize.ENDMARKER,
            tokenize.NEWLINE,
            tokenize.NL,
        }
    ]
    pieces: list[str] = []
    previous: tokenize.TokenInfo | None = None

    for token in tokens:
        if previous and _needs_multiplication(previous, token):
            pieces.append("*")

        pieces.append(token.string)
        previous = token

    return "".join(pieces)


def _needs_multiplication(left: tokenize.TokenInfo, right: tokenize.TokenInfo) -> bool:
    """Detect adjacent expression tokens that mean multiplication."""
    if _is_call_prefix(left, right):
        return False

    return _ends_expression(left) and _starts_expression(right)


def _is_call_prefix(left: tokenize.TokenInfo, right: tokenize.TokenInfo) -> bool:
    """Keep real function calls intact while allowing constant multiplication."""
    if left.type != tokenize.NAME or right.string != "(":
        return False

    return left.string not in CONSTANTS


def _ends_expression(token: tokenize.TokenInfo) -> bool:
    """Return whether a token can end one expression."""
    return token.type in {tokenize.NAME, tokenize.NUMBER} or token.string == ")"


def _starts_expression(token: tokenize.TokenInfo) -> bool:
    """Return whether a token can start the next expression."""
    return token.type in {tokenize.NAME, tokenize.NUMBER} or token.string == "("


def _parse_node(node: ast.AST, symbols: dict[str, sp.Symbol], evaluate: bool) -> object:
    """Build SymPy values from an allowlisted Python expression AST."""
    if isinstance(node, ast.Constant):
        return _parse_constant(node.value)

    if isinstance(node, ast.Name):
        return _parse_name(node.id, symbols)

    if isinstance(node, ast.BinOp):
        return _parse_binary_operation(node, symbols, evaluate)

    if isinstance(node, ast.UnaryOp):
        return _parse_unary_operation(node, symbols, evaluate)

    if isinstance(node, ast.Call):
        return _parse_call(node, symbols, evaluate)

    if isinstance(node, ast.Tuple):
        return tuple(_parse_node(item, symbols, evaluate) for item in node.elts)

    raise ValueError("Expression node is not allowed.")


def _parse_expression_node(
    node: ast.AST, symbols: dict[str, sp.Symbol], evaluate: bool
) -> sp.Expr:
    """Parse a node that must produce one mathematical expression."""
    parsed = _parse_node(node, symbols, evaluate)

    if isinstance(parsed, sp.Expr):
        return parsed

    raise ValueError("Expression node must be mathematical.")


def _parse_constant(value: object) -> sp.Expr:
    """Parse one numeric literal."""
    if isinstance(value, bool):
        raise ValueError("Boolean values are not mathematical expressions.")

    if isinstance(value, int):
        return sp.Integer(value)

    if isinstance(value, float):
        return sp.Float(value)

    raise ValueError("Only numeric literals are allowed.")


def _parse_name(name: str, symbols: dict[str, sp.Symbol]) -> sp.Expr:
    """Parse a constant or symbol name."""
    if name in symbols:
        return symbols[name]

    if name in CONSTANTS:
        return CONSTANTS[name]

    if name.startswith("__"):
        raise ValueError("Private names are not mathematical symbols.")

    if name in CALLS:
        raise ValueError("Function names require explicit arguments.")

    return sp.Symbol(name)


def _parse_binary_operation(
    node: ast.BinOp, symbols: dict[str, sp.Symbol], evaluate: bool
) -> sp.Expr:
    """Parse arithmetic binary operators."""
    left = _parse_expression_node(node.left, symbols, evaluate)
    right = _parse_expression_node(node.right, symbols, evaluate)

    if isinstance(node.op, ast.Add):
        return sp.Add(left, right, evaluate=evaluate)

    if isinstance(node.op, ast.Sub):
        negative_right = sp.Mul(-1, right, evaluate=evaluate)
        return sp.Add(left, negative_right, evaluate=evaluate)

    if isinstance(node.op, ast.Mult):
        return sp.Mul(left, right, evaluate=evaluate)

    if isinstance(node.op, ast.Div):
        reciprocal = sp.Pow(right, -1, evaluate=evaluate)
        if left.is_Mul:
            return sp.Mul(
                *[arg for arg in left.args if isinstance(arg, sp.Expr)],
                reciprocal,
                evaluate=evaluate,
            )

        return sp.Mul(left, reciprocal, evaluate=evaluate)

    if isinstance(node.op, ast.Pow):
        return sp.Pow(left, right, evaluate=evaluate)

    raise ValueError("Operator is not allowed.")


def _parse_unary_operation(
    node: ast.UnaryOp, symbols: dict[str, sp.Symbol], evaluate: bool
) -> sp.Expr:
    """Parse unary plus and minus."""
    operand = _parse_expression_node(node.operand, symbols, evaluate)

    if isinstance(node.op, ast.UAdd):
        return operand

    if isinstance(node.op, ast.USub):
        return sp.Mul(-1, operand, evaluate=evaluate)

    raise ValueError("Unary operator is not allowed.")


def _parse_call(
    node: ast.Call, symbols: dict[str, sp.Symbol], evaluate: bool
) -> sp.Expr:
    """Parse an allowlisted math function call."""
    if not isinstance(node.func, ast.Name):
        raise ValueError("Only direct math function calls are allowed.")

    if node.keywords:
        raise ValueError("Keyword arguments are not allowed.")

    function = CALLS.get(node.func.id)
    if function is None:
        raise ValueError("Function is not allowed.")

    args = [_parse_expression_node(arg, symbols, evaluate) for arg in node.args]
    return function(*args)


def _normalize_reserved_symbols(value: str) -> tuple[str, dict[str, sp.Symbol]]:
    """Allow math variables whose text is reserved by Python syntax."""
    symbols: dict[str, sp.Symbol] = {}

    def replace(match: re.Match[str]) -> str:
        name = match[0]

        if name in NON_MATH_CONSTANT_NAMES:
            return name

        if not keyword.iskeyword(name):
            return name

        alias = f"{RESERVED_SYMBOL_PREFIX}{name}"
        symbols[alias] = sp.Symbol(name)

        return alias

    return IDENTIFIER_PATTERN.sub(replace, value), symbols


def equation(value: str | None) -> sp.Expr | sp.Equality | Relational:
    """Parse an equation or inequality string into a SymPy relation."""
    if not value:
        raise ValueError("Equation is required.")

    for operator in ("<=", ">=", "<", ">", "="):
        if operator in value:
            left, right = value.split(operator, 1)
            left_expr = expression(left)
            right_expr = expression(right)

            if operator == "<=":
                return sp.Le(left_expr, right_expr)
            if operator == ">=":
                return sp.Ge(left_expr, right_expr)
            if operator == "<":
                return sp.Lt(left_expr, right_expr)
            if operator == ">":
                return sp.Gt(left_expr, right_expr)

            return sp.Eq(left_expr, right_expr)

    return sp.Eq(expression(value), 0)


def matrix(rows: list[list[str]]) -> sp.Matrix:
    """Parse a matrix from expression strings."""
    if not rows:
        raise ValueError("Matrix is required.")

    return sp.Matrix([[expression(cell) for cell in row] for row in rows])


def vector(values: list[str]) -> sp.Matrix:
    """Parse a column vector from expression strings."""
    if not values:
        raise ValueError("Vector is required.")

    return sp.Matrix([expression(value) for value in values])


def point(value: PointInput) -> sp.Point2D:
    """Parse a two-dimensional point from expression strings."""
    return sp.Point2D(expression(value.x), expression(value.y))


def first_expression(request: MathRequest) -> sp.Expr:
    """Read and parse the primary expression from a request."""
    return expression(request.expression)


def _single_symbol_or_default(values: list[ParsedSymbolSource]) -> sp.Symbol:
    """Infer one free symbol, default to x, or reject ambiguous input."""
    symbols = sorted(
        {
            symbol
            for value in values
            for symbol in value.free_symbols
            if isinstance(symbol, sp.Symbol)
        },
        key=str,
    )

    if not symbols:
        return symbol(None)

    if len(symbols) == 1:
        return symbols[0]

    raise ValueError("Variable is required when multiple symbols are present.")
