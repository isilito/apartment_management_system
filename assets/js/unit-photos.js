/* ============================================================
   unit-photos.js — pictures of the units, for the admin console
   and the tenant portal (both load this one file).

   HOW TO ADD THE REAL PHOTOS
   --------------------------
   Make a folder named after the unit number inside
   assets/img/units/ and save the photos in it. They show in
   file-name order and the first one is the cover on the unit
   card, so naming them 1.jpg, 2.jpg … is easiest.

       assets/img/units/201/1.jpg    ← cover (living room works best)
       assets/img/units/201/2.jpg
       assets/img/units/J203/1.jpg

   A unit with no folder shows the placeholder photos for its
   type (Studio, 1-Bedroom, 2-Bedroom, Bedspace) from
   assets/img/units/placeholders/. To change the picture for
   every unit of one type at once, replace those files instead.

   Building photos: assets/img/units/buildings/B1.jpg, B2.jpg …
   (the building id). Without one, a placeholder is shown.

   Landscape photos about 1600 px wide look best. On XAMPP any
   .jpg, .png or .webp works; on Vercel use 1.jpg, 2.jpg … (it
   checks those names, up to 8 per unit).
   ============================================================ */
(function (global) {

  var inPortal = /\/tenant-portal\//.test(location.pathname);
  var ROOT = (inPortal ? '../' : '') + 'assets/img/units/';
  var PH = ROOT + 'placeholders/';
  var MAX = 8;

  /* Placeholder sets, one per unit type: [file, what it shows] */
  var SETS = {
    studio:   [['studio-1', 'Living and sleeping area'], ['studio-2', 'Bed and dining corner'], ['studio-3', 'Shower']],
    '1br':    [['1br-1', 'Living room'], ['1br-2', 'Bedroom'], ['1br-3', 'Kitchen'], ['1br-4', 'Bathroom']],
    '2br':    [['2br-1', 'Living and dining area'], ['2br-2', 'Main bedroom'], ['2br-3', 'Second bedroom'], ['2br-4', 'Kitchen']],
    bedspace: [['bedspace-1', 'Shared room'], ['bedspace-2', 'Bunk beds'], ['bedspace-3', 'Shared bathroom']]
  };
  var BUILDINGS = { B1: 'building-B1', B2: 'building-B2' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Accepts an admin unit ({no, typeKey}) or the tenant's rental ({unitNo, typeKey}) */
  function norm(u) {
    u = u || {};
    return { no: String(u.no || u.unitNo || u.id || ''), type: u.typeKey || '', building: u.buildingId || '' };
  }
  function folder(no) { return ROOT + encodeURIComponent(no.replace(/[^A-Za-z0-9_-]/g, '')) + '/'; }

  /* Units of one type share a placeholder set; starting half of them on the
     set's second room keeps a page of cards from repeating one picture. */
  function placeholders(u) {
    var set = (SETS[u.type] || SETS['1br']).slice();
    var h = 0;
    for (var i = 0; i < u.no.length; i++) h = (h * 31 + u.no.charCodeAt(i)) % 997;
    if (h % 2 && set.length > 1) set = [set[1], set[0]].concat(set.slice(2));
    return set.map(function (p) {
      return { src: PH + p[0] + '.jpg', sm: PH + p[0] + '-sm.jpg', label: p[1], real: false };
    });
  }

  /* ---------- real photos ----------
     api/photos.php lists what is in the folders (one request, any
     image type). Where it cannot (listed:false, or no PHP), the
     browser checks for 1.jpg, 2.jpg … itself. */
  var listing = null;
  function getListing() {
    if (!listing) {
      listing = fetch((inPortal ? '../' : '') + 'api/photos.php', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : { listed: false }; })
        .catch(function () { return { listed: false }; });
    }
    return listing;
  }

  function probe(src) {
    return new Promise(function (res) {
      var i = new Image();
      i.onload = function () { res(true); };
      i.onerror = function () { res(false); };
      i.src = src;
    });
  }

  function fromFiles(dir, files) {
    return files.map(function (f, i) {
      var src = dir + encodeURIComponent(f);
      return { src: src, sm: src, label: 'Photo ' + (i + 1), real: true };
    });
  }

  var found = {};
  function realPhotos(no) {
    if (!no || no === '—') return Promise.resolve([]);
    if (found[no]) return found[no];
    var dir = folder(no);
    found[no] = getListing().then(function (l) {
      if (l.listed) return fromFiles(dir, (l.units && l.units[no]) || []);
      return probe(dir + '1.jpg').then(function (ok) {
        if (!ok) return [];
        var rest = [];
        for (var n = 2; n <= MAX; n++) rest.push(probe(dir + n + '.jpg'));
        return Promise.all(rest).then(function (oks) {
          var files = ['1.jpg'];
          oks.forEach(function (o, i) { if (o) files.push((i + 2) + '.jpg'); });
          return fromFiles(dir, files);
        });
      });
    });
    return found[no];
  }

  /** Promise of the unit's photos: the real ones when any exist, else the placeholders */
  function photos(unit) {
    var u = norm(unit);
    return realPhotos(u.no).then(function (list) { return list.length ? list : placeholders(u); });
  }

  /** <img> of the unit's cover. Starts on the placeholder and switches to the
      real cover (see hydrate) once one is found. */
  function cover(unit, opts) {
    opts = opts || {};
    var u = norm(unit);
    var p = placeholders(u)[0];
    return '<img class="' + (opts.cls || '') + '" src="' + (opts.large ? p.src : p.sm) + '" ' +
      'data-unit-cover="' + esc(u.no) + '" data-large="' + (opts.large ? 1 : 0) + '" ' +
      'alt="Unit ' + esc(u.no) + ', ' + esc(p.label.toLowerCase()) + '" ' +
      'loading="' + (opts.eager ? 'eager' : 'lazy') + '" decoding="async" />';
  }

  /** Swap every placeholder cover inside root for the real photo, if one exists */
  function hydrate(root) {
    (root || document).querySelectorAll('img[data-unit-cover]').forEach(function (img) {
      var no = img.getAttribute('data-unit-cover');
      realPhotos(no).then(function (list) {
        if (list.length && img.getAttribute('src') !== list[0].src) {
          img.src = list[0].src;
          img.alt = 'Unit ' + no;
        }
      });
    });
  }

  function building(id, name) {
    var file = BUILDINGS[id] || 'building-B1';
    return '<img src="' + PH + file + '-sm.jpg" data-building-photo="' + esc(id) + '" ' +
      'alt="' + esc(name || 'Building') + '" loading="lazy" decoding="async" />';
  }
  function hydrateBuildings(root) {
    var imgs = (root || document).querySelectorAll('img[data-building-photo]');
    if (!imgs.length) return;
    getListing().then(function (l) {
      imgs.forEach(function (img) {
        var id = img.getAttribute('data-building-photo');
        if (l.listed) {
          var f = l.buildings && l.buildings[id];
          if (f) img.src = ROOT + 'buildings/' + encodeURIComponent(f);
        } else {
          var src = ROOT + 'buildings/' + id + '.jpg';
          probe(src).then(function (ok) { if (ok) img.src = src; });
        }
      });
    });
  }

  /** Gallery: one big photo and a row of thumbnails. Fills itself. */
  var gid = 0;
  function gallery(unit) {
    var id = 'ugal' + (++gid);
    var u = norm(unit);
    var first = placeholders(u)[0];
    setTimeout(function () { fillGallery(id, unit); }, 0);
    return '<div class="gallery" id="' + id + '">' +
      '<div class="gallery-main"><img src="' + first.src + '" alt="Unit ' + esc(u.no) + ', ' +
        esc(first.label.toLowerCase()) + '" decoding="async" /></div>' +
      '<div class="gallery-thumbs" role="list"></div></div>';
  }
  function fillGallery(id, unit) {
    var el = document.getElementById(id);
    if (!el) return;
    var u = norm(unit);
    photos(unit).then(function (list) {
      el = document.getElementById(id);
      if (!el) return;
      var main = el.querySelector('.gallery-main img');
      main.src = list[0].src;
      main.alt = 'Unit ' + u.no + ', ' + list[0].label.toLowerCase();
      el.querySelector('.gallery-thumbs').innerHTML = list.length < 2 ? '' : list.map(function (p, i) {
        return '<button type="button" role="listitem" class="' + (i === 0 ? 'on' : '') + '" data-i="' + i + '" ' +
          'aria-label="Show ' + esc(p.label.toLowerCase()) + '"' + (i === 0 ? ' aria-current="true"' : '') + '>' +
          '<img src="' + p.sm + '" alt="" loading="lazy" decoding="async" /></button>';
      }).join('');
      el.querySelector('.gallery-thumbs').onclick = function (e) {
        var b = e.target.closest('button[data-i]');
        if (!b) return;
        var p = list[+b.dataset.i];
        main.src = p.src;
        main.alt = 'Unit ' + u.no + ', ' + p.label.toLowerCase();
        el.querySelectorAll('.gallery-thumbs button').forEach(function (x) {
          x.classList.toggle('on', x === b);
          if (x === b) x.setAttribute('aria-current', 'true'); else x.removeAttribute('aria-current');
        });
      };
    });
  }

  global.UnitPhotos = {
    photos: photos, cover: cover, hydrate: hydrate, gallery: gallery,
    building: building, hydrateBuildings: hydrateBuildings
  };

})(window);
