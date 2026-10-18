// Types for the scaffolder's programmatic entry (W-43), for its tests.
export interface Io {
  out?: (s: string) => void;
  err?: (s: string) => void;
  cwd?: string;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  /** Runs a command in a folder and returns its exit code (default: spawnSync, output inherited). */
  run?: (cmd: string, args: string[], cwd: string) => number;
  /** `npm_config_user_agent`, which names the package manager that ran `create`. */
  userAgent?: string;
  /** The Node version to check a template's `node` range against (default: this process's). */
  nodeVersion?: string;
}
export declare function main(argv: string[], io?: Io): Promise<number>;
export declare const VERSION: string;
export declare const TEMPLATES: Record<'vanilla' | 'react' | 'next' | 'vue' | 'angular' | 'svelte', { title: string; label: string; entry: string; url: string; node?: string }>;
export declare const SKILLS: readonly string[];
export declare const PMS: readonly string[];
export declare function parseArgs(argv: string[]): {
  dir?: string; template?: string; skills?: string; mcp?: boolean; pm?: string; install: boolean; yes: boolean; help: boolean; errors: string[];
};
export declare function detectPm(userAgent?: string): 'npm' | 'pnpm' | 'yarn';
export declare function toPackageName(dir: string): string;
export declare function skillsArgs(skills: string, mcp: boolean): string[] | undefined;
export declare function fill(text: string, vars: Record<string, string>): string;
export declare function copyTemplate(from: string, to: string, vars: Record<string, string>): string[];
export declare function pmCommands(pm: string): {
  install: [string, string[]];
  run: string;
  exec: string;
  bin(name: string, args: string[]): [string, string[]];
};
/** True when `version` satisfies a `^x.y.z || >=x.y.z` range. */
export declare function nodeOk(range: string, version?: string): boolean;
