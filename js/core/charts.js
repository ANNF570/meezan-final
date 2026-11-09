/* ============================================================
   MEEZAN — ميزان  |  js/core/charts.js
   Dependency-free charts that scale to any screen width.
   ============================================================ */

import { esc, fmtShort, fmt } from './utils.js';

/* labels: ['Jun','Jul',…]   series: [{ name, color, values:[…] }] */
export function barsHtml(labels, series, opts) {
    const o = opts || {};
    const height = o.height || 120;
    let max = 1;
    series.forEach(function(s) { s.values.forEach(function(v) { if (v > max) { max = v; } }); });
    let html = '<div class="bars" style="--bars-h:' + height + 'px">';
    labels.forEach(function(lbl, i) {
        html += '<div class="bars-col"><div class="bars-stack">';
        series.forEach(function(s) {
            const v = s.values[i] || 0;
            const h = v > 0 ? Math.max(3, Math.round((v / max) * 100)) : 0;
            html += '<div class="bar" style="height:' + h + '%;background:' + s.color + '" title="' + esc(s.name + ': ' + fmt(v)) + '"></div>';
        });
        html += '</div><div class="bars-lbl">' + esc(lbl) + '</div></div>';
    });
    html += '</div>';
    if (series.length > 1 || o.legend) {
        html += '<div class="legend">' + series.map(function(s) {
            return '<span class="legend-item"><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>';
        }).join('') + '</div>';
    }
    return html;
}

/* entries: [{ label, value, color }] */
export function donutSvg(entries, opts) {
    const o = opts || {};
    const size = o.size || 150;
    const stroke = o.stroke || 22;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const total = entries.reduce(function(s, e) { return s + e.value; }, 0);
    if (total <= 0) { return '<div class="empty small"><div>No data yet</div></div>'; }
    let offset = 0;
    let arcs = '';
    entries.forEach(function(e) {
        const len = (e.value / total) * c;
        arcs += '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + e.color +
            '" stroke-width="' + stroke + '" stroke-dasharray="' + len.toFixed(2) + ' ' + (c - len).toFixed(2) +
            '" stroke-dashoffset="' + (-offset).toFixed(2) + '"><title>' + esc(e.label + ': ' + fmt(e.value)) + '</title></circle>';
        offset += len;
    });
    const center = o.center ? '<div class="donut-center"><div class="donut-val">' + o.center.value + '</div>' +
        '<div class="donut-sub">' + esc(o.center.label) + '</div></div>' : '';
    const legend = '<ul class="donut-legend">' + entries.slice(0, o.maxLegend || 8).map(function(e) {
        const p = Math.round((e.value / total) * 100);
        return '<li><i style="background:' + e.color + '"></i><span class="dl-name">' + esc(e.label) + '</span>' +
            '<span class="dl-val">' + fmtShort(e.value) + ' · ' + p + '%</span></li>';
    }).join('') + '</ul>';
    return '<div class="donut-wrap"><div class="donut" style="width:' + size + 'px;height:' + size + 'px">' +
        '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" style="transform:rotate(-90deg)">' +
        arcs + '</svg>' + center + '</div>' + legend + '</div>';
}

/* ── AREA / LINE CHART (responsive SVG) ───────────────────────
   labels: ['Jan',…]  series: [{ name, color, values:[…], fill:true }] */
export function areaSvg(labels, series, opts) {
    const o = opts || {};
    const W = 600;
    const H = o.height || 190;
    const pl = 8;
    const pr = 8;
    const pt = 12;
    const pb = 26;
    let max = 1;
    let min = 0;
    series.forEach(function(s) { s.values.forEach(function(v) { if (v > max) { max = v; } if (v < min) { min = v; } }); });
    const n = Math.max(1, labels.length - 1);
    const x = function(i) { return pl + (i / n) * (W - pl - pr); };
    const y = function(v) { return pt + (1 - (v - min) / ((max - min) || 1)) * (H - pt - pb); };
    const uid = 'ag' + Math.random().toString(36).slice(2, 7);
    let defs = '';
    let body = '';
    for (let g = 0; g <= 3; g++) {
        const gy = pt + (g / 3) * (H - pt - pb);
        body += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '" stroke="currentColor" stroke-opacity="0.1"/>';
    }
    if (min < 0) { body += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '" stroke="currentColor" stroke-opacity="0.35" stroke-dasharray="4 4"/>'; }
    series.forEach(function(s, k) {
        const pts = s.values.map(function(v, i) { return [x(i), y(v)]; });
        const line = pts.map(function(p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
        if (s.fill !== false) {
            defs += '<linearGradient id="' + uid + k + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + s.color + '" stop-opacity="0.45"/><stop offset="100%" stop-color="' + s.color + '" stop-opacity="0"/></linearGradient>';
            body += '<path d="' + line + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + y(Math.max(0, min)).toFixed(1) + ' L' + pts[0][0].toFixed(1) + ' ' + y(Math.max(0, min)).toFixed(1) + ' Z" fill="url(#' + uid + k + ')"/>';
        }
        body += '<path d="' + line + '" fill="none" stroke="' + s.color + '" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>';
        pts.forEach(function(p, i) {
            body += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.6" fill="' + s.color + '"><title>' + esc(s.name + ' · ' + labels[i] + ': ' + fmt(s.values[i])) + '</title></circle>';
        });
    });
    labels.forEach(function(l, i) {
        if (labels.length > 8 && i % 2 === 1 && i !== labels.length - 1) { return; }
        body += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 7) + '" text-anchor="middle" font-size="11" fill="currentColor" fill-opacity="0.6">' + esc(l) + '</text>';
    });
    let html = '<svg class="area-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" style="width:100%;height:' + H * 0.8 + 'px;display:block"><defs>' + defs + '</defs>' + body + '</svg>';
    if (series.length > 1 || o.legend) {
        html += '<div class="legend">' + series.map(function(s) { return '<span class="legend-item"><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>'; }).join('') + '</div>';
    }
    return html;
}

/* ── GAUGE (half circle) ─────────────────────────────────────── */
export function gaugeSvg(pct, label, color) {
    const p = Math.max(0, Math.min(100, pct));
    const r = 70;
    const c = Math.PI * r;
    const col = color || (p >= 50 ? '#1abc9c' : p >= 20 ? '#e67e22' : '#e74c3c');
    return '<div class="gauge"><svg viewBox="0 0 180 104" role="img" aria-label="' + esc(label) + ' ' + Math.round(p) + '%">' +
        '<path d="M20 90 A70 70 0 0 1 160 90" fill="none" stroke="currentColor" stroke-opacity="0.14" stroke-width="14" stroke-linecap="round"/>' +
        '<path d="M20 90 A70 70 0 0 1 160 90" fill="none" stroke="' + col + '" stroke-width="14" stroke-linecap="round" stroke-dasharray="' + (c * p / 100).toFixed(1) + ' ' + c.toFixed(1) + '"/>' +
        '</svg><div class="gauge-val"><b>' + Math.round(p) + '%</b><small>' + esc(label) + '</small></div></div>';
}

/* ── HORIZONTAL BARS ─ entries: [{ label, value, color, icon }] ─ */
export function hbarsHtml(entries, opts) {
    const o = opts || {};
    const max = entries.reduce(function(m, e) { return Math.max(m, e.value); }, 1);
    const total = entries.reduce(function(s, e) { return s + e.value; }, 0) || 1;
    if (!entries.length) { return '<div class="empty small"><div>No data yet</div></div>'; }
    return '<div class="hbars">' + entries.slice(0, o.max || 6).map(function(e) {
        return '<div class="hbar"><div class="hbar-top"><span>' + (e.icon ? e.icon + ' ' : '') + esc(e.label) + '</span><b class="num">' + fmtShort(e.value) + ' <span class="dim">' + Math.round((e.value / total) * 100) + '%</span></b></div>' +
            '<div class="hbar-track"><div class="hbar-fill" style="width:' + Math.max(3, (e.value / max) * 100).toFixed(1) + '%;background:' + e.color + '"></div></div></div>';
    }).join('') + '</div>';
}
