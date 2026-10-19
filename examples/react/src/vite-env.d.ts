// Vite's `?url` imports: the bundled file's URL (the gallery's showcase from @sheetpane/fixtures).
declare module '*?url' {
  const url: string;
  export default url;
}

// The playground build sets the version shown in the header (W-44).
interface ImportMetaEnv { readonly VITE_SHEETPANE_VERSION?: string }
interface ImportMeta { readonly env: ImportMetaEnv }

// The demo's stylesheet, imported for its side effect.
declare module '*.css';
