/*
 * E-learningspeler. Dezelfde speler als in minor-ce-elearnings, maar los van
 * fetch en van document.body: hij tekent in een element dat je meegeeft.
 * Zo draait hij zowel in het voorbeeld van de bouwer als in een geëxporteerd
 * bestand.
 *
 *   Speler(root, cursus, {
 *     sleutel: 'elearning:',   voorvoegsel voor de voortgang in localStorage
 *     hash: true,              module in location.hash (alleen in een eigen pagina)
 *     scroller: window,        wat er scrolt
 *     voorbeeld: false,        externe video's en insluitingen als plaatshouder
 *     allesTonen: false,       alle stukken open, zonder doorgaan-knoppen
 *     opModule: function (id) {},  melding als de lezer een module opent
 *     opslag: { lees, schrijf }    eigen opslag van de voortgang, bijvoorbeeld
 *                                  een LMS via SCORM; anders localStorage
 *   })
 */
function Speler(root, cursus, opts) {
  'use strict';
  opts = opts || {};
  var sleutel = (opts.sleutel || 'elearning:') + cursus.id;
  var staat = leesStaat();
  var huidig = null;

  function leesStaat() {
    try {
      var ruw = opts.opslag ? opts.opslag.lees() : localStorage.getItem(sleutel);
      var s = JSON.parse(ruw || 'null');
      return s && s.modules ? s : { modules: {} };
    } catch (e) {
      return { modules: {} };
    }
  }

  function bewaar() {
    try {
      if (opts.opslag) opts.opslag.schrijf(JSON.stringify(staat), staat, huidig);
      else localStorage.setItem(sleutel, JSON.stringify(staat));
    } catch (e) { /* privacymodus of LMS weg */ }
  }

  function moduleStaat(id) {
    if (!staat.modules[id]) staat.modules[id] = { segment: 0, af: false, antwoorden: {} };
    return staat.modules[id];
  }

  /* ------------------------------------------------------------ hulp */

  function el(tag, klasse, tekst) {
    var e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (tekst !== undefined && tekst !== null) e.textContent = tekst;
    return e;
  }

  function html(tag, klasse, inhoud) {
    var e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (inhoud) e.innerHTML = inhoud;
    return e;
  }

  function naarBoven() {
    var s = opts.scroller || window;
    if (s === window) window.scrollTo(0, 0); else s.scrollTop = 0;
  }

  /* Het adres bijwerken mag mislukken: in sommige frames van een leeromgeving
     is de geschiedenis afgeschermd. De speler werkt dan gewoon zonder. */
  function zetAdres(adres) {
    try { history.replaceState(null, '', adres); } catch (e) { /* afgeschermd frame */ }
  }

  function host(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  /* Platte tekst in een element zetten, met webadressen als klikbare link. */
  function metLinks(doel, tekst) {
    String(tekst).split(/(https?:\/\/[^\s]+)/).forEach(function (stuk, i) {
      if (i % 2 === 0) {
        if (stuk) doel.appendChild(document.createTextNode(stuk));
        return;
      }
      var staart = (stuk.match(/[.,;:)]+$/) || [''])[0];
      var adres = stuk.slice(0, stuk.length - staart.length);
      var a = el('a', null, adres.replace(/^https?:\/\//, '').replace(/\/$/, ''));
      a.href = adres;
      a.target = '_blank';
      a.rel = 'noopener';
      doel.appendChild(a);
      if (staart) doel.appendChild(document.createTextNode(staart));
    });
    return doel;
  }

  /* Blokken opdelen in stukken tot aan elke doorgaan-knop. Elk blok onthoudt
     zijn plek in de module, zodat de bouwer ernaartoe kan scrollen. */
  function segmenteer(blokken) {
    var segmenten = [];
    var huidigSeg = [];
    blokken.forEach(function (b, gi) {
      if (b.t === 'continue') {
        segmenten.push(huidigSeg);
        huidigSeg = [];
      } else {
        huidigSeg.push({ blok: b, gi: gi });
      }
    });
    if (huidigSeg.length) segmenten.push(huidigSeg);
    return segmenten.filter(function (s) { return s.length; });
  }

  /* In een toets staat elke vraag op een eigen stuk, samen met de blokken
     die ervoor staan. Met hussel krijgt elke poging een andere volgorde; wat
     vóór de eerste vraag staat, blijft vooraan. */
  function segmentenVan(les) {
    if (!les.toets) return segmenteer(les.blocks);
    var ms = moduleStaat(les.id);
    var groepen = [];
    var los = [];
    les.blocks.forEach(function (b, gi) {
      if (b.t === 'continue') return;
      los.push({ blok: b, gi: gi });
      if (SCOREBAAR.indexOf(b.t) >= 0 && telbaar(b)) {
        groepen.push(los);
        los = [];
      }
    });
    if (les.toets.hussel && groepen.length > 1) {
      var voor = groepen[0].slice(0, -1);
      groepen[0] = groepen[0].slice(-1);
      groepen = husselVolgorde(les.id + ':' + (ms.poging || 0), groepen.length).map(function (i) { return groepen[i]; });
      groepen[0] = voor.concat(groepen[0]);
    }
    if (los.length) {
      if (groepen.length) groepen[groepen.length - 1] = groepen[groepen.length - 1].concat(los);
      else groepen.push(los);
    }
    return groepen;
  }

  function slaaggrens(les) {
    var g = les.toets && les.toets.slagen;
    if (g === undefined || g === null || g === '') return 70;
    g = Number(g);
    return isNaN(g) ? 70 : Math.min(100, Math.max(0, Math.round(g)));
  }

  function vraagId(moduleId, segIndex, blokIndex) {
    return moduleId + ':' + segIndex + ':' + blokIndex;
  }

  /* Vaste, maar per vraag verschillende volgorde (Fisher-Yates, geseed). */
  function husselVolgorde(id, aantal) {
    var zaad = 1;
    for (var c = 0; c < id.length; c++) zaad = (zaad * 31 + id.charCodeAt(c)) % 2147483647;
    function volgende() {
      zaad = (zaad * 16807) % 2147483647;
      return zaad / 2147483647;
    }
    var volgorde = [];
    for (var i = 0; i < aantal; i++) volgorde.push(i);
    for (var j = aantal - 1; j > 0; j--) {
      var k = Math.floor(volgende() * (j + 1));
      var tmp = volgorde[j]; volgorde[j] = volgorde[k]; volgorde[k] = tmp;
    }
    /* Toevallig de oorspronkelijke volgorde: dan één plek doorschuiven, zodat
       de antwoorden nooit gewoon op volgorde staan. */
    if (aantal > 1 && volgorde.every(function (v, i) { return v === i; })) volgorde.push(volgorde.shift());
    return volgorde;
  }

  /* ------------------------------------------------------------ startpagina */

  function toonStart() {
    huidig = null;
    if (opts.hash && location.hash) zetAdres(location.pathname + location.search);
    if (opts.hash) document.title = cursus.title;
    root.innerHTML = '';

    var totaalSeg = 0, gedaanSeg = 0;
    cursus.lessons.forEach(function (les) {
      var segs = segmentenVan(les).length;
      var ms = moduleStaat(les.id);
      totaalSeg += segs;
      gedaanSeg += Math.min(ms.af ? segs : ms.segment, segs);
    });
    var percentage = totaalSeg ? Math.round((gedaanSeg / totaalSeg) * 100) : 0;
    var begonnen = gedaanSeg > 0;

    var hero = el('header', 'hero');
    var binnen = el('div', 'hero-inner');
    if (cursus.kicker !== '') binnen.appendChild(el('p', 'kicker', cursus.kicker || 'E-learning'));
    binnen.appendChild(el('h1', null, cursus.title || 'Naamloze e-learning'));
    if (cursus.subtitle) binnen.appendChild(el('p', 'sub', cursus.subtitle));

    if (cursus.author) {
      var au = el('div', 'auteur');
      var initialen = cursus.author.split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
      au.appendChild(el('span', 'bol', initialen));
      au.appendChild(el('span', null, 'Door ' + cursus.author));
      binnen.appendChild(au);
    }

    if (cursus.lessons.length) {
      var allesAf = cursus.lessons.every(function (l) { return moduleStaat(l.id).af; });
      var start = el('button', 'btn-groot',
        allesAf ? 'Cursus opnieuw bekijken' : (begonnen ? 'Verder waar je gebleven was' : 'Start de cursus'));
      start.type = 'button';
      start.addEventListener('click', function () {
        var doel = cursus.lessons.find(function (l) { return !moduleStaat(l.id).af; }) || cursus.lessons[0];
        openModule(doel.id);
      });
      binnen.appendChild(start);
    }

    if (begonnen) {
      var vb = el('div', 'voortgangsbalk');
      var spoor = el('div', 'spoor');
      var vulling = el('div', 'vulling');
      vulling.style.width = percentage + '%';
      spoor.appendChild(vulling);
      vb.appendChild(spoor);
      vb.appendChild(el('div', 'tekst', percentage + '% van de cursus doorlopen'));
      binnen.appendChild(vb);
    }

    hero.appendChild(binnen);
    root.appendChild(hero);

    var lijst = el('div', 'modules');
    if (cursus.intro) lijst.appendChild(el('p', 'intro', cursus.intro));

    cursus.lessons.forEach(function (les, i) {
      var segs = segmentenVan(les).length;
      var ms = moduleStaat(les.id);
      var gedaan = ms.af ? segs : Math.min(ms.segment, segs);
      var pct = segs ? Math.round((gedaan / segs) * 100) : 0;

      var kaart = el('button', 'module-kaart' + (ms.af ? ' af' : (gedaan > 0 ? ' bezig' : '')));
      kaart.type = 'button';
      kaart.appendChild(el('span', 'nummer', ms.af ? '✓' : String(i + 1)));

      var midden = el('span');
      midden.appendChild(el('h2', null, les.title || 'Module ' + (i + 1)));
      var regel = el('span', 'regel');
      if (les.deadline) regel.appendChild(el('span', 'deadline', 'Afronden vóór ' + les.deadline));
      if (les.toets) {
        regel.appendChild(el('span', 'toets-label', 'Toets'));
        regel.appendChild(el('span', null, ms.af ? 'Gehaald, ' + (ms.score || 0) + '%'
          : (ms.score !== undefined ? 'Nog niet gehaald, beste score ' + ms.score + '%' : segs + (segs === 1 ? ' vraag' : ' vragen'))));
      } else {
        regel.appendChild(el('span', null, ms.af ? 'Afgerond' : (gedaan > 0 ? pct + '% gelezen' : segs + (segs === 1 ? ' onderdeel' : ' onderdelen'))));
      }
      if (gedaan > 0 && !ms.af && !les.toets) {
        var mini = el('span', 'mini-spoor');
        var i2 = el('i');
        i2.style.width = pct + '%';
        mini.appendChild(i2);
        regel.appendChild(mini);
      }
      midden.appendChild(regel);
      kaart.appendChild(midden);
      kaart.appendChild(el('span', 'pijl', '→'));
      kaart.addEventListener('click', function () { openModule(les.id); });
      lijst.appendChild(kaart);
    });

    if (!cursus.lessons.length) lijst.appendChild(el('p', 'intro', 'Deze e-learning heeft nog geen modules.'));

    root.appendChild(lijst);
    naarBoven();
    if (opts.opModule) opts.opModule(null);
  }

  /* ------------------------------------------------------------ blokweergave */

  /* Externe inhoud kan in het voorbeeld van de bouwer niet worden geladen;
     daar toont de speler een kaart die zegt wat er komt. */
  function externVoorbeeld(soort, titel, url) {
    var k = el('div', 'extern-voorbeeld');
    k.appendChild(el('span', 'speel', soort === 'video' ? '▶' : soort === 'audio' ? '♪' : '⧉'));
    var t = el('span');
    t.appendChild(el('strong', null, titel || (soort === 'video' ? 'Video' : soort === 'audio' ? 'Audio' : 'Ingesloten inhoud')));
    t.appendChild(el('span', 'bron', (host(url) || url) + ' · speelt af in de geëxporteerde e-learning'));
    k.appendChild(t);
    return k;
  }

  function beeldEl(b) {
    var img = document.createElement('img');
    img.decoding = 'async';
    img.alt = b.alt || '';
    if (b.w) {
      img.width = b.w;
      img.height = b.h;
    }
    img.src = b.src;
    return img;
  }

  function initialen(naam) {
    return String(naam).split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
  }

  var NOTITIES = { tip: 'Tip', let: 'Let op', info: 'Goed om te weten', opdracht: 'Opdracht' };

  function tekenBlok(blok, moduleId, segIndex, blokIndex, opWijziging) {
    switch (blok.t) {

      case 'text': {
        var wrap = el('div', 'blok');
        if (blok.heading) wrap.appendChild(el('h2', null, blok.heading));
        if (blok.body) wrap.appendChild(html('div', null, blok.body));
        return wrap;
      }

      case 'list': {
        var lijst = el(blok.ordered ? 'ol' : 'ul');
        (blok.items || []).forEach(function (i) { lijst.appendChild(html('li', null, i)); });
        var w = el('div', 'blok');
        w.appendChild(lijst);
        return w;
      }

      case 'image': {
        if (!blok.src) return null;
        var fig = el('figure', 'beeld');
        var img = document.createElement('img');
        img.decoding = 'async';
        img.alt = blok.alt || blok.caption || '';
        if (blok.w) {
          img.width = blok.w;
          img.height = blok.h;
          img.style.maxWidth = blok.w + 'px';
        }
        img.src = blok.src;
        fig.appendChild(img);
        if (blok.caption) fig.appendChild(metLinks(el('figcaption'), blok.caption));
        return fig;
      }

      case 'video': {
        var houder = el('div');
        var titel = blok.title || 'Video';
        var bron = blok.youtube ? 'https://www.youtube.com/watch?v=' + blok.youtube
          : blok.vimeo ? 'https://vimeo.com/' + blok.vimeo : blok.url;
        if (!bron) return null;
        if (opts.voorbeeld && (blok.youtube || blok.vimeo)) {
          houder.appendChild(externVoorbeeld('video', titel, bron));
          return houder;
        }
        /* Een los geopend bestand (file://) geeft geen herkomst mee, en dan
           weigert YouTube af te spelen (fout 153). Dan een knop naar YouTube. */
        var alsBestand = blok.youtube && location.protocol === 'file:';
        if ((blok.url && !blok.youtube && !blok.vimeo) || alsBestand) {
          /* Een video op een site die niet ingesloten wil worden. */
          var ext = el('a', 'video-extern');
          ext.href = alsBestand ? bron : blok.url;
          ext.target = '_blank';
          ext.rel = 'noopener';
          ext.appendChild(el('span', 'speel', '▶'));
          var tekstje = el('span');
          tekstje.appendChild(el('strong', null, titel));
          tekstje.appendChild(el('span', 'bron', 'Bekijk de video op ' + (host(alsBestand ? bron : blok.url) || 'de site van de maker') + ' ↗'));
          ext.appendChild(tekstje);
          houder.appendChild(ext);
          return houder;
        }
        var kader = el('div', 'video');
        var fr = document.createElement('iframe');
        if (blok.vimeo) {
          fr.src = 'https://player.vimeo.com/video/' + blok.vimeo + '?dnt=1';
        } else {
          var params = 'rel=0&modestbranding=1';
          if (blok.start) params += '&start=' + blok.start;
          fr.src = 'https://www.youtube-nocookie.com/embed/' + blok.youtube + '?' + params;
        }
        fr.title = titel;
        /* YouTube wil weten op welke site hij staat; ook als de pagina zelf
           strenger is ingesteld. */
        fr.referrerPolicy = 'strict-origin-when-cross-origin';
        fr.loading = 'lazy';
        fr.allow = 'accelerometer; clipboard-write; encrypted-media; picture-in-picture; fullscreen';
        fr.allowFullscreen = true;
        kader.appendChild(fr);
        houder.appendChild(kader);
        if (blok.title) houder.appendChild(el('div', 'video-titel', blok.title));
        return houder;
      }

      case 'embed': {
        /* Elke site die zich laat insluiten: Padlet, Mentimeter, Google
           Slides, Canva, Genially, H5P, Spotify. Met een link eronder voor als
           de site het insluiten toch weigert. */
        if (!blok.url) return null;
        var fig2 = el('figure', 'insluiting');
        if (opts.voorbeeld) {
          fig2.appendChild(externVoorbeeld('embed', blok.title, blok.url));
          return fig2;
        }
        var kader2 = el('div', 'insluiting-kader');
        kader2.style.height = (blok.height || 480) + 'px';
        var fr2 = document.createElement('iframe');
        fr2.src = blok.url;
        fr2.title = blok.title || 'Ingesloten inhoud';
        fr2.referrerPolicy = 'strict-origin-when-cross-origin';
        fr2.loading = 'lazy';
        fr2.allow = 'fullscreen; clipboard-write; autoplay; encrypted-media; picture-in-picture';
        fr2.allowFullscreen = true;
        kader2.appendChild(fr2);
        fig2.appendChild(kader2);
        var onder = el('figcaption');
        if (blok.title) onder.appendChild(el('span', null, blok.title + ' · '));
        var gewoon = /^https?:\/\//i.test(blok.bron || '') ? blok.bron : blok.url;
        onder.appendChild(el('span', null, 'Zie je niets? '));
        var a2 = el('a', null, 'Open op ' + (host(gewoon) || 'de site') + ' ↗');
        a2.href = gewoon;
        a2.target = '_blank';
        a2.rel = 'noopener';
        onder.appendChild(a2);
        fig2.appendChild(onder);
        return fig2;
      }

      case 'tabs': {
        if (!(blok.items || []).length) return null;
        var t = el('div', 'tabs');
        var knoppen = el('div', 'tab-knoppen');
        knoppen.setAttribute('role', 'tablist');
        var inhoud = el('div', 'tab-inhoud');
        blok.items.forEach(function (tab, i) {
          var k = el('button', null, tab.title || 'Tab ' + (i + 1));
          k.type = 'button';
          k.setAttribute('role', 'tab');
          k.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
          k.addEventListener('click', function () {
            knoppen.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-selected', 'false'); });
            k.setAttribute('aria-selected', 'true');
            inhoud.innerHTML = tab.body || '';
          });
          knoppen.appendChild(k);
        });
        inhoud.innerHTML = blok.items[0].body || '';
        t.appendChild(knoppen);
        t.appendChild(inhoud);
        return t;
      }

      case 'accordion': {
        if (!(blok.items || []).length) return null;
        var acc = el('div', 'accordeon');
        blok.items.forEach(function (item) {
          var d = document.createElement('details');
          d.appendChild(el('summary', null, item.title || 'Onderdeel'));
          d.appendChild(html('div', 'accordeon-inhoud', item.body));
          acc.appendChild(d);
        });
        return acc;
      }

      case 'cards': {
        if (!(blok.items || []).length) return null;
        var houder2 = el('div', 'kaartjes-blok');
        houder2.appendChild(el('div', 'kaartjes-hint', 'Klik op een kaartje om het om te draaien.'));
        var rooster = el('div', 'kaartjes');
        blok.items.forEach(function (k) {
          var kaartje = el('div', 'kaartje');
          kaartje.setAttribute('role', 'button');
          kaartje.tabIndex = 0;
          kaartje.setAttribute('aria-pressed', 'false');
          /* De inhoud in één binnenblok, anders worden losse woorden, vet en
             regeleinden elk een eigen flex-element en lopen ze door elkaar. */
          var voor = el('div', 'voorkant');
          voor.appendChild(html('div', null, k.front));
          var achter = el('div', 'achterkant');
          achter.appendChild(html('div', null, k.back));
          kaartje.appendChild(voor);
          kaartje.appendChild(achter);
          var draai = function () {
            kaartje.setAttribute('aria-pressed', kaartje.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
          };
          kaartje.addEventListener('click', draai);
          kaartje.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); draai(); }
          });
          rooster.appendChild(kaartje);
        });
        houder2.appendChild(rooster);
        return houder2;
      }

      case 'quote':
        return blok.body ? html('blockquote', 'statement', blok.body) : null;

      case 'links': {
        var items = (blok.items || []).filter(function (l) { return l.href; });
        if (!items.length) return null;
        var lw = el('div', 'linkjes');
        items.forEach(function (l) {
          var a = el('a', 'linkknop', l.label || host(l.href) || l.href);
          a.href = l.href;
          a.target = '_blank';
          a.rel = 'noopener';
          a.appendChild(el('span', 'pijltje', '↗'));
          lw.appendChild(a);
        });
        return lw;
      }

      case 'timeline': {
        if (!(blok.items || []).length) return null;
        var tl = el('ol', 'tijdlijn');
        blok.items.forEach(function (p) {
          var li = el('li');
          if (p.date) li.appendChild(el('div', 'tijdlijn-label', p.date));
          if (p.title) li.appendChild(el('h3', null, p.title));
          if (p.body) li.appendChild(html('div', null, p.body));
          tl.appendChild(li);
        });
        return tl;
      }

      case 'steps': {
        var st = el('div', 'stappenplan');
        st.appendChild(el('div', 'label', 'Stappenplan'));
        if (blok.intro && (blok.intro.title || blok.intro.body)) {
          if (blok.intro.title) st.appendChild(el('h3', null, blok.intro.title));
          if (blok.intro.body) st.appendChild(el('p', null, blok.intro.body));
        }
        var ol = el('ol', 'stappen');
        (blok.steps || []).forEach(function (s) {
          var li = el('li');
          li.appendChild(el('strong', null, s.title));
          if (s.body) li.appendChild(el('p', null, s.body));
          ol.appendChild(li);
        });
        st.appendChild(ol);
        if (blok.summary && (blok.summary.title || blok.summary.body)) {
          var sam = el('div', 'stappen-slot');
          if (blok.summary.title) sam.appendChild(el('strong', null, blok.summary.title));
          if (blok.summary.body) sam.appendChild(el('p', null, blok.summary.body));
          st.appendChild(sam);
        }
        return st;
      }

      case 'svg': {
        var fig3 = el('figure', 'schema');
        var doos = el('div', 'schema-vlak');
        doos.innerHTML = blok.svg || '';
        var s = doos.querySelector('svg');
        if (s) {
          s.setAttribute('role', 'img');
          if (blok.alt) s.setAttribute('aria-label', blok.alt);
        }
        fig3.appendChild(doos);
        if (blok.caption) fig3.appendChild(el('figcaption', null, blok.caption));
        return fig3;
      }

      case 'imagetext': {
        if (!blok.src && !blok.heading && !blok.body) return null;
        var bt = el('div', 'beeld-tekst' + (blok.kant === 'rechts' ? ' rechts' : ''));
        if (blok.src) {
          var btFig = el('figure');
          btFig.appendChild(beeldEl(blok));
          if (blok.caption) btFig.appendChild(metLinks(el('figcaption'), blok.caption));
          bt.appendChild(btFig);
        }
        var btTekst = el('div', 'blok');
        if (blok.heading) btTekst.appendChild(el('h2', null, blok.heading));
        if (blok.body) btTekst.appendChild(html('div', null, blok.body));
        bt.appendChild(btTekst);
        return bt;
      }

      case 'gallery':
        return tekenGalerij(blok);

      case 'hotspots':
        return blok.src ? tekenKlikplaat(blok) : null;

      case 'audio': {
        if (!blok.url) return null;
        var au = el('figure', 'audio-blok');
        if (opts.voorbeeld) {
          au.appendChild(externVoorbeeld('audio', blok.title, blok.url));
        } else {
          if (blok.title) au.appendChild(el('div', 'audio-titel', blok.title));
          var geluid = document.createElement('audio');
          geluid.controls = true;
          geluid.preload = 'metadata';
          geluid.src = blok.url;
          if (blok.title) geluid.setAttribute('aria-label', blok.title);
          au.appendChild(geluid);
        }
        if (blok.transcript) {
          var ud = document.createElement('details');
          ud.className = 'audio-tekst';
          ud.appendChild(el('summary', null, 'Lees de tekst mee'));
          ud.appendChild(html('div', null, blok.transcript));
          au.appendChild(ud);
        }
        return au;
      }

      case 'note': {
        if (!blok.body) return null;
        var soort = NOTITIES[blok.soort] ? blok.soort : 'tip';
        var nt = el('aside', 'notitie notitie-' + soort);
        nt.appendChild(el('div', 'notitie-label', blok.title || NOTITIES[soort]));
        nt.appendChild(html('div', 'notitie-tekst', blok.body));
        return nt;
      }

      case 'table': {
        var tRijen = (blok.rows || []).filter(function (r) { return r.some(function (c) { return String(c).trim(); }); });
        if (!tRijen.length) return null;
        var tFig = el('figure', 'tabel-blok');
        var tScroll = el('div', 'tabel-scroll');
        tScroll.tabIndex = 0;
        tScroll.setAttribute('role', 'region');
        tScroll.setAttribute('aria-label', blok.caption || 'Tabel');
        var tab = el('table');
        if (blok.caption) tab.appendChild(el('caption', null, blok.caption));
        var tEerste = 0;
        if (blok.kop !== false) {
          var thead = el('thead');
          var tr0 = el('tr');
          tRijen[0].forEach(function (c) {
            var th = el('th', null, c);
            th.scope = 'col';
            tr0.appendChild(th);
          });
          thead.appendChild(tr0);
          tab.appendChild(thead);
          tEerste = 1;
        }
        var tbody = el('tbody');
        tRijen.slice(tEerste).forEach(function (r) {
          var tr = el('tr');
          r.forEach(function (c, ci) {
            var cel = el(ci === 0 && blok.zijkop ? 'th' : 'td');
            if (ci === 0 && blok.zijkop) cel.scope = 'row';
            tr.appendChild(metLinks(cel, c));
          });
          tbody.appendChild(tr);
        });
        tab.appendChild(tbody);
        tScroll.appendChild(tab);
        tFig.appendChild(tScroll);
        return tFig;
      }

      case 'chart':
        return tekenGrafiek(blok);

      case 'divider':
        return el('hr', 'scheiding');

      case 'fill':
        if (!/\[[^\]]+\]/.test(blok.text || '')) return null;
        return tekenInvul(blok, moduleId, segIndex, blokIndex, opWijziging);

      case 'scenario':
        if (!(blok.scenes || []).length) return null;
        return tekenScenario(blok, moduleId, segIndex, blokIndex, opWijziging);

      case 'quiz':
        if (!(blok.options || []).length) return null;
        return tekenQuiz(blok, moduleId, segIndex, blokIndex, opWijziging);

      case 'match':
        if (!(blok.pairs || []).length) return null;
        return tekenKoppel(blok, moduleId, segIndex, blokIndex, opWijziging);

      case 'sort':
        if (!(blok.items || []).length || !(blok.piles || []).length) return null;
        return tekenSorteer(blok, moduleId, segIndex, blokIndex, opWijziging);
    }
    return null;
  }

  /* Blokken die beantwoord moeten zijn voordat de doorgaan-knop opengaat. */
  var VRAAGTYPEN = ['quiz', 'match', 'sort', 'fill', 'scenario'];
  /* Vragen die goed of fout kunnen zijn en meetellen voor een score. Een
     scenario hoort er niet bij: dat moet je alleen doorlopen. */
  var SCOREBAAR = ['quiz', 'match', 'sort', 'fill'];

  function telbaar(b) {
    if (b.t === 'quiz') return (b.options || []).length > 0;
    if (b.t === 'match') return (b.pairs || []).length > 0;
    if (b.t === 'sort') return (b.items || []).length > 0 && (b.piles || []).length > 0;
    if (b.t === 'fill') return /\[[^\]]+\]/.test(b.text || '');
    if (b.t === 'scenario') return (b.scenes || []).length > 0;
    return false;
  }

  /* In een toets kun je een vraag niet opnieuw proberen. */
  var inToets = false;

  /* -------------------------------------------- galerij */

  function tekenGalerij(blok) {
    var dia = (blok.items || []).filter(function (x) { return x.src; });
    if (!dia.length) return null;
    var g = el('figure', 'galerij');
    g.setAttribute('role', 'group');
    g.setAttribute('aria-roledescription', 'carrousel');
    g.setAttribute('aria-label', blok.title || 'Afbeeldingen');
    var vlak = el('div', 'galerij-vlak');
    var beelden = dia.map(function (d, i) {
      var img = beeldEl(d);
      img.hidden = i !== 0;
      vlak.appendChild(img);
      return img;
    });
    g.appendChild(vlak);
    var onder = el('div', 'galerij-onder');
    var vorige = el('button', 'galerij-knop', '←');
    vorige.type = 'button';
    vorige.setAttribute('aria-label', 'Vorige afbeelding');
    var volgende = el('button', 'galerij-knop', '→');
    volgende.type = 'button';
    volgende.setAttribute('aria-label', 'Volgende afbeelding');
    var tekst = el('figcaption', 'galerij-tekst');
    tekst.setAttribute('aria-live', 'polite');
    onder.appendChild(vorige);
    onder.appendChild(tekst);
    onder.appendChild(volgende);
    g.appendChild(onder);
    var nu = 0;
    function toon(n) {
      nu = (n + dia.length) % dia.length;
      beelden.forEach(function (b, i) { b.hidden = i !== nu; });
      tekst.innerHTML = '';
      if (dia.length > 1) tekst.appendChild(el('span', 'galerij-teller', (nu + 1) + ' / ' + dia.length));
      if (dia[nu].caption) tekst.appendChild(metLinks(el('span'), dia[nu].caption));
    }
    if (dia.length < 2) vorige.hidden = volgende.hidden = true;
    vorige.addEventListener('click', function () { toon(nu - 1); });
    volgende.addEventListener('click', function () { toon(nu + 1); });
    g.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') toon(nu - 1);
      else if (e.key === 'ArrowRight') toon(nu + 1);
    });
    /* Vegen op een telefoon. */
    var x0 = null;
    vlak.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
    vlak.addEventListener('pointerup', function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) toon(nu + (dx < 0 ? 1 : -1));
    });
    toon(0);
    return g;
  }

  /* -------------------------------------------- klikplaat */

  /* Een afbeelding met genummerde punten. De uitleg verschijnt onder de
     afbeelding, zodat hij ook op een telefoon leesbaar blijft. */
  function tekenKlikplaat(blok) {
    var punten = blok.points || [];
    var k = el('div', 'klikplaat');
    var kop = el('div', 'klikplaat-hint');
    kop.appendChild(el('span', null, blok.intro || 'Klik op de nummers in de afbeelding.'));
    var teller = el('span', 'klikplaat-teller');
    kop.appendChild(teller);
    k.appendChild(kop);
    var vlak = el('div', 'klikplaat-vlak');
    vlak.appendChild(beeldEl(blok));
    var paneel = el('div', 'klikplaat-paneel');
    paneel.setAttribute('aria-live', 'polite');
    paneel.hidden = true;
    var gezien = {};
    var knoppen = punten.map(function (p, i) {
      var b = el('button', 'klikpunt', String(i + 1));
      b.type = 'button';
      b.style.left = p.x + '%';
      b.style.top = p.y + '%';
      b.setAttribute('aria-label', (i + 1) + '. ' + (p.title || 'Punt ' + (i + 1)));
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { open(i); });
      vlak.appendChild(b);
      return b;
    });
    k.appendChild(vlak);
    k.appendChild(paneel);

    function werkTellerBij() {
      var n = Object.keys(gezien).length;
      teller.textContent = punten.length ? n + ' van ' + punten.length + ' bekeken' : '';
    }

    function open(i) {
      var p = punten[i];
      gezien[i] = 1;
      knoppen.forEach(function (b, j) {
        b.setAttribute('aria-pressed', j === i ? 'true' : 'false');
        if (gezien[j]) b.classList.add('gezien');
      });
      paneel.hidden = false;
      paneel.innerHTML = '';
      var pk = el('div', 'klikplaat-kop');
      pk.appendChild(el('span', 'klikpunt-nr', String(i + 1)));
      pk.appendChild(el('h3', null, p.title || 'Punt ' + (i + 1)));
      paneel.appendChild(pk);
      if (p.body) paneel.appendChild(html('div', 'klikplaat-tekst', p.body));
      if (punten.length > 1) {
        var nav = el('div', 'klikplaat-nav');
        var terug = el('button', 'knop-klein stil', '← Vorige');
        terug.type = 'button';
        terug.addEventListener('click', function () { open((i - 1 + punten.length) % punten.length); });
        var verder = el('button', 'knop-klein stil', 'Volgende →');
        verder.type = 'button';
        verder.addEventListener('click', function () { open((i + 1) % punten.length); });
        nav.appendChild(terug);
        nav.appendChild(verder);
        paneel.appendChild(nav);
      }
      werkTellerBij();
    }

    werkTellerBij();
    return k;
  }

  /* -------------------------------------------- grafiek */

  function tekenGrafiek(blok) {
    var items = (blok.items || []).filter(function (x) { return x.label || Number(x.value); });
    if (!items.length) return null;
    var eenheid = blok.unit || '';
    function getal(v) {
      var s = (Number(v) || 0).toLocaleString('nl-NL');
      if (!eenheid) return s;
      if (eenheid === '€') return '€ ' + s;
      return eenheid === '%' ? s + '%' : s + ' ' + eenheid;
    }
    var fig = el('figure', 'grafiek');
    if (blok.title) fig.appendChild(el('div', 'grafiek-titel', blok.title));
    if (blok.soort === 'cirkel') {
      var totaal = items.reduce(function (s, x) { return s + Math.max(0, Number(x.value) || 0); }, 0) || 1;
      var rij = el('div', 'grafiek-cirkel');
      /* Een ring met omtrek 100, zodat een percentage direct de streeplengte is. */
      var svg = '<svg viewBox="0 0 42 42" aria-hidden="true"><circle cx="21" cy="21" r="15.9155" fill="none" stroke-width="7" style="stroke:var(--go-vlak)"/>';
      var al = 0;
      items.forEach(function (x, i) {
        var deel = Math.max(0, Number(x.value) || 0) / totaal * 100;
        svg += '<circle cx="21" cy="21" r="15.9155" fill="none" stroke-width="7" stroke-dasharray="' + deel.toFixed(3) + ' ' + (100 - deel).toFixed(3)
          + '" stroke-dashoffset="' + (25 - al).toFixed(3) + '" style="stroke:var(--g' + (i % 6 + 1) + ')"/>';
        al += deel;
      });
      rij.innerHTML = svg + '</svg>';
      var legenda = el('ul', 'grafiek-legenda');
      items.forEach(function (x, i) {
        var li = el('li');
        var vak = el('span', 'kleur');
        vak.style.background = 'var(--g' + (i % 6 + 1) + ')';
        li.appendChild(vak);
        li.appendChild(el('span', null, x.label));
        li.appendChild(el('strong', null, getal(x.value) + (eenheid === '%' ? '' : ' (' + Math.round(Math.max(0, Number(x.value) || 0) / totaal * 100) + '%)')));
        legenda.appendChild(li);
      });
      rij.appendChild(legenda);
      fig.appendChild(rij);
    } else {
      var max = Math.max.apply(null, items.map(function (x) { return Math.abs(Number(x.value) || 0); })) || 1;
      var staven = el('div', 'grafiek-staven');
      items.forEach(function (x) {
        var r = el('div', 'staaf-rij');
        r.appendChild(el('span', 'staaf-label', x.label));
        var spoor = el('span', 'staaf-spoor');
        var vul = el('i');
        vul.style.width = (Math.max(0, Number(x.value) || 0) / max * 100) + '%';
        spoor.appendChild(vul);
        r.appendChild(spoor);
        r.appendChild(el('span', 'staaf-waarde', getal(x.value)));
        staven.appendChild(r);
      });
      fig.appendChild(staven);
    }
    if (blok.caption) fig.appendChild(metLinks(el('figcaption'), blok.caption));
    return fig;
  }

  /* -------------------------------------------- invulvraag */

  /* De gaten staan tussen [haken]; met | scheid je andere goede antwoorden,
     zoals [hergebruik|reuse]. Hoofdletters en leestekens tellen niet mee. */
  function normaal(s) {
    return String(s || '').toLowerCase().replace(/[-‐–]/g, ' ').replace(/\s+/g, ' ').replace(/^[\s.,;:!?]+|[\s.,;:!?]+$/g, '');
  }

  function tekenInvul(blok, moduleId, segIndex, blokIndex, opWijziging) {
    var id = vraagId(moduleId, segIndex, blokIndex);
    var ms = moduleStaat(moduleId);
    var bewaard = ms.antwoorden[id];

    var kaart = el('div', 'vraag');
    kaart.appendChild(el('div', 'label', 'Invulvraag'));
    if (blok.question) kaart.appendChild(html('div', 'stelling', blok.question));

    var zin = el('p', 'invul-tekst');
    var gaten = [];
    String(blok.text).split(/(\[[^\]]+\])/).forEach(function (stuk) {
      var m = stuk.match(/^\[([^\]]+)\]$/);
      if (!m) {
        if (stuk) zin.appendChild(document.createTextNode(stuk));
        return;
      }
      var goed = m[1].split('|').map(function (s) { return s.trim(); }).filter(Boolean);
      var inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'invul-gat';
      inp.autocomplete = 'off';
      inp.spellcheck = false;
      inp.setAttribute('autocapitalize', 'off');
      inp.size = Math.max(6, Math.max.apply(null, goed.map(function (g) { return g.length; })) + 2);
      inp.setAttribute('aria-label', 'Invulplek ' + (gaten.length + 1));
      zin.appendChild(inp);
      gaten.push({ inp: inp, goed: goed });
    });
    kaart.appendChild(zin);

    var acties = el('div', 'vraag-acties');
    var nakijkKnop = el('button', 'knop-klein', 'Nakijken');
    nakijkKnop.type = 'button';
    nakijkKnop.disabled = true;
    var opnieuwKnop = el('button', 'knop-klein stil', 'Opnieuw proberen');
    opnieuwKnop.type = 'button';
    opnieuwKnop.style.display = 'none';
    var toonKnop = el('button', 'knop-klein stil', 'Laat het antwoord zien');
    toonKnop.type = 'button';
    toonKnop.style.display = 'none';
    acties.appendChild(nakijkKnop);
    acties.appendChild(opnieuwKnop);
    acties.appendChild(toonKnop);
    kaart.appendChild(acties);
    var uitslagVak = el('div');
    kaart.appendChild(uitslagVak);

    function leeg() { return gaten.some(function (g) { return !g.inp.value.trim(); }); }
    gaten.forEach(function (g) {
      g.inp.addEventListener('input', function () { nakijkKnop.disabled = leeg(); });
      g.inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !leeg() && !g.inp.readOnly) nakijkKnop.click();
      });
    });

    function klopt(g, waarde) { return g.goed.some(function (x) { return normaal(x) === normaal(waarde); }); }

    /* Net als bij de meerkeuzevraag: het juiste antwoord verschijnt pas als
       de student erom vraagt of niet meer mag herkansen. */
    function toonUitslag(keuze, getoond) {
      var aantal = 0;
      gaten.forEach(function (g, i) { if (klopt(g, keuze[i])) aantal++; });
      var alles = aantal === gaten.length;
      var open = alles || inToets || !!getoond;
      Array.prototype.forEach.call(zin.querySelectorAll('.invul-correctie'), function (c) { c.remove(); });
      gaten.forEach(function (g, i) {
        g.inp.value = keuze[i];
        g.inp.readOnly = true;
        var ok = klopt(g, keuze[i]);
        g.inp.classList.remove('goed', 'fout');
        g.inp.classList.add(ok ? 'goed' : 'fout');
        if (!ok && open) g.inp.insertAdjacentElement('afterend', el('span', 'invul-correctie', g.goed[0]));
      });
      var meer = gaten.length > 1;
      var stand = meer ? aantal + ' van de ' + gaten.length + ' goed. ' : 'Niet goed. ';
      var uitleg, tekst;
      if (alles) {
        uitleg = blok.feedback;
        tekst = 'Klopt.';
      } else if (open) {
        uitleg = getoond ? (blok.feedback || blok.feedbackWrong) : (blok.feedbackWrong || blok.feedback);
        tekst = (getoond ? '' : stand)
          + (meer ? 'Achter de rode vakken staat het juiste antwoord.' : 'Het juiste antwoord staat erachter.');
      } else {
        uitleg = blok.feedbackWrong;
        tekst = stand.trim();
      }
      uitslagVak.innerHTML = '';
      var u = el('div', 'uitslag ' + (alles ? 'goed' : 'fout'));
      u.textContent = tekst + (uitleg ? ' ' + uitleg : '');
      uitslagVak.appendChild(u);
      nakijkKnop.style.display = 'none';
      opnieuwKnop.style.display = open ? 'none' : '';
      toonKnop.style.display = open ? 'none' : '';
      return alles;
    }

    nakijkKnop.addEventListener('click', function () {
      var keuze = gaten.map(function (g) { return g.inp.value.trim(); });
      var goed = toonUitslag(keuze);
      ms.antwoorden[id] = { keuze: keuze, goed: goed };
      bewaar();
      opWijziging();
    });

    toonKnop.addEventListener('click', function () {
      if (ms.antwoorden[id]) ms.antwoorden[id].getoond = true;
      bewaar();
      toonUitslag(gaten.map(function (g) { return g.inp.value; }), true);
    });

    /* Wat al goed was blijft staan; alleen de foute vakken gaan leeg. */
    opnieuwKnop.addEventListener('click', function () {
      delete ms.antwoorden[id];
      bewaar();
      var eersteFout = null;
      gaten.forEach(function (g) {
        g.inp.readOnly = false;
        if (!klopt(g, g.inp.value)) {
          g.inp.value = '';
          if (!eersteFout) eersteFout = g.inp;
        }
        g.inp.classList.remove('goed', 'fout');
      });
      uitslagVak.innerHTML = '';
      nakijkKnop.style.display = '';
      nakijkKnop.disabled = leeg();
      opnieuwKnop.style.display = 'none';
      toonKnop.style.display = 'none';
      if (eersteFout) eersteFout.focus({ preventScroll: true });
      opWijziging();
    });

    if (bewaard && bewaard.keuze && bewaard.keuze.length === gaten.length) toonUitslag(bewaard.keuze, bewaard.getoond);
    else if (bewaard) delete ms.antwoorden[id];

    kaart.dataset.vraag = id;
    return kaart;
  }

  /* -------------------------------------------- scenario */

  /* Een gesprek met keuzes. Elke keuze krijgt een reactie en leidt naar een
     volgende scène of naar het einde. Af als de student het einde haalt. */
  function tekenScenario(blok, moduleId, segIndex, blokIndex, opWijziging) {
    var id = vraagId(moduleId, segIndex, blokIndex);
    var ms = moduleStaat(moduleId);
    var bewaard = ms.antwoorden[id];
    var scenes = blok.scenes;
    function sceneIndex(sid) {
      for (var n = 0; n < scenes.length; n++) if (scenes[n].id === sid) return n;
      return -1;
    }

    var kaart = el('div', 'scenario');
    kaart.appendChild(el('div', 'label', 'Scenario'));
    var naam = blok.persoon || 'Gesprekspartner';
    var kop = el('div', 'scenario-kop');
    kop.appendChild(el('span', 'scenario-bol', initialen(naam)));
    var kt = el('span');
    kt.appendChild(el('strong', null, naam));
    if (blok.rol) kt.appendChild(el('small', null, blok.rol));
    kop.appendChild(kt);
    kaart.appendChild(kop);
    if (blok.intro) kaart.appendChild(html('div', 'scenario-intro', blok.intro));
    var gesprek = el('div', 'gesprek');
    gesprek.setAttribute('aria-live', 'polite');
    var keuzes = el('div', 'scenario-keuzes');
    kaart.appendChild(gesprek);
    kaart.appendChild(keuzes);
    var pad = [];

    function zeg(wie, inhoud, alsHtml) {
      var b = el('div', 'ballon ' + wie);
      if (alsHtml) b.innerHTML = inhoud; else b.textContent = inhoud;
      gesprek.appendChild(b);
    }

    function toonKeuze(c) {
      zeg('jij', c.text);
      if (c.reactie) zeg('zij', c.reactie);
      if (c.uitleg) zeg('uitleg', c.uitleg);
    }

    function scene(n) {
      keuzes.innerHTML = '';
      var s = scenes[n];
      if (!s) return einde();
      if (s.text) zeg('zij', s.text, true);
      (s.choices || []).forEach(function (c, ci) {
        if (!c.text) return;
        var b = el('button', 'scenario-keuze', c.text);
        b.type = 'button';
        b.addEventListener('click', function () { kies(n, ci); });
        keuzes.appendChild(b);
      });
      if (!keuzes.children.length) einde();
    }

    function kies(n, ci) {
      var c = scenes[n].choices[ci];
      pad.push([n, ci]);
      keuzes.innerHTML = '';
      toonKeuze(c);
      var naar = sceneIndex(c.naar);
      var verder = el('button', 'knop-klein', naar >= 0 ? 'Verder' : 'Afronden');
      verder.type = 'button';
      verder.addEventListener('click', function () {
        /* Een kring van scènes houdt ergens op. */
        if (naar >= 0 && pad.length < 60) scene(naar); else einde();
      });
      keuzes.appendChild(verder);
      verder.focus({ preventScroll: true });
    }

    function einde() {
      keuzes.innerHTML = '';
      var slot = el('div', 'scenario-slot');
      if (blok.slot) slot.appendChild(html('div', null, blok.slot));
      var opnieuw = el('button', 'knop-klein stil', 'Opnieuw spelen');
      opnieuw.type = 'button';
      opnieuw.addEventListener('click', function () {
        pad = [];
        gesprek.innerHTML = '';
        scene(0);
      });
      slot.appendChild(opnieuw);
      keuzes.appendChild(slot);
      if (!ms.antwoorden[id]) {
        ms.antwoorden[id] = { pad: pad.slice(), klaar: true };
        bewaar();
        opWijziging();
      }
    }

    var geldig = bewaard && Array.isArray(bewaard.pad) && bewaard.pad.every(function (st) {
      return scenes[st[0]] && (scenes[st[0]].choices || [])[st[1]];
    });
    if (geldig) {
      bewaard.pad.forEach(function (st) {
        var s = scenes[st[0]];
        if (s.text) zeg('zij', s.text, true);
        toonKeuze(s.choices[st[1]]);
      });
      pad = bewaard.pad.slice();
      einde();
    } else {
      if (bewaard) delete ms.antwoorden[id];
      scene(0);
    }

    kaart.dataset.vraag = id;
    return kaart;
  }

  /* -------------------------------------------- meerkeuze en meervoudig */

  function tekenQuiz(blok, moduleId, segIndex, blokIndex, opWijziging) {
    var id = vraagId(moduleId, segIndex, blokIndex);
    var ms = moduleStaat(moduleId);
    var bewaard = ms.antwoorden[id];

    var kaart = el('div', 'vraag');
    kaart.appendChild(el('div', 'label', blok.multi ? 'Meerdere antwoorden' : 'Kennisvraag'));
    kaart.appendChild(html('div', 'stelling', blok.question));

    var gekozen = bewaard ? bewaard.keuze.slice() : [];
    var nagekeken = !!bewaard;

    var opties = el('div', 'opties');
    var knoppen = [];

    blok.options.forEach(function (optie, i) {
      var k = el('button', 'optie');
      k.type = 'button';
      if (blok.multi) k.setAttribute('data-multi', '1');
      k.setAttribute('aria-pressed', 'false');
      k.appendChild(el('span', 'vink', blok.multi ? '✓' : '●'));
      k.appendChild(el('span', null, optie.text));
      k.addEventListener('click', function () {
        if (nagekeken) return;
        if (blok.multi) {
          var p = gekozen.indexOf(i);
          if (p >= 0) gekozen.splice(p, 1); else gekozen.push(i);
        } else {
          gekozen = [i];
        }
        knoppen.forEach(function (b, j) { b.setAttribute('aria-pressed', gekozen.indexOf(j) >= 0 ? 'true' : 'false'); });
        nakijkKnop.disabled = gekozen.length === 0;
      });
      knoppen.push(k);
      opties.appendChild(k);
    });
    kaart.appendChild(opties);

    var acties = el('div', 'vraag-acties');
    var nakijkKnop = el('button', 'knop-klein', 'Nakijken');
    nakijkKnop.type = 'button';
    nakijkKnop.disabled = true;
    var opnieuwKnop = el('button', 'knop-klein stil', 'Opnieuw proberen');
    opnieuwKnop.type = 'button';
    opnieuwKnop.style.display = 'none';
    var toonKnop = el('button', 'knop-klein stil', 'Laat het antwoord zien');
    toonKnop.type = 'button';
    toonKnop.style.display = 'none';
    acties.appendChild(nakijkKnop);
    acties.appendChild(opnieuwKnop);
    acties.appendChild(toonKnop);
    kaart.appendChild(acties);

    var uitslagVak = el('div');
    kaart.appendChild(uitslagVak);

    /* Bij een fout antwoord blijft het juiste antwoord verborgen zolang de
       student nog wil proberen; pas na "Laat het antwoord zien" (of in een
       toets, waar herkansen niet kan) wordt het groen. */
    function toonUitslag(keuze, getoond) {
      var juist = blok.options.map(function (o, i) { return o.correct ? i : -1; }).filter(function (i) { return i >= 0; });
      var goed = juist.length === keuze.length && juist.every(function (i) { return keuze.indexOf(i) >= 0; });
      var open = goed || inToets || !!getoond;

      knoppen.forEach(function (b, i) {
        var hier = keuze.indexOf(i) >= 0;
        b.disabled = true;
        b.classList.remove('goed', 'fout');
        b.setAttribute('aria-pressed', hier ? 'true' : 'false');
        if (blok.options[i].correct && (open || hier)) b.classList.add('goed');
        else if (hier) b.classList.add('fout');
        var weg = b.querySelector('.optie-uitleg');
        if (weg) weg.remove();
      });

      uitslagVak.innerHTML = '';
      var u = el('div', 'uitslag ' + (goed ? 'goed' : 'fout'));
      var uitleg, tekst;
      if (goed) {
        uitleg = blok.feedback;
        tekst = 'Klopt.';
      } else if (open) {
        uitleg = getoond ? (blok.feedback || blok.feedbackWrong) : (blok.feedbackWrong || blok.feedback);
        tekst = (getoond ? '' : (blok.multi ? 'Niet helemaal. ' : 'Niet goed. '))
          + (juist.length > 1 ? 'De juiste antwoorden staan hierboven groen.' : 'Het juiste antwoord staat hierboven groen.');
      } else {
        uitleg = blok.feedbackWrong;
        tekst = blok.multi ? 'Niet helemaal. Wat groen is, heb je goed gekozen.' : 'Niet goed.';
      }
      u.textContent = tekst + (uitleg ? ' ' + uitleg : '');
      uitslagVak.appendChild(u);

      knoppen.forEach(function (b, i) {
        var o = blok.options[i];
        if (!o.feedback) return;
        if (keuze.indexOf(i) < 0 && !(o.correct && open && !goed)) return;
        b.children[1].appendChild(el('span', 'optie-uitleg', o.feedback));
      });

      nakijkKnop.style.display = 'none';
      opnieuwKnop.style.display = open ? 'none' : '';
      toonKnop.style.display = open ? 'none' : '';
      return goed;
    }

    nakijkKnop.addEventListener('click', function () {
      nagekeken = true;
      var goed = toonUitslag(gekozen);
      ms.antwoorden[id] = { keuze: gekozen.slice(), goed: goed };
      bewaar();
      opWijziging();
    });

    toonKnop.addEventListener('click', function () {
      if (ms.antwoorden[id]) ms.antwoorden[id].getoond = true;
      bewaar();
      toonUitslag(gekozen, true);
    });

    opnieuwKnop.addEventListener('click', function () {
      nagekeken = false;
      gekozen = [];
      delete ms.antwoorden[id];
      bewaar();
      knoppen.forEach(function (b) {
        b.disabled = false;
        b.classList.remove('goed', 'fout');
        b.setAttribute('aria-pressed', 'false');
        var weg = b.querySelector('.optie-uitleg');
        if (weg) weg.remove();
      });
      uitslagVak.innerHTML = '';
      nakijkKnop.style.display = '';
      nakijkKnop.disabled = true;
      opnieuwKnop.style.display = 'none';
      toonKnop.style.display = 'none';
      opWijziging();
    });

    if (bewaard && bewaard.keuze.every(function (i) { return i < blok.options.length; })) toonUitslag(bewaard.keuze, bewaard.getoond);
    else if (bewaard) { delete ms.antwoorden[id]; nagekeken = false; gekozen = []; }

    kaart.dataset.vraag = id;
    return kaart;
  }

  /* -------------------------------------------- keuzerijen */

  /* Gedeelde opbouw voor de koppelvraag en de sorteeropdracht: per rij een
     onderdeel met knoppen om uit te kiezen, geen uitklaplijst. */
  function tekenKeuzeVraag(cfg, moduleId, segIndex, blokIndex, opWijziging) {
    var id = vraagId(moduleId, segIndex, blokIndex);
    var ms = moduleStaat(moduleId);
    var bewaard = ms.antwoorden[id];

    var kaart = el('div', 'vraag');
    kaart.appendChild(el('div', 'label', cfg.label));
    kaart.appendChild(cfg.stelling);
    if (cfg.voorRijen) kaart.appendChild(cfg.voorRijen);

    var keuze = cfg.rijen.map(function () { return ''; });
    var nagekeken = false;

    var houder = el('div', 'keuzerijen' + (cfg.letters ? ' met-letters' : ''));
    var rijen = cfg.rijen.map(function (r) {
      var rij = el('div', 'keuzerij');
      var kop = el('div', 'keuzerij-tekst', r.tekst);
      kop.id = 'k-' + id.replace(/[^a-zA-Z0-9]/g, '-') + '-' + r.sleutel;
      rij.appendChild(kop);
      var groep = el('div', 'keuzeknoppen');
      groep.setAttribute('role', 'group');
      groep.setAttribute('aria-labelledby', kop.id);
      var knoppen = cfg.opties.map(function (o) {
        var k = el('button', 'keuzeknop', o.knop);
        k.type = 'button';
        k.setAttribute('aria-pressed', 'false');
        if (o.tekst && o.tekst !== o.knop) k.setAttribute('aria-label', o.knop + ': ' + o.tekst);
        k.addEventListener('click', function () { kies(r.sleutel, o.waarde); });
        groep.appendChild(k);
        return k;
      });
      rij.appendChild(groep);
      var gekozen = el('div', 'keuzerij-gekozen');
      rij.appendChild(gekozen);
      houder.appendChild(rij);
      return { r: r, rij: rij, knoppen: knoppen, gekozen: gekozen };
    });
    kaart.appendChild(houder);

    var acties = el('div', 'vraag-acties');
    var nakijkKnop = el('button', 'knop-klein', 'Nakijken');
    nakijkKnop.type = 'button';
    nakijkKnop.disabled = true;
    var opnieuwKnop = el('button', 'knop-klein stil', 'Opnieuw proberen');
    opnieuwKnop.type = 'button';
    opnieuwKnop.style.display = 'none';
    var toonKnop = el('button', 'knop-klein stil', 'Laat het antwoord zien');
    toonKnop.type = 'button';
    toonKnop.style.display = 'none';
    acties.appendChild(nakijkKnop);
    acties.appendChild(opnieuwKnop);
    acties.appendChild(toonKnop);
    kaart.appendChild(acties);

    var uitslagVak = el('div');
    kaart.appendChild(uitslagVak);

    function optieBij(waarde) {
      return cfg.opties.find(function (o) { return o.waarde === String(waarde); });
    }

    function werkBij() {
      rijen.forEach(function (x) {
        var w = keuze[x.r.sleutel];
        x.knoppen.forEach(function (k, j) {
          k.setAttribute('aria-pressed', cfg.opties[j].waarde === w ? 'true' : 'false');
        });
        var o = w !== '' ? optieBij(w) : null;
        x.gekozen.textContent = (cfg.toonKeuze && o) ? o.tekst : '';
      });
      nakijkKnop.disabled = keuze.some(function (w) { return w === ''; });
    }

    function kies(sleutelRij, waarde) {
      if (nagekeken) return;
      if (cfg.uniek) {
        keuze.forEach(function (w, n) { if (w === waarde && n !== sleutelRij) keuze[n] = ''; });
      }
      keuze[sleutelRij] = keuze[sleutelRij] === waarde ? '' : waarde;
      werkBij();
    }

    function toonUitslag(antwoord, getoond) {
      nagekeken = true;
      keuze = antwoord.map(String);
      werkBij();
      var goedAantal = 0;
      rijen.forEach(function (x) { if (keuze[x.r.sleutel] === String(x.r.juist)) goedAantal++; });
      var alles = goedAantal === rijen.length;
      var open = alles || inToets || !!getoond;
      rijen.forEach(function (x) {
        x.knoppen.forEach(function (k) { k.disabled = true; });
        x.rij.classList.remove('goed', 'fout');
        var weg = x.rij.querySelector('.keuzerij-correctie');
        if (weg) weg.remove();
        if (keuze[x.r.sleutel] === String(x.r.juist)) {
          x.rij.classList.add('goed');
        } else {
          x.rij.classList.add('fout');
          if (open) x.rij.appendChild(el('div', 'keuzerij-correctie', cfg.correctie(x.r)));
        }
      });
      var stand = goedAantal + ' van de ' + rijen.length + ' goed.';
      var uitleg, tekst;
      if (alles) {
        uitleg = cfg.feedback;
        tekst = cfg.allesGoed;
      } else if (open) {
        uitleg = getoond ? (cfg.feedback || cfg.feedbackWrong) : (cfg.feedbackWrong || cfg.feedback);
        tekst = (getoond ? '' : stand + ' ') + cfg.deelsGoed;
      } else {
        uitleg = cfg.feedbackWrong;
        tekst = stand;
      }
      uitslagVak.innerHTML = '';
      var u = el('div', 'uitslag ' + (alles ? 'goed' : 'fout'));
      u.textContent = tekst + (uitleg ? ' ' + uitleg : '');
      uitslagVak.appendChild(u);
      nakijkKnop.style.display = 'none';
      opnieuwKnop.style.display = open ? 'none' : '';
      toonKnop.style.display = open ? 'none' : '';
      return alles;
    }

    nakijkKnop.addEventListener('click', function () {
      var antwoord = keuze.slice();
      var goed = toonUitslag(antwoord);
      ms.antwoorden[id] = { keuze: antwoord, goed: goed };
      bewaar();
      opWijziging();
    });

    toonKnop.addEventListener('click', function () {
      if (ms.antwoorden[id]) ms.antwoorden[id].getoond = true;
      bewaar();
      toonUitslag(keuze, true);
    });

    /* Wat al goed stond blijft staan; alleen de foute rijen gaan leeg. */
    opnieuwKnop.addEventListener('click', function () {
      delete ms.antwoorden[id];
      bewaar();
      nagekeken = false;
      rijen.forEach(function (x) {
        if (keuze[x.r.sleutel] !== String(x.r.juist)) keuze[x.r.sleutel] = '';
        x.knoppen.forEach(function (k) { k.disabled = false; });
        x.rij.classList.remove('goed', 'fout');
        var weg = x.rij.querySelector('.keuzerij-correctie');
        if (weg) weg.remove();
      });
      werkBij();
      uitslagVak.innerHTML = '';
      nakijkKnop.style.display = '';
      opnieuwKnop.style.display = 'none';
      toonKnop.style.display = 'none';
      opWijziging();
    });

    /* Een bewaard antwoord telt alleen als het nog bij deze vraag past; na
       een wijziging in de bouwer begint de vraag opnieuw. */
    if (bewaard && bewaard.keuze.length === cfg.rijen.length) toonUitslag(bewaard.keuze, bewaard.getoond);
    else if (bewaard) delete ms.antwoorden[id];

    kaart.dataset.vraag = id;
    return kaart;
  }

  /* -------------------------------------------- koppelvraag */

  function tekenKoppel(blok, moduleId, segIndex, blokIndex, opWijziging) {
    var id = vraagId(moduleId, segIndex, blokIndex);
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var opties = husselVolgorde(id, blok.pairs.length).map(function (bij, n) {
      return { knop: letters[n], waarde: String(bij), tekst: blok.pairs[bij].right };
    });

    var lijst = el('ol', 'omschrijvingen');
    opties.forEach(function (o) {
      var li = el('li');
      li.appendChild(el('span', 'letter', o.knop));
      li.appendChild(el('span', null, o.tekst));
      lijst.appendChild(li);
    });

    return tekenKeuzeVraag({
      label: 'Koppelvraag',
      stelling: html('div', 'stelling', blok.question),
      voorRijen: lijst,
      letters: true,
      uniek: true,
      toonKeuze: true,
      rijen: blok.pairs.map(function (p, i) { return { tekst: p.left, sleutel: i, juist: i }; }),
      opties: opties,
      correctie: function (r) {
        var o = opties.find(function (x) { return x.waarde === String(r.juist); });
        return 'Juist is ' + o.knop + ': ' + o.tekst;
      },
      allesGoed: 'Allemaal goed gekoppeld.',
      deelsGoed: 'Bij de rode staat de juiste omschrijving.',
      feedback: blok.feedback,
      feedbackWrong: blok.feedbackWrong
    }, moduleId, segIndex, blokIndex, opWijziging);
  }

  /* -------------------------------------------- sorteeropdracht */

  function tekenSorteer(blok, moduleId, segIndex, blokIndex, opWijziging) {
    var id = vraagId(moduleId, segIndex, blokIndex);
    var stelling = el('div', 'stelling');
    stelling.appendChild(el('p', null, blok.question || 'Bij welke categorie hoort elk onderdeel?'));
    return tekenKeuzeVraag({
      label: 'Sorteeropdracht',
      stelling: stelling,
      rijen: husselVolgorde(id, blok.items.length).map(function (n) {
        return { tekst: blok.items[n].text, sleutel: n, juist: blok.items[n].pile };
      }),
      opties: blok.piles.map(function (p, j) { return { knop: p, waarde: String(j), tekst: p }; }),
      correctie: function (r) { return 'Hoort bij: ' + blok.piles[r.juist]; },
      allesGoed: 'Alles in de juiste categorie.',
      deelsGoed: 'Bij de rode staat waar ze wel horen.',
      feedback: blok.feedback,
      feedbackWrong: blok.feedbackWrong
    }, moduleId, segIndex, blokIndex, opWijziging);
  }

  /* ------------------------------------------------------------ modulepagina */

  function openModule(moduleId) {
    var les = cursus.lessons.find(function (l) { return l.id === moduleId; });
    if (!les) return toonStart();
    huidig = moduleId;
    /* Ook openen telt als voortgang: een LMS hoort dan "bezig" en de plek. */
    bewaar();

    if (opts.hash) {
      if (location.hash !== '#' + moduleId) zetAdres('#' + moduleId);
      document.title = (les.title || 'Module') + ' | ' + cursus.title;
    }
    root.innerHTML = '';

    var toets = les.toets || null;
    inToets = !!toets;
    var segmenten = segmentenVan(les);
    var ms = moduleStaat(moduleId);
    if (!segmenten.length) segmenten = [[]];
    if (ms.af && !toets) ms.segment = segmenten.length - 1;
    var werkUitslagBij = null;
    if (ms.segment >= segmenten.length) ms.segment = segmenten.length - 1;
    var tot = opts.allesTonen ? segmenten.length - 1 : ms.segment;

    var balk = el('header', 'leesbalk');
    var binnen = el('div', 'leesbalk-inner');
    var terug = el('button', 'terug', '← Alle modules');
    terug.type = 'button';
    terug.addEventListener('click', toonStart);
    binnen.appendChild(terug);
    binnen.appendChild(el('span', 'naam', les.title));
    var teller = el('span', 'teller');
    binnen.appendChild(teller);
    balk.appendChild(binnen);
    var spoor = el('div', 'spoor');
    var vulling = el('i');
    spoor.appendChild(vulling);
    balk.appendChild(spoor);
    root.appendChild(balk);

    var lezer = el('main', 'lezer');
    var kop = el('div', 'moduletitel');
    var nr = cursus.lessons.indexOf(les) + 1;
    kop.appendChild(el('p', 'kicker', (toets ? 'Toets · ' : '') + 'Module ' + nr + ' van ' + cursus.lessons.length));
    kop.appendChild(el('h1', null, les.title || 'Module ' + nr));
    if (toets) {
      var grens = slaaggrens(les);
      var aantal = toetsScore().totaal;
      kop.appendChild(el('p', 'toets-regel', aantal + (aantal === 1 ? ' vraag' : ' vragen') + ', elk één poging.'
        + (grens ? ' Je hebt ' + grens + '% goed nodig om de toets te halen.' : '')
        + (ms.score !== undefined ? ' Je beste score tot nu toe: ' + ms.score + '%.' : '')));
    }
    if (les.deadline) {
      var dl = el('p', 'deadline-regel');
      dl.appendChild(el('span', 'deadline', 'Afronden vóór ' + les.deadline));
      kop.appendChild(dl);
    }
    lezer.appendChild(kop);
    root.appendChild(lezer);

    function werkBalkBij() {
      var zichtbaar = Math.min(Math.max(ms.segment, tot) + 1, segmenten.length);
      teller.textContent = zichtbaar + ' / ' + segmenten.length;
      vulling.style.width = Math.round((zichtbaar / segmenten.length) * 100) + '%';
    }

    function openVragen(segIndex) {
      var open = 0;
      segmenten[segIndex].forEach(function (x, i) {
        if (VRAAGTYPEN.indexOf(x.blok.t) < 0 || !telbaar(x.blok)) return;
        if (!ms.antwoorden[vraagId(moduleId, segIndex, i)]) open++;
      });
      return open;
    }

    function toetsScore() {
      var goed = 0, totaal = 0;
      segmenten.forEach(function (seg, s) {
        seg.forEach(function (x, i) {
          if (SCOREBAAR.indexOf(x.blok.t) < 0 || !telbaar(x.blok)) return;
          totaal++;
          var a = ms.antwoorden[vraagId(moduleId, s, i)];
          if (a && a.goed) goed++;
        });
      });
      return { goed: goed, totaal: totaal, pct: totaal ? Math.round((goed / totaal) * 100) : 0 };
    }

    /* De uitslag verschijnt zodra alle vragen zijn beantwoord. */
    function toonToetsUitslag(vak) {
      var open = 0;
      for (var s = 0; s < segmenten.length; s++) open += openVragen(s);
      vak.innerHTML = '';
      vak.hidden = open > 0;
      if (open > 0) return;
      var r = toetsScore();
      var grens = slaaggrens(les);
      var gehaald = r.pct >= grens;
      if (!opts.allesTonen) {
        ms.score = Math.max(ms.score || 0, r.pct);
        if (gehaald) ms.af = true;
        bewaar();
      }
      vak.classList.toggle('gehaald', gehaald);
      vak.appendChild(el('div', 'vinkje', gehaald ? '✓' : '!'));
      vak.appendChild(el('h2', null, gehaald ? 'Toets gehaald' : 'Nog niet gehaald'));
      vak.appendChild(el('p', 'toets-score', r.pct + '%'));
      vak.appendChild(el('p', null, r.goed + ' van de ' + r.totaal + ' vragen goed.'
        + (grens ? ' Om de toets te halen heb je ' + grens + '% nodig.' : '')));
      var knoppen = el('div', 'knoppen');
      var volgende = cursus.lessons[cursus.lessons.indexOf(les) + 1];
      if (gehaald && volgende) {
        var v = el('button', 'knop-klein', 'Volgende module');
        v.type = 'button';
        v.addEventListener('click', function () { openModule(volgende.id); });
        knoppen.appendChild(v);
      }
      var opnieuw = el('button', gehaald ? 'knop-klein stil' : 'knop-klein', 'Toets opnieuw maken');
      opnieuw.type = 'button';
      opnieuw.addEventListener('click', function () {
        ms.antwoorden = {};
        ms.segment = 0;
        ms.poging = (ms.poging || 0) + 1;
        bewaar();
        openModule(moduleId);
      });
      knoppen.appendChild(opnieuw);
      var o = el('button', 'knop-klein stil', 'Terug naar het overzicht');
      o.type = 'button';
      o.addEventListener('click', toonStart);
      knoppen.appendChild(o);
      vak.appendChild(knoppen);
    }

    function tekenSegment(index) {
      var seg = el('section', 'segment');
      var herbeoordeel = function () { /* wordt hieronder vervangen */ };

      segmenten[index].forEach(function (x, i) {
        var node = tekenBlok(x.blok, moduleId, index, i, function () {
          herbeoordeel();
          if (werkUitslagBij) werkUitslagBij();
        });
        if (node) {
          node.setAttribute('data-blok', x.gi);
          seg.appendChild(node);
        }
      });
      if (!segmenten[index].length) seg.appendChild(el('p', 'leeg', 'Deze module heeft nog geen inhoud.'));

      lezer.appendChild(seg);

      var laatste = index === segmenten.length - 1;
      var isVoorste = index >= tot;

      if (!laatste && isVoorste) {
        var voet = el('div', 'doorgaan');
        var knop = el('button', null, toets ? 'Volgende vraag' : 'Doorgaan');
        knop.type = 'button';
        var hint = el('div', 'hint', '');
        voet.appendChild(knop);
        voet.appendChild(hint);
        seg.appendChild(voet);

        herbeoordeel = function () {
          var open = openVragen(index);
          knop.disabled = open > 0;
          hint.textContent = open > 0
            ? (open === 1 ? 'Beantwoord eerst de vraag hierboven.' : 'Beantwoord eerst de ' + open + ' vragen hierboven.')
            : '';
        };
        herbeoordeel();

        knop.addEventListener('click', function () {
          voet.remove();
          ms.segment = Math.max(ms.segment, index + 1);
          tot = Math.max(tot, index + 1);
          bewaar();
          werkBalkBij();
          var nieuw = tekenSegment(index + 1);
          nieuw.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      } else if (laatste && toets) {
        var uitslag = el('div', 'afronding toets-uitslag');
        seg.appendChild(uitslag);
        werkUitslagBij = function () { toonToetsUitslag(uitslag); };
        werkUitslagBij();
      } else if (laatste) {
        var slot = el('div', 'afronding');
        slot.appendChild(el('div', 'vinkje', '✓'));
        slot.appendChild(el('h2', null, 'Module doorlopen'));
        var volgende = cursus.lessons[cursus.lessons.indexOf(les) + 1];
        slot.appendChild(el('p', null, volgende
          ? 'Je hebt ' + les.title + ' afgerond. Ga verder met module ' + (nr + 1) + '.'
          : 'Je hebt de laatste module van deze cursus afgerond.'));
        var knoppen = el('div', 'knoppen');
        if (volgende) {
          var v = el('button', 'knop-klein', 'Volgende module');
          v.type = 'button';
          v.addEventListener('click', function () { openModule(volgende.id); });
          knoppen.appendChild(v);
        }
        var o = el('button', 'knop-klein stil', 'Terug naar het overzicht');
        o.type = 'button';
        o.addEventListener('click', toonStart);
        knoppen.appendChild(o);
        slot.appendChild(knoppen);
        var nogOpen = el('div', 'doorgaan');
        var nogHint = el('div', 'hint', '');
        nogOpen.appendChild(nogHint);
        seg.appendChild(nogOpen);
        seg.appendChild(slot);

        herbeoordeel = function () {
          var open = opts.allesTonen ? 0 : openVragen(index);
          slot.hidden = open > 0;
          nogOpen.hidden = !open;
          nogHint.textContent = open === 1 ? 'Beantwoord de vraag hierboven om de module af te ronden.' : 'Beantwoord de ' + open + ' vragen hierboven om de module af te ronden.';
          if (openVragen(index) === 0 && !ms.af && !opts.allesTonen) {
            ms.af = true;
            bewaar();
          }
        };
        herbeoordeel();
      }
      return seg;
    }

    for (var i = 0; i <= tot && i < segmenten.length; i++) tekenSegment(i);
    werkBalkBij();
    naarBoven();
    if (opts.opModule) opts.opModule(moduleId);
  }

  /* ------------------------------------------------------------ opstarten */

  var start = opts.module || (opts.hash ? (location.hash || '').replace('#', '') : '');
  if (start && cursus.lessons.some(function (l) { return l.id === start; })) openModule(start);
  else toonStart();

  if (opts.hash) {
    window.addEventListener('hashchange', function () {
      var h = (location.hash || '').replace('#', '');
      if (h && h !== huidig && cursus.lessons.some(function (l) { return l.id === h; })) openModule(h);
    });
  }

  return {
    module: function () { return huidig; },
    openModule: openModule,
    toonStart: toonStart,
    wisVoortgang: function () { staat = { modules: {} }; bewaar(); },
    naarBlok: function (gi) {
      var n = root.querySelector('[data-blok="' + gi + '"]');
      if (n) n.scrollIntoView({ block: 'start' });
      return !!n;
    }
  };
}
