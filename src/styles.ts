import { C } from "./theme";

/* Global stylesheet, injected once by <App>. */
export const css = `
.sa-root{background:${C.bg};color:${C.ink};font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  min-height:100%;padding:20px 16px 40px;box-sizing:border-box;-webkit-font-smoothing:antialiased;}
.sa-root *{box-sizing:border-box;}
.sa-eyebrow{font-size:10.5px;letter-spacing:.22em;text-transform:uppercase;color:${C.amber};font-weight:600;}
.sa-title{font-size:clamp(24px,4vw,34px);font-weight:700;letter-spacing:-.02em;margin:6px 0 0;line-height:1;}
.sa-title-sub{color:${C.inkFaint};font-weight:400;letter-spacing:0;}
.sa-head{max-width:1080px;margin:0 auto 18px;}
.sa-head-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;}
.sa-unit{display:inline-flex;border:1px solid ${C.edge};border-radius:7px;overflow:hidden;background:${C.panel};}
.sa-unit-b{padding:8px 14px;font-size:11px;font-family:ui-monospace,Menlo,monospace;letter-spacing:.1em;color:${C.inkDim};background:none;border:none;cursor:pointer;}
.sa-unit-b.on{background:${C.panel2};color:${C.amber};font-weight:600;}
.sa-scale{display:inline-flex;border:1px solid ${C.edge};border-radius:6px;overflow:hidden;}
.sa-scale-b{padding:5px 10px;font-size:10px;font-family:ui-monospace,Menlo,monospace;letter-spacing:.08em;color:${C.inkDim};background:none;border:none;cursor:pointer;}
.sa-scale-b.on{background:${C.panel};color:${C.amber};font-weight:600;}
.sa-beam{display:flex;align-items:center;gap:12px;margin-top:16px;min-width:0;}
.sa-node{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;letter-spacing:.12em;color:${C.inkDim};border:1px solid ${C.edge};padding:5px 9px;border-radius:4px;background:${C.panel};white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis;}
.sa-node-mov{color:${C.ink};border-color:${C.laser}66;}
.sa-line{flex:1;min-width:24px;height:2px;position:relative;background:linear-gradient(90deg,${C.laser}77,${C.edge});border-radius:2px;overflow:hidden;}
.sa-line i{position:absolute;top:0;left:-30%;width:30%;height:100%;background:${C.laser};box-shadow:0 0 8px ${C.laser};animation:beam 2.6s linear infinite;}
@keyframes beam{to{left:100%;}}
@media (prefers-reduced-motion:reduce){.sa-line i{animation:none;left:0;}}
.sa-grid{max-width:1080px;margin:0 auto;display:grid;grid-template-columns:1fr;gap:14px;}
@media(min-width:860px){.sa-grid{grid-template-columns:1fr 1fr;align-items:start;}}
.sa-col{display:flex;flex-direction:column;gap:14px;min-width:0;}
.sa-panel{background:${C.panel};border:1px solid ${C.edge};border-radius:10px;overflow:hidden;}
.sa-panel-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:11px 14px;border-bottom:1px solid ${C.edgeSoft};background:${C.panel2};}
.sa-panel-title{font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:${C.ink};}
.sa-panel-hint{display:block;font-size:10.5px;font-weight:400;letter-spacing:.01em;text-transform:none;color:${C.inkFaint};margin-top:2px;}
.sa-panel-body{padding:13px 14px;}
.sa-toggle-btn{background:none;border:1px solid ${C.edge};color:${C.inkDim};font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;padding:5px 9px;border-radius:5px;cursor:pointer;}
.sa-toggle-btn:hover{color:${C.ink};border-color:${C.inkFaint};}
.sa-fields{display:grid;grid-template-columns:1fr 1fr;gap:9px 12px;}
.sa-derived{grid-column:1/-1;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:${C.inkDim};border-top:1px dashed ${C.edgeSoft};padding-top:8px;}
.sa-derived b{color:${C.amber};}
.sa-fld{display:flex;flex-direction:column;gap:5px;}
.sa-fld-l{font-size:11px;color:${C.inkDim};display:flex;justify-content:space-between;gap:6px;}
.sa-fld-l em{font-style:normal;color:${C.inkFaint};font-size:10px;}
.sa-fld-in,.sa-read-in{display:flex;align-items:center;background:${C.bg};border:1px solid ${C.edge};border-radius:6px;overflow:hidden;}
.sa-fld-in input,.sa-read-in input{flex:1;min-width:0;width:100%;background:none;border:none;color:${C.readout};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;padding:8px 8px;outline:none;}
.sa-fld-in i,.sa-read-in i{font-style:normal;font-size:10px;color:${C.inkFaint};padding:0 9px;white-space:nowrap;}
.sa-fld-in:focus-within,.sa-read-in:focus-within{border-color:${C.amber};box-shadow:0 0 0 2px ${C.amber}22;}
.sa-read{margin-bottom:11px;}
.sa-read-top{display:flex;align-items:center;gap:10px;margin-bottom:6px;}
.sa-read-l{flex:1;font-size:12px;color:${C.ink};}
.sa-read-in{width:132px;}
.sa-sep{height:1px;background:${C.edgeSoft};margin:4px 0 12px;}
.seg{display:grid;grid-template-columns:1fr 1fr;gap:4px;background:${C.bg};padding:3px;border-radius:7px;border:1px solid ${C.edge};}
.seg-b{background:none;border:none;color:${C.inkDim};font-size:11px;padding:7px 4px;border-radius:5px;cursor:pointer;letter-spacing:.03em;}
.seg-b:hover{color:${C.ink};}
.seg-b.on{background:${C.panel2};color:${C.ink};box-shadow:inset 0 0 0 1px ${C.edge};font-weight:600;}
.sa-check{display:flex;align-items:center;gap:8px;font-size:11px;color:${C.inkDim};margin-top:10px;cursor:pointer;}
.sa-check input{accent-color:${C.amber};}
.sa-emptyhint{font-size:11px;line-height:1.5;color:${C.inkFaint};}
.sa-tolgrid{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:7px 10px;align-items:center;margin-bottom:9px;}
.sa-tolhead{font-size:10px;letter-spacing:.08em;text-align:center;font-weight:600;}
.sa-tollabel{font-size:11px;color:${C.inkDim};}
.sa-tolcell input{width:100%;background:${C.bg};border:1px solid ${C.edge};border-radius:5px;color:${C.readout};font-family:ui-monospace,Menlo,monospace;font-size:13px;text-align:center;padding:6px 2px;outline:none;}
.sa-tolcell input:focus{border-color:${C.amber};}
.sa-status{display:flex;align-items:center;gap:13px;background:${C.panel};border:1px solid;border-radius:10px;padding:14px 16px;}
.sa-status-dot{width:12px;height:12px;border-radius:50%;flex:none;}
.sa-status-k{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:${C.inkFaint};}
.sa-status-v{font-size:20px;font-weight:700;letter-spacing:.02em;margin-top:2px;}
.sa-cline{width:100%;height:auto;display:block;background:${C.bg};border:1px solid ${C.edgeSoft};border-radius:8px;}
.sa-cl-title{fill:${C.inkDim};font-size:9px;font-family:ui-monospace,Menlo,monospace;letter-spacing:.12em;}
.sa-cl-meta{fill:${C.inkFaint};font-size:8.5px;font-family:ui-monospace,Menlo,monospace;letter-spacing:.03em;}
.sa-cl-body{fill:${C.inkDim};font-size:8px;font-family:ui-monospace,Menlo,monospace;letter-spacing:.08em;}
.sa-cl-tick{fill:${C.inkFaint};font-size:7.5px;font-family:ui-monospace,Menlo,monospace;letter-spacing:.06em;}
.sa-cl-off{fill:${C.amber};font-size:8.5px;font-family:ui-monospace,Menlo,monospace;}
.sa-cl-gap{fill:${C.amber};font-size:9px;font-family:ui-monospace,Menlo,monospace;font-weight:700;}
.sa-cl-gaplbl{fill:${C.inkFaint};font-size:6.5px;font-family:ui-monospace,Menlo,monospace;letter-spacing:.14em;}
.sa-cl-call{font-size:9px;font-weight:700;font-family:ui-monospace,Menlo,monospace;}
.sa-view-sep{height:1px;background:${C.edgeSoft};margin:12px 0;}
.sa-view-note{font-size:10px;color:${C.inkFaint};margin-top:10px;line-height:1.5;}
.sa-foot{border:1px solid ${C.edgeSoft};border-radius:8px;overflow:hidden;}
.sa-foot-h,.sa-foot-r{display:grid;grid-template-columns:1fr 1.15fr 1.15fr;align-items:center;}
.sa-foot-h{background:${C.panel2};padding:8px 12px;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:${C.inkFaint};}
.sa-foot-r{padding:12px;border-top:1px solid ${C.edgeSoft};}
.sa-foot-name{font-size:13px;font-weight:600;color:${C.ink};display:flex;flex-direction:column;}
.sa-foot-name em{font-style:normal;font-size:10px;color:${C.inkFaint};font-weight:400;margin-top:2px;}
.sa-foot-v{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:15px;font-weight:600;}
.sa-foot-v small{font-size:9.5px;color:${C.inkFaint};margin-left:4px;font-weight:400;}
.sa-foot-legend{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:10px;font-size:10.5px;color:${C.inkFaint};}
.sa-foot-legend b{font-weight:700;}
.sa-bar-row{display:grid;grid-template-columns:60px 1fr auto;gap:10px;align-items:center;padding:7px 0;}
.sa-bar-l{font-size:11px;color:${C.inkDim};}
.sa-bar-track{position:relative;height:14px;border-radius:7px;border:1px solid ${C.edge};}
.sa-bar-zero{position:absolute;left:50%;top:1px;bottom:1px;width:1px;background:${C.inkFaint};opacity:.6;}
.sa-bar-mark{position:absolute;top:-2px;bottom:-2px;width:3px;border-radius:2px;transform:translateX(-1.5px);}
.sa-bar-over{position:absolute;top:-1px;font-size:13px;font-weight:700;line-height:1;}
.sa-bar-v{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;white-space:nowrap;text-align:right;min-width:118px;}
.sa-bar-v em{font-style:normal;font-size:9.5px;color:${C.inkFaint};}
.sa-bar-cap{font-size:10px;color:${C.inkFaint};margin-top:9px;line-height:1.6;}
.sa-bar-cap b{font-weight:700;}
.sa-foot-note{max-width:1080px;margin:18px auto 0;font-size:10.5px;line-height:1.6;color:${C.inkFaint};text-align:center;}
button:focus-visible,input:focus-visible{outline:2px solid ${C.amber};outline-offset:1px;}

/* ---- jobs ---- */
.sa-loading{max-width:1080px;margin:40px auto;color:${C.inkFaint};font-size:12px;letter-spacing:.1em;text-transform:uppercase;}
.sa-jobbar{display:flex;align-items:center;gap:8px 12px;flex-wrap:wrap;padding-bottom:14px;margin-bottom:16px;border-bottom:1px solid ${C.edgeSoft};}
.sa-jobbar-name{display:flex;align-items:center;gap:8px;min-width:0;max-width:100%;background:${C.panel};border:1px solid ${C.edge};border-radius:7px;padding:7px 10px;cursor:pointer;color:${C.ink};}
.sa-jobbar-name:hover{border-color:${C.inkFaint};}
.sa-jobbar-k{font-family:ui-monospace,Menlo,monospace;font-size:9.5px;letter-spacing:.14em;color:${C.amber};}
.sa-jobbar-v{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sa-jobbar-caret{color:${C.inkFaint};font-size:10px;}
.sa-jobbar-status{font-size:10.5px;color:${C.inkFaint};}
.sa-jobbar-status.bad{color:${C.bad};}
.sa-jobbar-actions{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto;}
.sa-toggle-btn.sa-accent{color:${C.amber};border-color:${C.amber}66;}
.sa-notice{font-size:11.5px;color:${C.ink};background:${C.panel2};border:1px solid ${C.edge};border-left:3px solid ${C.ok};border-radius:6px;padding:8px 11px;margin:-6px 0 14px;cursor:pointer;}
.sa-notice.bad{border-left-color:${C.bad};}
.sa-span2{grid-column:1/-1;}
.sa-txt{font-family:inherit !important;font-size:13px !important;}
.sa-txt::placeholder,.sa-notes::placeholder{color:${C.inkFaint};}
.sa-notes{width:100%;background:${C.bg};border:1px solid ${C.edge};border-radius:6px;color:${C.readout};font:inherit;font-size:13px;padding:8px;resize:vertical;outline:none;}
.sa-notes:focus{border-color:${C.amber};box-shadow:0 0 0 2px ${C.amber}22;}
.sa-modal-bg{position:fixed;inset:0;background:#000a;display:flex;align-items:flex-start;justify-content:center;padding:6vh 12px 12px;z-index:10;}
.sa-modal{width:100%;max-width:560px;max-height:84vh;display:flex;flex-direction:column;background:${C.panel};border:1px solid ${C.edge};border-radius:10px;overflow:hidden;box-shadow:0 20px 60px #000c;}
.sa-joblist{list-style:none;margin:0;padding:6px;overflow-y:auto;flex:1;}
.sa-joblist li{display:flex;align-items:stretch;gap:6px;border-radius:7px;}
.sa-joblist li.on{background:${C.panel2};box-shadow:inset 0 0 0 1px ${C.edge};}
.sa-joblist-open{flex:1;min-width:0;display:flex;align-items:flex-start;gap:10px;background:none;border:none;color:${C.ink};text-align:left;padding:10px;cursor:pointer;border-radius:7px;}
.sa-joblist-open:hover{background:${C.panel2};}
.sa-joblist-txt{display:flex;flex-direction:column;gap:2px;min-width:0;}
.sa-joblist-txt b{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.sa-joblist-txt em{font-style:normal;font-size:10.5px;color:${C.inkFaint};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.sa-joblist-del{background:none;border:none;color:${C.inkFaint};font-size:10.5px;padding:0 10px;cursor:pointer;border-radius:6px;}
.sa-joblist-del:hover{color:${C.bad};background:${C.bad}14;}
.sa-status-dot.sm{width:9px;height:9px;margin-top:4px;}
.sa-modal-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:11px 14px;border-top:1px solid ${C.edgeSoft};background:${C.panel2};}
.sa-modal-actions{display:flex;gap:6px;}

/* ---- printed report ---- */
.rp{display:none;}
@media print{
  @page{size:auto;margin:14mm 12mm;}
  html,body,#root{background:#fff !important;}
  .sa-screen{display:none !important;}
  .rp{display:block;color:#111418;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:10.5pt;line-height:1.35;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;}
}
.rp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:2px solid #111418;padding-bottom:8px;}
.rp-eyebrow{font-size:8pt;letter-spacing:.14em;text-transform:uppercase;color:#4A5361;}
.rp h1{font-size:17pt;margin:3px 0 2px;letter-spacing:-.01em;}
.rp-machines{font-size:10.5pt;}
.rp-machines small{color:#4A5361;font-size:8.5pt;}
.rp-overall{font-weight:700;font-size:11pt;letter-spacing:.04em;border:2px solid;border-radius:5px;padding:5px 10px;white-space:nowrap;}
.rp .ok{color:#137A45;} .rp .warn{color:#9A6B00;} .rp .bad{color:#C02A22;}
.rp-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 14px;margin:10px 0 4px;}
.rp-meta div{border-bottom:1px solid #C9CFD6;padding-bottom:3px;}
.rp-meta dt{font-size:7.5pt;text-transform:uppercase;letter-spacing:.08em;color:#4A5361;}
.rp-meta dd{margin:1px 0 0;}
.rp h2{font-size:9pt;text-transform:uppercase;letter-spacing:.1em;margin:14px 0 5px;color:#111418;break-after:avoid;}
.rp-t{width:100%;border-collapse:collapse;font-size:9.5pt;break-inside:avoid;}
.rp-t th,.rp-t td{text-align:left;padding:4px 6px;border-bottom:1px solid #C9CFD6;vertical-align:top;}
.rp-t th{font-weight:600;color:#4A5361;}
.rp-grid thead th{font-size:7.5pt;text-transform:uppercase;letter-spacing:.06em;border-bottom:1.5px solid #111418;}
.rp-t .num{font-family:ui-monospace,Menlo,monospace;white-space:nowrap;}
.rp-g{font-weight:700;font-size:8.5pt;white-space:nowrap;}
.rp-small{font-size:8pt;color:#4A5361;margin:5px 0 0;}
.rp-drawings{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;margin-top:12px;break-inside:avoid;}
.rp-notes{white-space:pre-wrap;margin:0;border:1px solid #C9CFD6;border-radius:4px;padding:6px 8px;}
.rp-sign{display:grid;grid-template-columns:2fr 1fr 2fr;gap:18px;margin-top:26px;font-size:8pt;color:#4A5361;break-inside:avoid;}
.rp-sign span{display:block;border-bottom:1px solid #111418;height:24px;margin-bottom:3px;}
.rp-foot{margin-top:14px;font-size:7.5pt;color:#7A8491;}
.rp .sa-cline{border-color:#C9CFD6;background:#fff;}
.rp .sa-cl-title,.rp .sa-cl-body{fill:#4A5361;}
.rp .sa-cl-meta,.rp .sa-cl-gaplbl{fill:#7A8491;}
.rp .sa-cl-off,.rp .sa-cl-gap{fill:#A15C00;}
`;
