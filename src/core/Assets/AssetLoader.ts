/** Where an asset loads from. */
export type AssetSource = { url: string } | { url: string; format?: string }; // optional hint if needed later

/** Loads one asset from a source. Registered per kind and extension on the asset store. */
export type AssetLoader<T> = (src: AssetSource) => Promise<T>;
