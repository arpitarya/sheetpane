// A stand-in for the parts of `svelte/elements` `@sheetpane/grid/svelte` uses (svelte is not installed in the repo).
export interface HTMLAttributes<T extends EventTarget> { id?: string | null; class?: string | null; style?: string | null; title?: string | null; 'bind:this'?: T | null; 'on:click'?: (e: MouseEvent & { currentTarget: EventTarget & T }) => any }
export interface SvelteHTMLElements { div: HTMLAttributes<HTMLDivElement> }
