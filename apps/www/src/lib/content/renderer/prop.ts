/**
 * The mark of a renderer that draws differently inside another renderer's prop,
 * holding the component it draws with there. A prop, such as a scene's label, can
 * mount where the server never renders it, in a canvas overlay, so a formula
 * there takes the markup the server drew for it (ADR 0039 D13).
 */
export const IN_PROP = Symbol.for("nakafa.renderer.inProp");

/** Whether a renderer is marked with the component it draws with inside a prop. */
function isMarked<Type>(type: Type): type is Type & { [IN_PROP]: Type } {
  return typeof type === "function" && Reflect.has(type, IN_PROP);
}

/** The component a renderer draws with inside another renderer's prop: its marked one, or itself. */
export function inPropType<Type>(type: Type): Type {
  return isMarked(type) ? type[IN_PROP] : type;
}
