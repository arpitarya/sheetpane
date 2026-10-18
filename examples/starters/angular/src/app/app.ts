// Registers <sheetpane-excel> and <sheetpane-errors>. CUSTOM_ELEMENTS_SCHEMA lets Angular render
// them; [prop] sets a property (`open`) and (event) listens to a sheetpane-… event.
import { Component, CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import '@sheetpane/grid';
import type { SheetpaneError } from '@sheetpane/grid';

@Component({
  selector: 'app-root',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <header class="bar">
      <strong>angular</strong>
      <span class="count">{{ open() === 0 ? 'no open errors' : open() + ' open error' + (open() === 1 ? '' : 's') }}</span>
      <button type="button" (click)="popup.set(true)">Open in a pop-up</button>
    </header>
    <!-- One pane, three places: the sheet and its errors side by side, and the same sheet in a pop-up. -->
    <main class="review">
      <sheetpane-excel pane="review" mode="edit" author="You" src="/showcase.xlsx" rules-src="/showcase.rules.json"></sheetpane-excel>
      <sheetpane-errors pane="review" author="You" (sheetpane-errors)="countOpen($event)"></sheetpane-errors>
    </main>
    <sheetpane-excel pane="review" mode="edit" author="You" display="popup" [open]="popup()" (sheetpane-close)="popup.set(false)"></sheetpane-excel>
  `,
})
export class App {
  readonly popup = signal(false);
  readonly open = signal(0);

  countOpen(e: Event) {
    const { errors } = (e as CustomEvent<{ errors: SheetpaneError[] }>).detail;
    this.open.set(errors.filter((x) => x.status === 'open').length);
  }
}
