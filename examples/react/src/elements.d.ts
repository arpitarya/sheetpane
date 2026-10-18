// The custom elements as React 19 sees them: attributes, properties and `on<event>` props.
import type { SheetpaneError, SheetpaneExcel } from '@sheetpane/grid';
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type Base = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
type ExcelBase = DetailedHTMLProps<HTMLAttributes<SheetpaneExcel>, SheetpaneExcel>;
type On<T> = (e: CustomEvent<T>) => void;

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'sheetpane-excel': ExcelBase & {
        pane?: string; mode?: 'view' | 'edit'; display?: 'tab' | 'popup'; open?: boolean; author?: string; src?: string;
        'header-row'?: string; theme?: 'light' | 'dark' | 'auto'; 'on-invalid'?: 'flag' | 'block';
        file?: File | Blob | null;
        'onsheetpane-change'?: On<{ sheet: string; ref: string; kind: string; was: unknown; now: unknown }>;
        'onsheetpane-close'?: On<object>;
        'onsheetpane-load'?: On<{ status: string; name?: string }>;
      };
      'sheetpane-errors': Base & {
        pane?: string; author?: string; readonly?: boolean;
        'onsheetpane-errors'?: On<{ errors: SheetpaneError[]; plugins: string[] }>;
        'onsheetpane-reveal'?: On<{ error: SheetpaneError }>;
      };
    }
  }
}
