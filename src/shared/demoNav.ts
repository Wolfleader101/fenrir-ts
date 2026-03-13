/**
 * Shared demo navigation system
 *
 * Provides centralized navigation management for all demo pages.
 * Updates in one place automatically reflect across all demo HTML files.
 */

type DemoPage = {
  readonly href: string;
  readonly title: string;
};

const DEMO_PAGES: readonly DemoPage[] = [
  { href: "index.html", title: "Physics Demo" },
  { href: "animation.html", title: "Animation Demo" },
  { href: "bouncing-ball.html", title: "Bouncing Ball" },
  { href: "stacking-blocks.html", title: "Stacking Blocks" },
  { href: "pixi2d.html", title: "2D Demo (PixiJS)" },
  { href: "platformer.html", title: "2D Platformer" },
  { href: "platformer-physics.html", title: "2D Platformer (Physics)" },
  { href: "monaco-editor.html", title: "Monaco Editor Demo" },
] as const;

/**
 * Initialize demo navigation
 *
 * Injects navigation links into the #nav element and marks the current page as active.
 *
 * @param currentPage - The filename of the current page (e.g., "index.html")
 */
export const initDemoNav = (currentPage: string): void => {
  const navElement = document.getElementById("nav");
  if (!navElement) {
    console.warn("Navigation element #nav not found");
    return;
  }

  navElement.innerHTML = DEMO_PAGES.map(({ href, title }) => {
    const isActive = href === currentPage;
    return `<a href="${href}"${isActive ? ' class="active"' : ""}>${title}</a>`;
  }).join("");
};

/**
 * Initialize demo info section
 *
 * Injects demo-specific information into the #info element.
 *
 * @param title - The demo title
 * @param features - List of features to display
 */
export const initDemoInfo = (
  title: string,
  features: readonly string[],
): void => {
  const infoElement = document.getElementById("info");
  if (!infoElement) {
    console.warn("Info element #info not found");
    return;
  }

  const featureItems = features
    .map((feature) => `<p>• ${feature}</p>`)
    .join("");

  infoElement.innerHTML = `<h3>${title}</h3>${featureItems}`;
};
