// A stand-in for the parts of Solid's JSX types `@sheetpane/grid/solid` uses (solid-js is not installed in the repo).
export namespace JSX {
  interface HTMLAttributes<T> { id?: string; class?: string; style?: string | Record<string, string>; ref?: T | ((el: T) => void); children?: unknown; 'on:click'?: (e: MouseEvent) => void }
  interface IntrinsicElements { div: HTMLAttributes<HTMLDivElement> }
}
