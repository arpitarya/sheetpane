<script lang="ts">
  // Registers <sheetpane-excel> and <sheetpane-errors>. Svelte 5 sets a property when the element
  // has one (`open`) and listens with onsheetpane-….
  import '@sheetpane/grid';

  let popup = $state(false);
  let open = $state(0);
</script>

<header class="bar">
  <strong>svelte</strong>
  <span class="count">{open === 0 ? 'no open errors' : `${open} open error${open === 1 ? '' : 's'}`}</span>
  <button type="button" onclick={() => (popup = true)}>Open in a pop-up</button>
</header>
<!-- One pane, three places: the sheet and its errors side by side, and the same sheet in a pop-up. -->
<main class="review">
  <sheetpane-excel pane="review" mode="edit" author="You" src="/showcase.xlsx" rules-src="/showcase.rules.json"></sheetpane-excel>
  <sheetpane-errors pane="review" author="You"
    onsheetpane-errors={(e) => (open = e.detail.errors.filter((x) => x.status === 'open').length)}></sheetpane-errors>
</main>
<sheetpane-excel pane="review" mode="edit" author="You" display="popup" open={popup} onsheetpane-close={() => (popup = false)}></sheetpane-excel>
