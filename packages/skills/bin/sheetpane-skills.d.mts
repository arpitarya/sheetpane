// Types for the installer's programmatic entry (W-35): `@sheetpane/grid`'s forwarding bin calls main().
/** `io.stdin`: a hook's input for `check-rules --hook`, instead of reading the process's stdin. */
export declare function main(argv: string[], io?: { out?: (s: string) => void; err?: (s: string) => void; cwd?: string; pkgRoot?: string; stdin?: string | undefined }): Promise<number>;
export declare const MANIFEST: string;
export declare const START: string;
export declare const END: string;
export declare const TOOLS: readonly string[];
/** `name`, `description`, the top-level keys and `metadata` of a SKILL.md's frontmatter. */
export declare function frontmatter(text: string): ({ keys: string[]; metadata: Record<string, string>; name: string; description: string } & Record<string, unknown>) | undefined;
export declare function toKey(rel: string, p?: { sep: string }): string;
export declare function fromKey(root: string, key: string, p?: { join(...parts: string[]): string }): string;
export declare function putBlock(text: string, block: string, markers?: [string, string]): { text: string; prefix: string | null };
export declare function getBlock(text: string, markers?: [string, string]): string | undefined;
export declare function dropBlock(text: string, prefix: string | null | undefined, markers?: [string, string]): string;
/** The marks around the Codex `[mcp_servers.sheetpane]` block. */
export declare const TOML_START: string;
export declare const TOML_END: string;
/** The MCP server entry each tool's config gets (W-39). */
export declare const SERVER: { command: string; args: string[] };
/** The tools `check-rules --hook <tool>` reads a hook's input from (W-45). */
export declare const HOOK_TOOLS: readonly string[];
/** One problem of a rules file — the same shape and codes as @sheetpane/grid's `checkDocument`. */
export interface RulesProblem { code: string; sheet?: string; found: string; message: string }
/** The problems of a parsed rules file; `{ __error: why }` stands for a file that could not be read (SP-6011). */
export declare function checkRules(doc: unknown): RulesProblem[];
/** Reads and checks one rules file; `problems` is undefined when it cannot be read (`why`, `missing`). */
export declare function checkRulesFile(abs: string, shown?: string): { problems: RulesProblem[] | undefined; why?: string; missing?: boolean };
/** The files an agent's hook input names (Claude Code `tool_input.file_path`, a Codex `apply_patch`), and its `cwd`. */
export declare function hookPaths(input: unknown): { files: string[]; cwd: string | undefined };
/** The PostToolUse group an entry file carries and the command that identifies it in a host's config. */
export declare function hookGroup(src: string, pkgRoot?: string): { group: { matcher: string; hooks: { type: string; command: string }[] }; command: string };
