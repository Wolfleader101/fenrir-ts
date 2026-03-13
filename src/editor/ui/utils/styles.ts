import { css, unsafeCSS } from "lit";

/**
 * Import Tailwind CSS styles for use in LitElement shadow DOM
 * Use this in your component's static styles property
 *
 * @example
 * ```typescript
 * static override styles = [tailwindStyles];
 * ```
 */
export const tailwindStyles = css`
  @import "tailwindcss";
`;
