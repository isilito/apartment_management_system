/* ============================================================
   charts.js — dependency-free inline SVG charts.
   Every chart returns an HTML string and scales with its card
   via viewBox + width:100%.
   ============================================================ */
(function (global) {

  var C = {
    teal:  '#0B6E8C',
    teal4: '#2E90AE',
    ghost: '#D7E0E5',
    ring:  '#DDE5EA',
    grid:  '#EEF2F5',
    axis:  '#93A3AC',
    green: '#0E7A55',
    amber: '#A15C07',
    red:   '#B23225'
  };

  /* Round a raw maximum up to a readable axis: a "nice" step
     (1, 2, 2.5 or 5 x 10^n) and a whole number of gridlines. */
  function niceAxis(rawMax, targetTicks) {
    targetTicks = targetTicks || 4;
    var rough = rawMax / targetTicks;
    var mag = Math.pow(10, Math.floor(Math.log10(rough)));
    var step = [1, 2, 2.5, 5, 10].map(function (m) { return m * mag; })
                                 .filter(function (s) { return s >= rough; })[0] || mag * 10;
    var ticks = Math.ceil(rawMax / step);
    return { max: step * ticks, ticks: ticks };
  }

  /* ------------------------------------------------------------
     Grouped bar chart — "Rent collected vs. expected"
     data: [{ month, expected, collected }]
     ------------------------------------------------------------ */
  function groupedBars(data, opt) {
    opt = opt || {};
    var W = opt.width || 740, H = opt.height || 300;
    var padL = 52, padR = 14, padT = 14, padB = 34;
    var plotW = W - padL - padR, plotH = H - padT - padB;

    var axis = niceAxis(Math.max.apply(null, data.map(function (d) {
      return Math.max(d.expected, d.collected);
    })), 4);
    var max = axis.max, ticks = axis.ticks;
    var y = function (v) { return padT + plotH - (v / max) * plotH; };

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" ' +
            'aria-label="Rent collected versus expected by month" ' +
            'style="overflow:visible;font-family:inherit">';

    /* gridlines + y labels */
    for (var i = 0; i <= ticks; i++) {
      var v = (max / ticks) * i, yy = y(v);
      s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yy + '" y2="' + yy +
           '" stroke="' + C.grid + '" stroke-width="1"/>';
      s += '<text x="' + (padL - 10) + '" y="' + (yy + 4) + '" text-anchor="end" ' +
           'font-size="11" fill="' + C.axis + '">' + UI.pesoK(v) + '</text>';
    }

    /* bars */
    /* Bars grow with the available slot so a wide card does not end up
       with hairline bars marooned in a sea of gap. */
    var slot = plotW / data.length;
    var barW = Math.max(10, Math.min(46, slot * 0.26));
    var gap  = Math.max(5, barW * 0.14);

    data.forEach(function (d, idx) {
      var cx = padL + slot * idx + slot / 2;
      var x1 = cx - barW - gap / 2;
      var x2 = cx + gap / 2;
      var isLast = idx === data.length - 1;

      var he = Math.max(2, padT + plotH - y(d.expected));
      var hc = Math.max(2, padT + plotH - y(d.collected));

      s += '<rect x="' + x1 + '" y="' + y(d.expected) + '" width="' + barW + '" height="' + he +
           '" rx="4" fill="' + C.ghost + '"><title>Expected ' + UI.peso(d.expected) + '</title></rect>';
      s += '<rect x="' + x2 + '" y="' + y(d.collected) + '" width="' + barW + '" height="' + hc +
           '" rx="4" fill="' + (isLast ? C.teal : C.teal4) + '"><title>Collected ' +
           UI.peso(d.collected) + '</title></rect>';

      if (isLast) {
        s += '<text x="' + (x2 + barW / 2) + '" y="' + (y(d.collected) - 9) + '" text-anchor="middle" ' +
             'font-size="11.5" font-weight="700" fill="' + C.teal + '">' + UI.pesoK(d.collected) + '</text>';
      }

      s += '<text x="' + cx + '" y="' + (H - 12) + '" text-anchor="middle" font-size="11.5" ' +
           'fill="' + (isLast ? '#10202A' : C.axis) + '" font-weight="' + (isLast ? '600' : '400') + '">' +
           d.month + '</text>';
    });

    /* baseline */
    s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(0) + '" y2="' + y(0) +
         '" stroke="#E4EAEE" stroke-width="1"/>';
    s += '</svg>';
    return s;
  }

  /* ------------------------------------------------------------
     Donut — occupancy split
     segments: [{ label, value, color }]
     ------------------------------------------------------------ */
  function donut(segments, centerTop, centerSub, size) {
    size = size || 200;
    var r = 76, stroke = 26, cx = 100, cy = 100;
    var circ = 2 * Math.PI * r;
    var total = segments.reduce(function (s, x) { return s + x.value; }, 0) || 1;
    var offset = 0;

    var s = '<svg viewBox="0 0 200 200" width="' + size + '" height="' + size +
            '" role="img" aria-label="Unit occupancy breakdown">';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#F1F4F6" stroke-width="' + stroke + '"/>';

    segments.forEach(function (seg) {
      var len = (seg.value / total) * circ;
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" ' +
           'stroke="' + seg.color + '" stroke-width="' + stroke + '" ' +
           'stroke-dasharray="' + len + ' ' + (circ - len) + '" ' +
           'stroke-dashoffset="' + (-offset) + '" ' +
           'transform="rotate(-90 ' + cx + ' ' + cy + ')" stroke-linecap="butt">' +
           '<title>' + UI.esc(seg.label) + ': ' + seg.value + '</title></circle>';
      offset += len;
    });

    s += '<text x="100" y="98" text-anchor="middle" font-size="26" font-weight="800" ' +
         'fill="#10202A" letter-spacing="-0.6">' + UI.esc(centerTop) + '</text>';
    s += '<text x="100" y="116" text-anchor="middle" font-size="11" fill="#6B7C86">' +
         UI.esc(centerSub) + '</text>';
    s += '</svg>';
    return s;
  }

  /* ------------------------------------------------------------
     Area / line chart
     data: [{ label, value }]
     ------------------------------------------------------------ */
  function areaLine(data, opt) {
    opt = opt || {};
    var W = opt.width || 740, H = opt.height || 260;
    var padL = 50, padR = 16, padT = 16, padB = 32;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var uid = 'g' + Math.random().toString(36).slice(2, 8);

    var vals = data.map(function (d) { return d.value; });
    var lo = opt.zero ? 0 : Math.min.apply(null, vals) * 0.94;
    var hi = Math.max.apply(null, vals) * 1.06;
    if (hi === lo) hi = lo + 1;

    var x = function (i) { return padL + (plotW / Math.max(1, data.length - 1)) * i; };
    var y = function (v) { return padT + plotH - ((v - lo) / (hi - lo)) * plotH; };

    var line = data.map(function (d, i) { return (i ? 'L' : 'M') + x(i) + ' ' + y(d.value); }).join(' ');
    var area = line + ' L' + x(data.length - 1) + ' ' + (padT + plotH) + ' L' + padL + ' ' + (padT + plotH) + ' Z';

    var color = opt.color || C.teal;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' +
            UI.esc(opt.label || 'Trend') + '" style="overflow:visible;font-family:inherit">';
    s += '<defs><linearGradient id="' + uid + '" x1="0" y1="0" x2="0" y2="1">' +
         '<stop offset="0%" stop-color="' + color + '" stop-opacity=".20"/>' +
         '<stop offset="100%" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>';

    for (var i = 0; i <= 4; i++) {
      var v = lo + ((hi - lo) / 4) * i, yy = y(v);
      s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yy + '" y2="' + yy +
           '" stroke="' + C.grid + '"/>';
      s += '<text x="' + (padL - 10) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="11" fill="' +
           C.axis + '">' + (opt.fmt ? opt.fmt(v) : Math.round(v)) + '</text>';
    }

    s += '<path d="' + area + '" fill="url(#' + uid + ')"/>';
    s += '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2.5" ' +
         'stroke-linejoin="round" stroke-linecap="round"/>';

    data.forEach(function (d, i) {
      s += '<circle cx="' + x(i) + '" cy="' + y(d.value) + '" r="4" fill="#fff" stroke="' + color +
           '" stroke-width="2.5"><title>' + UI.esc(d.label) + ': ' +
           (opt.fmt ? opt.fmt(d.value) : d.value) + '</title></circle>';
      s += '<text x="' + x(i) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="11.5" fill="' +
           C.axis + '">' + UI.esc(d.label) + '</text>';
    });

    s += '</svg>';
    return s;
  }

  /* ------------------------------------------------------------
     Stacked horizontal bar — payment method mix
     parts: [{ label, value, color }]
     ------------------------------------------------------------ */
  function stackedBar(parts) {
    var total = parts.reduce(function (s, p) { return s + p.value; }, 0) || 1;
    return '<div class="method-bar">' + parts.map(function (p) {
      return '<i style="width:' + (p.value / total * 100) + '%;background:' + p.color + '" title="' +
             UI.esc(p.label) + '"></i>';
    }).join('') + '</div>';
  }

  /* ------------------------------------------------------------
     Ranked rows with a progress bar — "top" lists
     items: [{ label, value, display, tone }]
     ------------------------------------------------------------ */
  function rankList(items) {
    var max = Math.max.apply(null, items.map(function (i) { return i.value; })) || 1;
    return '<div class="rank">' + items.map(function (i) {
      return '<div class="rank-item">' +
               '<div class="r-top"><b>' + UI.esc(i.label) + '</b>' +
                 (i.sub ? '<span class="u-muted u-xs">' + UI.esc(i.sub) + '</span>' : '') +
                 '<span class="v">' + (i.display || i.value) + '</span></div>' +
               UI.meter(i.value / max * 100, i.tone || 'teal') +
             '</div>';
    }).join('') + '</div>';
  }

  /* ------------------------------------------------------------
     Sparkline — tiny inline trend
     ------------------------------------------------------------ */
  function sparkline(values, color, w, h) {
    w = w || 92; h = h || 28;
    var lo = Math.min.apply(null, values), hi = Math.max.apply(null, values);
    if (hi === lo) hi = lo + 1;
    var pts = values.map(function (v, i) {
      return (i / (values.length - 1)) * w + ',' + (h - ((v - lo) / (hi - lo)) * (h - 4) - 2);
    }).join(' ');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '">' +
           '<polyline points="' + pts + '" fill="none" stroke="' + (color || C.teal) +
           '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  /* Measured width of a mount point, so a chart is drawn at 1:1 instead
     of being scaled up (and its labels enlarged) on a wide monitor. */
  function widthOf(idOrEl, fallback) {
    var el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
    var w = el ? Math.round(el.clientWidth) : 0;
    return w > 200 ? w : (fallback || 740);
  }

  global.Charts = {
    colors: C,
    widthOf: widthOf,
    groupedBars: groupedBars,
    donut: donut,
    areaLine: areaLine,
    stackedBar: stackedBar,
    rankList: rankList,
    sparkline: sparkline
  };

})(window);
