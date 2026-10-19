// What Vite adds to the test files' world (the import package declares `?inline` the same way).
declare module '*?inline' {
  const dataUrl: string;
  export default dataUrl;
}
interface ImportMeta {
  glob(pattern: string, options: { query: string; import: string; eager: true }): Record<string, unknown>;
}
