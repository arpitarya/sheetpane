/** The git ref the links pin to: `v<version>`, or `main` before the first release. */
export declare const ref: string;
/** `examples/starters`. */
export declare const OUT: string;
/** The StackBlitz URL of one starter. */
export declare function stackblitz(template: string): string;
/** Scaffolds every template into `dir` with the CLI, plus the index README. */
export declare function buildStarters(dir: string): Promise<void>;
/** Every file under `dir`, relative, with its text. */
export declare function tree(dir: string): Record<string, string>;
