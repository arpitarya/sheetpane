declare module '*?inline' {
  const src: string;
  export default src;
}
interface ImportMeta {
  glob(pattern: string | string[], options?: { query?: string; import?: string; eager?: boolean }): Record<string, unknown>;
}
