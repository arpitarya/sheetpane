// The sheet's shadow-root styles: the Proof look from the design boards, as
// `--sp-*` tokens. No font family anywhere (SR-LAW-5): the host's font is
// inherited through the shadow root; every control is `font: inherit`.
import { TOKENS_CSS } from '../tokens.js';

export const BASE_CSS = `${TOKENS_CSS}
:host{display:block;position:relative;color:var(--sp-ink);font-size:14px;line-height:1.45;-webkit-font-smoothing:antialiased}
:host([hidden]){display:none}
[hidden]{display:none !important}
*{box-sizing:border-box}
button,input,select,textarea{font:inherit;color:inherit}
.vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.btn{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--sp-line-strong);background:var(--sp-surface);color:var(--sp-ink);border-radius:var(--sp-r);font-size:12px;font-weight:500;white-space:nowrap;cursor:pointer}
.btn:hover{border-color:var(--sp-ink-3)}
.btn[disabled]{opacity:.45;cursor:not-allowed}
.btn svg{width:15px;height:15px;flex:none}
.btn-p{background:var(--sp-accent);border-color:var(--sp-accent);color:var(--sp-on-solid)}
.btn-p:hover{background:var(--sp-accent-ink);border-color:var(--sp-accent-ink)}
.btn-g{background:transparent;border-color:transparent;color:var(--sp-ink-2)}
.btn-g:hover{background:var(--sp-sunken);color:var(--sp-ink)}
.btn-d{color:var(--sp-fail)}
.btn-i{width:28px;padding:0;justify-content:center}
.seg{display:inline-flex;background:var(--sp-sunken);border-radius:var(--sp-r);padding:2px;gap:2px}
.seg>button{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border:0;background:transparent;border-radius:var(--sp-r-sm);color:var(--sp-ink-2);font-size:13px;font-weight:500;cursor:pointer}
.seg>button[aria-pressed=true]{background:var(--sp-surface);color:var(--sp-ink);box-shadow:0 1px 2px rgba(22,23,26,.10)}
.seg svg{width:15px;height:15px}
.chip{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px;border-radius:999px;font-size:12px;font-weight:500;background:var(--sp-sunken);color:var(--sp-ink-2);white-space:nowrap}
.chip-fail{background:var(--sp-fail-soft);color:var(--sp-fail)}
.chip-warn{background:var(--sp-warn-soft);color:var(--sp-warn)}
.chip-info{background:var(--sp-accent-soft);color:var(--sp-accent-ink)}
.chip-pass{background:var(--sp-pass-soft);color:var(--sp-pass)}
.input{height:28px;border:1px solid var(--sp-line-strong);border-radius:var(--sp-r);padding:0 8px;background:var(--sp-surface);min-width:0;font-size:13px}
.input:focus{outline:2px solid var(--sp-accent);outline-offset:-1px;border-color:var(--sp-accent)}
textarea.input{height:auto;min-height:56px;padding:6px 8px;resize:vertical;width:100%;line-height:1.45}
.num{font-variant-numeric:tabular-nums}
.xs{font-size:12px}.faint{color:var(--sp-ink-3)}.muted{color:var(--sp-ink-2)}
.g{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:var(--sp-r-sm);font-size:10px;font-weight:700;color:var(--sp-on-solid);flex:none}
.g-error{background:var(--sp-fail)}.g-warning{background:var(--sp-warn)}.g-note{background:var(--sp-accent)}.g-pass{background:var(--sp-pass)}
`;

export const EXCEL_CSS = `${BASE_CSS}
.sp{display:flex;flex-direction:column;height:100%;min-height:320px;background:var(--sp-surface);border:1px solid var(--sp-line);border-radius:var(--sp-r-lg);overflow:hidden}
:host([display=popup]) .sp{border:0;border-radius:var(--sp-r-xl)}
dialog{padding:0;border:0;border-radius:var(--sp-r-xl);width:min(1240px,calc(100vw - 48px));height:min(760px,calc(100vh - 48px));max-width:none;max-height:none;box-shadow:var(--sp-shadow-lg);background:var(--sp-surface);color:inherit;font:inherit}
dialog::backdrop{background:rgba(22,23,26,.42)}
.bar{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid var(--sp-line);flex-wrap:wrap}
.bar .ico{width:18px;height:18px;color:var(--sp-ink-3);flex:none}
.fname{font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;min-width:40px;flex:0 1 auto}
.counts{display:inline-flex;gap:4px}
.spacer{flex:1}
.find{position:relative;display:inline-flex;align-items:center}
.find svg{position:absolute;left:8px;width:14px;height:14px;color:var(--sp-ink-3);pointer-events:none}
.find input{padding-left:28px;width:112px}
.zoom{width:70px;padding:0 2px}
.find .cnt{font-size:11px;color:var(--sp-ink-3);margin-left:6px;min-width:44px}
.input.cell[aria-invalid]{outline:2px solid var(--sp-fail);outline-offset:-1px}
.ptext{display:inline-flex;align-items:center;height:24px;padding:0 8px;border:1px dashed var(--sp-line-strong);border-radius:var(--sp-r-sm);color:var(--sp-ink-2);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:40ch;font-variant-numeric:tabular-nums}
.fx{display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid var(--sp-line);min-height:41px;font-size:13px;flex-wrap:wrap}
.fx .ref{font-weight:600;min-width:52px;color:var(--sp-ink-2);font-variant-numeric:tabular-nums}
.fx .val{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fx input.cell{flex:1;max-width:460px;border-color:var(--sp-accent)}
.tag{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--sp-ink-3);border:1px solid var(--sp-line-strong);border-radius:4px;padding:3px 5px}
.frow{display:flex;align-items:center;gap:4px;padding:4px 10px;border-bottom:1px solid var(--sp-line);flex-wrap:wrap;background:var(--sp-ground)}
.frow .sep{width:1px;height:20px;background:var(--sp-line-strong);margin:0 4px}
.frow button[aria-pressed=true]{background:var(--sp-accent-soft);border-color:var(--sp-accent)}
.body{flex:1;min-height:0;display:flex;position:relative}
.scroller{flex:1;min-width:0;overflow:auto;position:relative;background:var(--sp-cell)}
.grid{outline:none}
.scroller:has(.grid:focus-visible){box-shadow:inset 0 0 0 2px var(--sp-accent)}
.sheet{position:relative}
.hrow{position:sticky;top:0;z-index:5;display:flex;background:var(--sp-head)}
.row{position:absolute;left:0;display:flex}
.frozen{position:sticky;z-index:3;display:flex;background:var(--sp-cell)}
.rh,.corner{position:sticky;left:0;z-index:2;flex:none;display:flex;align-items:center;justify-content:flex-end;gap:4px;padding:0 6px;background:var(--sp-head);border-right:1px solid var(--sp-line);border-bottom:1px solid var(--sp-grid);color:var(--sp-ink-3);font-size:.85em;font-variant-numeric:tabular-nums}
.corner{z-index:6}
.ch{position:absolute;top:0;display:flex;align-items:center;justify-content:center;background:var(--sp-head);border-right:1px solid var(--sp-grid);border-bottom:1px solid var(--sp-line);color:var(--sp-ink-3);font-size:.85em;font-weight:500}
.ch.fz,.c.fz{position:sticky;z-index:2;top:auto}
.c{position:absolute;top:0;padding:0 .6em;border-right:1px solid var(--sp-grid);border-bottom:1px solid var(--sp-grid);overflow:hidden;background:var(--sp-cell);cursor:cell;font-size:var(--sp-cell-font-size,.93em);display:flex;flex-direction:column;justify-content:center;white-space:nowrap}
.c>.v{position:relative;z-index:1;overflow:hidden;text-overflow:ellipsis;white-space:inherit;text-align:inherit;min-width:0}
.c.fz{background:var(--sp-cell)}
.c.n{text-align:right;font-variant-numeric:tabular-nums}
.c.merge{text-align:center;font-weight:600;background:var(--sp-head);z-index:1}
.c.sel{outline:2px solid var(--sp-accent);outline-offset:-2px;z-index:3}
/* state tints sit above a file's own fill (a decorate background), never instead of it */
.c.inrange::before,.c.hit::before,.c.m-error::before,.c.m-warning::before,.c.m-note::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.6}
.c.inrange::before{background:var(--sp-accent-soft)}
.c.hit::before{background:var(--sp-hit);opacity:.85}
.c.hit.cur::before{background:var(--sp-hit-current)}
.c.chg::after{content:"";position:absolute;top:0;right:0;z-index:2;border-style:solid;border-width:0 7px 7px 0;border-color:transparent var(--sp-changed) transparent transparent;filter:drop-shadow(0 0 1px var(--sp-cell))}
.c.m-error{box-shadow:inset 0 0 0 1.5px var(--sp-fail)}.c.m-error::before{background:var(--sp-fail-soft)}
.c.m-warning{box-shadow:inset 0 0 0 1.5px var(--sp-warn)}.c.m-warning::before{background:var(--sp-warn-soft)}
.c.m-note{box-shadow:inset 0 0 0 1.5px var(--sp-accent)}.c.m-note::before{background:var(--sp-accent-soft)}
.c.m-pass{box-shadow:inset 0 0 0 1.5px var(--sp-pass)}
.c.stale>.v{color:var(--sp-ink-3);font-style:italic}
.c.stale>.v::before{content:"≈ ";color:var(--sp-warn);font-style:normal}
.c.derived>.v{color:var(--sp-accent-ink)}
.c .mk{position:absolute;z-index:2;right:2px;top:50%;transform:translateY(-50%);border:0;background:transparent;padding:0 2px;cursor:pointer;color:var(--sp-ink-3)}
.overlay{position:absolute;inset:0;pointer-events:none;z-index:4}
.overlay>*{pointer-events:auto}
.pin{position:absolute;min-width:18px;height:18px;padding:0 4px;border-radius:9px;border:0;font-size:10px;font-weight:700;line-height:18px;color:var(--sp-on-solid);text-align:center;box-shadow:0 0 0 2px var(--sp-cell),0 1px 4px rgba(22,23,26,.3);cursor:pointer;font-variant-numeric:tabular-nums}
.pin.error{background:var(--sp-fail)}.pin.warning{background:var(--sp-warn)}.pin.note{background:var(--sp-accent)}.pin.resolved{background:var(--sp-pass)}
.pin.on{box-shadow:0 0 0 2px var(--sp-cell),0 0 0 4px var(--sp-ink)}
.pin.square{border-radius:3px;min-width:16px;height:16px;line-height:16px;padding:0 2px}
.pin.pending{background:var(--sp-cell);color:var(--sp-accent);box-shadow:0 0 0 1.5px var(--sp-accent)}
.badge{position:absolute;font-size:11px;padding:2px 6px;border-radius:4px;background:var(--sp-sunken);color:var(--sp-ink-2);border:1px dashed var(--sp-line-strong);white-space:nowrap}
.olay{position:absolute;overflow:hidden}
.fx{container-type:inline-size}
.dock{display:inline-flex;align-items:center;gap:4px;margin-left:auto}
.dock[hidden]{display:none}
.dock .plug{display:inline-flex;gap:2px}
.dock .kbd,.ctxmenu .kbd,.moremenu .kbd{margin-left:6px;font-size:10px;color:var(--sp-ink-3);border:1px solid var(--sp-line);border-radius:3px;padding:0 4px}
.morewrap{position:relative;display:inline-flex}
.moremenu{position:absolute;top:calc(100% + 4px);right:0;z-index:9;min-width:180px;padding:4px}
.ctxmenu{position:absolute;z-index:9;min-width:190px;padding:4px}
.mi{display:flex;align-items:center;justify-content:space-between;width:100%;height:30px;padding:0 10px;border:0;border-radius:var(--sp-r-sm);background:transparent;color:var(--sp-ink);font:inherit;font-size:13px;text-align:left;cursor:pointer}
.mi:hover,.mi:focus-visible{background:var(--sp-sunken);outline:none}
.mi[disabled]{color:var(--sp-ink-3);cursor:default}
/* plugin buttons stay in the bar while it is wide, and fold into ⋯ before Flag issue moves */
.moremenu .fold{display:none}
@container (max-width: 720px){.dock .plug{display:none}.moremenu .fold{display:flex}}
.warn-t{color:var(--sp-warn)}
.export .badge-n{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--sp-sunken);color:var(--sp-ink);font-size:11px;font-weight:700;line-height:18px;text-align:center}
.split{position:relative;display:inline-flex}
.split>.export{border-top-right-radius:0;border-bottom-right-radius:0}
.split>.dlmore{border-left:0;border-top-left-radius:0;border-bottom-left-radius:0;width:26px;padding:0}
.dlmenu{position:absolute;top:calc(100% + 4px);right:0;z-index:12;min-width:250px;padding:4px}
.mnote{display:block;padding:0 10px 6px;font-size:11px;color:var(--sp-ink-3)}
.msep{height:1px;margin:4px 6px;background:var(--sp-line)}
.export .badge-n[hidden]{display:none}
.kbd{display:inline-block;font-size:11px;padding:2px 5px;border:1px solid rgba(255,255,255,.35);border-radius:4px}
.card{position:absolute;background:var(--sp-surface);border:1px solid var(--sp-line);border-radius:var(--sp-r-lg);box-shadow:var(--sp-shadow);z-index:8;overflow:hidden;display:flex;flex-direction:column}
.card .hd{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--sp-line)}
.card .hd .t{font-weight:600;font-size:13px}
.card .bd{padding:10px 12px;display:flex;flex-direction:column;gap:10px}
.card .ft{display:flex;gap:6px;padding:8px 10px;border-top:1px solid var(--sp-line);background:var(--sp-ground);align-items:center}
.fe{display:grid;grid-template-columns:76px 1fr;gap:6px 10px;align-items:baseline;margin:0}
.fe dt{font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--sp-ink-3)}
.fe dd{margin:0;font-size:13px;min-width:0;overflow-wrap:anywhere}
.found{color:var(--sp-fail);text-decoration:line-through;background:var(--sp-fail-soft);padding:1px 4px;border-radius:3px}
.want{color:var(--sp-pass);background:var(--sp-pass-soft);padding:1px 4px;border-radius:3px}
.field{display:flex;flex-direction:column;gap:4px}
.field>span{font-size:12px;font-weight:500;color:var(--sp-ink-2)}
.tabs{display:flex;gap:2px;padding:0 8px;border-top:1px solid var(--sp-line);background:var(--sp-ground);overflow-x:auto}
.tab{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border:0;border-top:2px solid transparent;background:transparent;color:var(--sp-ink-2);font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap}
.tab[aria-selected=true]{background:var(--sp-surface);color:var(--sp-ink);border-top-color:var(--sp-accent)}
.tab.hidden-sheet{font-style:italic;color:var(--sp-ink-3)}
.tab .cnt{font-size:10px;font-weight:700;padding:1px 5px;border-radius:999px;background:var(--sp-fail-soft);color:var(--sp-fail)}
.status{display:flex;align-items:center;gap:14px;padding:5px 12px;border-top:1px solid var(--sp-line);background:var(--sp-head);font-size:12px;color:var(--sp-ink-3);flex-wrap:wrap;font-variant-numeric:tabular-nums}
.state{flex:1;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--sp-ground)}
.drop{width:min(560px,100%);border:1.5px dashed var(--sp-line-strong);border-radius:var(--sp-r-lg);background:var(--sp-surface);padding:28px 20px;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center}
.drop.over{border-color:var(--sp-accent);background:var(--sp-accent-soft)}
.drop .link{color:var(--sp-accent);text-decoration:underline;background:none;border:0;padding:0;cursor:pointer}
.drop .row{display:flex;gap:6px;width:100%}
.drop .row .input{flex:1}
.msg{width:min(520px,100%);display:flex;gap:12px;padding:16px;border-radius:var(--sp-r-lg);border:1px solid;align-items:flex-start;background:var(--sp-surface)}
.msg.fail{border-color:var(--sp-fail);background:var(--sp-fail-soft)}
.msg.warn{border-color:var(--sp-warn);background:var(--sp-warn-soft)}
.msg .t{font-weight:600}
`;
