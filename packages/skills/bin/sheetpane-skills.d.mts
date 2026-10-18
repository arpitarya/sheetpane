// Types for the installer's programmatic entry (W-35): `@sheetpane/grid`'s forwarding bin calls main().
export declare function main(argv: string[], io?: { out?: (s: string) => void; err?: (s: string) => void; cwd?: string; pkgRoot?: string }): Promise<number>;
export declare const MANIFEST: string;
export declare const START: string;
export declare const END: string;
export declare const TOOLS: readonly string[];
/** `name`, `description`, the top-level keys and `metadata` of a SKILL.md's frontmatter. */
export declare function frontmatter(text: string): ({ keys: string[]; metadata: Record<string, string>; name: string; description: string } & Record<string, unknown>) | undefined;
export declare function toKey(rel: string, p?: { sep: string }): string;
export declare function fromKey(root: string, key: string, p?: { join(...parts: string[]): string }): string;
export declare function putBlock(text: string, block: string): { text: string; prefix: string | null };
export declare function getBlock(text: string): string | undefined;
export declare function dropBlock(text: string, prefix: string | null | undefined): string;
