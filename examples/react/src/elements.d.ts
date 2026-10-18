// The custom elements as React 19 sees them: attributes, properties and `on<event>` props.
import type { SheetpaneError } from '@sheetpane/grid';
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type Base = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
type On<T> = (e: CustomEvent<T>) => void;

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'sheetpane-excel': Base & {
        pane?: string; mode?: 'view' | 'edit'; display?: 'tab' | 'popup'; open?: boolean; author?: string; src?: string;
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
