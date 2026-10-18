/** `plugins/sheetpane` — the Claude Code plugin's folder, from the repository root. */
export declare const PLUGIN_DIR: string;
/** Every file `build-plugin.mjs` writes, by path from the repository root, with its text. */
export declare const outputs: Record<string, string>;
/** Every file under `dir`, as POSIX paths from the repository root. */
export declare function filesUnder(dir: string): string[];
