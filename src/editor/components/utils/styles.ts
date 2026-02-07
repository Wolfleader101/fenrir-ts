import { unsafeCSS } from "lit";
import globalStyles from "@/style.css?inline";

/**
 * Import Tailwind CSS styles for use in LitElement shadow DOM
 * Use this in your component's static styles property
 *
 * @example
 * ```typescript
 * static override styles = [tailwindStyles];
 * ```
 */
export const tailwindStyles = unsafeCSS(globalStyles);
