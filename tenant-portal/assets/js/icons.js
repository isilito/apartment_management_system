/* ============================================================
   icons.js — inline SVG icon set (Lucide-style, 24x24 stroke)
   Usage:  icon('wrench')            -> <svg>...</svg>
           icon('wrench', 'cls')     -> with extra class
   ============================================================ */
(function (global) {
  var P = {
    /* nav */
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    building:  '<path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M15 9h2a2 2 0 0 1 2 2v10"/><path d="M9 7h2M9 11h2M9 15h2"/>',
    users:     '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user:      '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    card:      '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    chart:     '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="12.5" y="8" width="3" height="10" rx="1"/><rect x="18" y="5" width="3" height="13" rx="1"/>',
    wrench:    '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    activity:  '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    settings:  '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    help:      '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',

    /* topbar / chrome */
    search:    '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
    bell:      '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    menu:      '<path d="M3 6h18M3 12h18M3 18h18"/>',
    chevDown:  '<path d="m6 9 6 6 6-6"/>',
    chevRight: '<path d="m9 18 6-6-6-6"/>',
    chevLeft:  '<path d="m15 18-6-6 6-6"/>',
    close:     '<path d="M18 6 6 18M6 6l12 12"/>',
    plus:      '<path d="M12 5v14M5 12h14"/>',
    arrowRight:'<path d="M5 12h14M12 5l7 7-7 7"/>',
    check:     '<path d="M20 6 9 17l-5-5"/>',
    more:      '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    send:      '<path d="m22 2-7 20-4-9-9-4 20-7z"/>',
    sparkle:   '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="M6.3 6.3 9 9M15 15l2.7 2.7M17.7 6.3 15 9M9 15l-2.7 2.7"/>',
    logout:    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',

    /* status / meta */
    clock:     '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    peso:      '<path d="M7 20V5h5.5a4 4 0 0 1 0 8H7"/><path d="M4 9.5h10M4 13h10"/>',
    trendUp:   '<path d="m3 17 6-6 4 4 8-8"/><path d="M17 7h4v4"/>',
    trendDown: '<path d="m3 7 6 6 4-4 8 8"/><path d="M17 17h4v-4"/>',
    alert:     '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
    info:      '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    mail:      '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    phone:     '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    calendar:  '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    filter:    '<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>',
    download:  '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    upload:    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    edit:      '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    trash:     '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/>',
    eye:       '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    file:      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    folder:    '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.5l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"/>',
    home:      '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    key:       '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 8.3-8.3"/><path d="m17 5 2.5 2.5"/><path d="m14.5 7.5 2.5 2.5"/>',
    doorOpen:  '<path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h20"/><path d="M13 2v20l-8-2V4l8-2z"/><path d="M10.5 12v.01"/>',
    shield:    '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    pieChart:  '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
    lineChart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
    layers:    '<path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 17 9 5 9-5"/><path d="m3 12 9 5 9-5"/>',
    receipt:   '<path d="M4 2v20l2-1.5L8 22l2-1.5L12 22l2-1.5L16 22l2-1.5L20 22V2l-2 1.5L16 2l-2 1.5L12 2l-2 1.5L8 2 6 3.5 4 2z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    wallet:    '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
    bank:      '<path d="m3 10 9-6 9 6"/><path d="M5 10v9M9.5 10v9M14.5 10v9M19 10v9"/><path d="M3 21h18"/>',
    cash:      '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    smartphone:'<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18.5h2"/>',
    bolt:      '<path d="M13 2 3 14h8l-1 8 10-12h-8l1-8z"/>',
    droplet:   '<path d="M12 2.7 6.9 7.8a7.2 7.2 0 1 0 10.2 0L12 2.7z"/>',
    paint:     '<rect x="2" y="3" width="20" height="7" rx="2"/><path d="M12 10v4a2 2 0 0 0 2 2h1"/><rect x="13" y="16" width="6" height="5" rx="1.5"/>',
    bug:       '<path d="M8 2v3M16 2v3"/><rect x="8" y="6" width="8" height="14" rx="4"/><path d="M3 10h5M16 10h5M3 15h5M16 15h5M4 20l4-3M20 20l-4-3"/>',
    lock:      '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    bookOpen:  '<path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z"/>',
    play:      '<circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4V8z"/>',
    message:   '<path d="M21 11.5a8.38 8.38 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.5 8.5 0 0 1 4 12a8.38 8.38 0 0 1 8.4-9 8.5 8.5 0 0 1 8.6 8.5z"/>',
    bot:       '<rect x="3" y="8" width="18" height="12" rx="3"/><path d="M12 8V4M9 4h6"/><circle cx="9" cy="14" r="1.2"/><circle cx="15" cy="14" r="1.2"/>',
    refresh:   '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
    print:     '<path d="M6 9V2h12v7"/><rect x="2" y="9" width="20" height="8" rx="2"/><path d="M6 14h12v8H6z"/>',
    star:      '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2z"/>',
    flag:      '<path d="M4 22V4s1.5-1 4-1 4 2 7 2 4-1 4-1v11s-1.5 1-4 1-4-2-7-2-4 1-4 1z"/>',
    archive:   '<rect x="2" y="4" width="20" height="5" rx="1.5"/><path d="M4 9v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>',
    idCard:    '<rect x="2" y="4" width="20" height="16" rx="2.5"/><circle cx="8.5" cy="11" r="2.5"/><path d="M4.5 17c.7-1.8 2.2-2.6 4-2.6s3.3.8 4 2.6"/><path d="M15 9.5h4M15 13h4"/>',
    mapPin:    '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    globe:     '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>',
    palette:   '<path d="M12 2a10 10 0 1 0 0 20 2 2 0 0 0 1.6-3.2 2 2 0 0 1 1.6-3.2H18a4 4 0 0 0 4-4 10 10 0 0 0-10-9.6z"/><circle cx="7.5" cy="11.5" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="16.5" cy="11" r="1.2"/>'
  };

  function icon(name, cls) {
    var d = P[name];
    if (!d) { d = P.info; }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
           'stroke-linecap="round" stroke-linejoin="round"' +
           (cls ? ' class="' + cls + '"' : '') + '>' + d + '</svg>';
  }

  global.icon = icon;
  global.ICONS = P;
})(window);
