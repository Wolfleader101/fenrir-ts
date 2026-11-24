// The one place the kit turns its controls into accessibility output. It is a pure function of the
// focusable controls, so another output (such as a DOM mirror) can be fed the same list later.

interface Described {
  readonly label: string;
  readonly disabled?: boolean;
}

/**
 * Internal. The canvas's `aria-label` (`null`: leave the canvas's own) and `aria-description`
 * (`null`: leave the canvas's own) for the focusable controls, the focused one, the label of the
 * top modal scope or the game's summary, and the hint shown while nothing has focus.
 */
export function describeUi(
  focusable: readonly Described[],
  focused: Described | undefined,
  label: string | undefined,
  hint: string,
): { label: string | null; description: string | null } {
  return {
    label: label ?? null,
    description: focused ? `Focused: ${focused.label}${focused.disabled ? ", unavailable" : ""}` : focusable.length ? hint : null,
  };
}
