const POSITION = /(^|\s)(relative|absolute|fixed|sticky)(\s|$)/;

/**
 * For components that lay out absolutely-positioned children and accept a
 * `className` from the caller: make sure the wrapper is positioned, without
 * fighting a position the caller already chose.
 *
 * Never write `relative ${className}`: if the caller passes `absolute inset-2`,
 * both classes apply, `relative` wins, and `inset-2` silently turns into an
 * offset instead of sizing the box. (scripts/check-classnames.mjs enforces this.)
 */
export function withPosition(className = ""): string {
  return POSITION.test(className) ? className : `relative ${className}`.trim();
}
