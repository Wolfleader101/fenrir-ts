import { html } from "lit-html";
import type { TemplateResult } from "lit-html";
import { createIcons, icons as allIcons } from "lucide";

/**
 * Helper to create a Lucide icon element (for lit-html templates)
 * @param name - The icon name (e.g., "play", "pause")
 * @param className - Optional CSS classes
 * @returns lit-html TemplateResult for the icon element
 */
export function icon(name: string, className = "w-4 h-4"): TemplateResult {
  return html` <i data-lucide="${name}" class="${className}"></i> `;
}

/**
 * Initialize all Lucide icons in the current DOM context
 * Call this after rendering HTML that contains icon elements
 * @param iconsToInclude - Specific icons to include (for tree-shaking)
 */
export function initIcons(
  iconsToInclude?: Record<string, typeof allIcons.Play>,
  shadowRoot?: DocumentFragment,
): void {
  const iconConfig = iconsToInclude
    ? { icons: iconsToInclude, root: shadowRoot }
    : { icons: allIcons, root: shadowRoot };

  if (shadowRoot) {
    // For shadow DOM, we need to pass the shadow root as the element to search in
    createIcons(iconConfig);
  } else {
    createIcons(iconConfig);
  }
}

/**
 * Create an icon element that can be slotted into components (for lit-html templates)
 * @param name - The icon name
 * @param slot - The slot name (e.g., "icon")
 * @param className - Optional CSS classes
 */
export function slottedIcon(
  name: string,
  slot = "icon",
  className = "w-4 h-4",
): TemplateResult {
  return html`
    <i slot="${slot}" data-lucide="${name}" class="${className}"></i>
  `;
}
