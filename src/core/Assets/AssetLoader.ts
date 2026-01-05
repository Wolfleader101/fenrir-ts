export type AssetSource = { url: string } | { url: string; format?: string }; // optional hint if needed later

export type AssetLoader<T> = (src: AssetSource) => Promise<T>;
