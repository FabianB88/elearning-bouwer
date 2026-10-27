(function () {
  'use strict';

  /* ================================================================ hulp */

  var $ = function (s, r) { return (r || document).querySelector(s); };

  function h(tag, props) {
    var e = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (k === 'value') e.value = v;
      else if (k === 'checked') e.checked = !!v;
      else e.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) voegToe(e, arguments[i]);
    return e;
  }
  function voegToe(e, k) {
    if (k === null || k === undefined || k === false) return;
    if (Array.isArray(k)) { k.forEach(function (x) { voegToe(e, x); }); return; }
    e.append(k.nodeType ? k : String(k));
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Platte tekst uit een tekstvak naar alinea's, en terug. */
  function naarHtml(tekst) {
    tekst = String(tekst || '').trim();
    if (!tekst) return '';
    return tekst.split(/\n{2,}/).map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('');
  }
  function naarTekst(html) {
    if (!html) return '';
    var t = document.createElement('template');
    t.innerHTML = String(html).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|h\d|div|blockquote)>/gi, '\n\n');
    return t.content.textContent.replace(/\n{3,}/g, '\n\n').trim();
  }

  /* Alleen eenvoudige opmaak blijft over; scripts, stijlen en attributen gaan
     eruit. Alles wat de bouwer opslaat of exporteert gaat hier doorheen. */
  var TOEGESTAAN = { P: 1, BR: 1, STRONG: 1, EM: 1, U: 1, UL: 1, OL: 1, LI: 1, A: 1, H3: 1, H4: 1, BLOCKQUOTE: 1, SUB: 1, SUP: 1 };
  var OMZETTEN = { B: 'STRONG', I: 'EM', H1: 'H3', H2: 'H3', H5: 'H4', H6: 'H4', DIV: 'P' };
  var WEG = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, SVG: 1, MATH: 1, TEMPLATE: 1, NOSCRIPT: 1, FORM: 1, INPUT: 1, BUTTON: 1, SELECT: 1, TEXTAREA: 1, IMG: 1, VIDEO: 1, AUDIO: 1, LINK: 1, META: 1, HEAD: 1, TITLE: 1 };
  function schoonHtml(html) {
    var t = document.createElement('template');
    t.innerHTML = String(html || '');
    (function loop(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (kind) {
        if (kind.nodeType === 8) { kind.remove(); return; }
        if (kind.nodeType !== 1) return;
        var tag = kind.tagName;
        if (WEG[tag]) { kind.remove(); return; }
        loop(kind);
        if (OMZETTEN[tag]) {
          var n = document.createElement(OMZETTEN[tag]);
          while (kind.firstChild) n.appendChild(kind.firstChild);
          kind.replaceWith(n);
          kind = n;
          tag = n.tagName;
        }
        if (!TOEGESTAAN[tag]) { kind.replaceWith.apply(kind, Array.prototype.slice.call(kind.childNodes)); return; }
        var href = tag === 'A' ? (kind.getAttribute('href') || '').trim() : '';
        Array.prototype.slice.call(kind.attributes).forEach(function (a) { kind.removeAttribute(a.name); });
        if (tag === 'A') {
          if (/^(https?:|mailto:)/i.test(href)) {
            kind.setAttribute('href', href);
            kind.setAttribute('target', '_blank');
            kind.setAttribute('rel', 'noopener');
          } else {
            kind.replaceWith.apply(kind, Array.prototype.slice.call(kind.childNodes));
          }
        }
      });
    })(t.content);
    return t.innerHTML.replace(/<p>(\s|&nbsp;|<br>)*<\/p>/g, '').trim();
  }
  function alsAlinea(html) {
    html = schoonHtml(html);
    if (html && !/^\s*<(p|ul|ol|h3|h4|blockquote)\b/i.test(html)) html = '<p>' + html + '</p>';
    return html;
  }
  function schoonSvg(s) {
    return String(s || '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/(href\s*=\s*["']?)\s*javascript:[^"'\s>]*/gi, '$1#');
  }

  function nieuwId(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function slug(t) {
    return (String(t || 'e-learning').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)) || 'e-learning';
  }
  function kloon(x) { return JSON.parse(JSON.stringify(x)); }
  function zonderSleutels(x) { return JSON.parse(JSON.stringify(x, function (k, v) { return k.charAt(0) === '_' ? undefined : v; })); }
  function ls(k, v) {
    try {
      if (arguments.length === 1) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { if (arguments.length > 1 && v !== null) throw e; return null; }
  }
  function host(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }

  var capPromises = {};
  function cap(naam) {
    if (!capPromises[naam]) {
      capPromises[naam] = (window.claude && window.claude.use)
        ? Promise.resolve(window.claude.use(naam)).catch(function () { return null; })
        : Promise.resolve(null);
    }
    return capPromises[naam];
  }

  var meldTimer;
  function melding(tekst, actie) {
    var oud = $('.melding');
    if (oud) oud.remove();
    clearTimeout(meldTimer);
    var m = h('div', { class: 'melding', role: 'status' }, tekst);
    if (actie) m.append(' ', h('button', { type: 'button', class: 'knop klein', style: 'margin-left:8px', onclick: function () { m.remove(); actie.doe(); } }, actie.tekst));
    document.body.append(m);
    meldTimer = setTimeout(function () { m.remove(); }, actie ? 8000 : 4500);
  }

  /* ================================================================ iconen */

  var I = {
    text: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    quote: '<path d="M7 7h4v4H8a3 3 0 0 0 3 3v2a5 5 0 0 1-5-5V8a1 1 0 0 1 1-1Zm8 0h4v4h-3a3 3 0 0 0 3 3v2a5 5 0 0 1-5-5V8a1 1 0 0 1 1-1Z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3Z"/>',
    embed: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 6l-3 12"/>',
    links: '<path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1"/><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1"/>',
    tabs: '<path d="M3 8h6V5h6v3h6v11H3Z"/>',
    accordion: '<rect x="3" y="4" width="18" height="5" rx="1"/><rect x="3" y="11" width="18" height="9" rx="1"/>',
    cards: '<rect x="3" y="6" width="12" height="14" rx="2"/><path d="M8 6V5a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-5"/>',
    timeline: '<path d="M6 3v18"/><circle cx="6" cy="7" r="2"/><circle cx="6" cy="17" r="2"/><path d="M11 7h9M11 17h7"/>',
    steps: '<path d="M4 18h5v-5h5V8h6"/>',
    quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>',
    match: '<circle cx="5" cy="7" r="2"/><circle cx="5" cy="17" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="19" cy="17" r="2"/><path d="M7 7l10 10M7 17 17 7"/>',
    sort: '<rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/><path d="M5.5 8h2M5.5 12h2M16.5 8h2"/>',
    continue: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    svg: '<path d="M4 20 10 4l4 10 2-4 4 10"/>',
    omhoog: '<path d="m6 15 6-6 6 6"/>',
    omlaag: '<path d="m6 9 6 6 6-6"/>',
    kopie: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    weg: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    kruis: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    paneelL: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    paneelR: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
    schijf: '<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M7 3v5h8V3M7 21v-7h10v7"/>',
    ster: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    let: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>'
  };
  function ico(naam) {
    var t = document.createElement('template');
    t.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (I[naam] || '') + '</svg>';
    return t.content.firstChild;
  }
  function icoonknop(naam, label, opklik, uit) {
    return h('button', { type: 'button', class: 'icoonknop', 'aria-label': label, title: label, disabled: uit, onclick: opklik }, ico(naam));
  }

  /* ================================================================ links herkennen */

  function herkenVideo(url) {
    url = String(url || '').trim();
    var m = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (m) {
      var s = url.match(/[?&](?:t|start)=(\d+)/);
      return { youtube: m[1], start: s ? Number(s[1]) : undefined };
    }
    m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (m) return { vimeo: m[1] };
    if (/^https?:\/\//i.test(url)) return { url: url };
    return null;
  }

  /* Deellinks van bekende diensten omzetten naar hun insluit-adres. */
  function naarInsluitUrl(url) {
    url = String(url || '').trim();
    if (!/^https?:\/\//i.test(url)) return { url: '', tekst: 'Plak een volledig webadres dat begint met https://' };
    var m;
    var v = herkenVideo(url);
    if (v && v.youtube) return { url: 'https://www.youtube-nocookie.com/embed/' + v.youtube + (v.start ? '?start=' + v.start : ''), tekst: 'YouTube-video. Tip: het videoblok werkt hiervoor ook.' };
    if (v && v.vimeo) return { url: 'https://player.vimeo.com/video/' + v.vimeo + '?dnt=1', tekst: 'Vimeo-video. Tip: het videoblok werkt hiervoor ook.' };
    if ((m = url.match(/docs\.google\.com\/presentation\/d\/([\w-]+)/))) return { url: 'https://docs.google.com/presentation/d/' + m[1] + '/embed?start=false&loop=false', tekst: 'Google Presentaties. Zet delen op "iedereen met de link".' };
    if ((m = url.match(/docs\.google\.com\/forms\/d\/e\/([\w-]+)/))) return { url: 'https://docs.google.com/forms/d/e/' + m[1] + '/viewform?embedded=true', tekst: 'Google Formulier.' };
    if ((m = url.match(/docs\.google\.com\/(document|spreadsheets)\/d\/([\w-]+)/))) return { url: 'https://docs.google.com/' + m[1] + '/d/' + m[2] + '/preview', tekst: 'Google ' + (m[1] === 'document' ? 'Document' : 'Spreadsheet') + '. Zet delen op "iedereen met de link".' };
    if ((m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/))) return { url: 'https://drive.google.com/file/d/' + m[1] + '/preview', tekst: 'Bestand op Google Drive.' };
    if ((m = url.match(/canva\.com\/design\/([\w-]+)\/([\w-]+)/))) return { url: 'https://www.canva.com/design/' + m[1] + '/' + m[2] + '/view?embed', tekst: 'Canva-ontwerp. Zet "Openbaar weergavelink" aan in Canva.' };
    if ((m = url.match(/open\.spotify\.com\/(track|album|playlist|episode|show)\/(\w+)/))) return { url: 'https://open.spotify.com/embed/' + m[1] + '/' + m[2], tekst: 'Spotify.' };
    if (/padlet\.com/.test(url)) return { url: url, tekst: 'Padlet. Werkt het niet, gebruik dan de insluitcode-link uit Padlet (Delen > Insluiten).' };
    if (/menti(meter)?\.com/.test(url)) return { url: url, tekst: 'Mentimeter. Gebruik de link uit Delen > Insluiten.' };
    if (/genial\.ly|view\.genially\.com/.test(url)) return { url: url, tekst: 'Genially.' };
    if (/h5p\./.test(url)) return { url: url, tekst: 'H5P-oefening.' };
    return { url: url, tekst: 'Wordt ingesloten als webpagina. Weigert een site dat, dan staat er een link onder.' };
  }

  /* ================================================================ normaliseren */

  function tekstVan(x) { return String(x == null ? '' : x); }
  function lijstVan(x) { return Array.isArray(x) ? x : []; }

  function normaliseerBlok(b) {
    if (!b || typeof b !== 'object') return null;
    var t = b.t;
    var uit;
    switch (t) {
      case 'text': uit = { t: t, heading: tekstVan(b.heading), body: alsAlinea(b.body) }; break;
      case 'list': uit = { t: t, ordered: !!b.ordered, items: lijstVan(b.items).map(function (i) { return schoonHtml(i); }) }; break;
      case 'quote': uit = { t: t, body: schoonHtml(b.body) }; break;
      case 'image': uit = { t: t, src: tekstVan(b.src), w: b.w || undefined, h: b.h || undefined, caption: tekstVan(b.caption), alt: tekstVan(b.alt) }; break;
      case 'video':
        uit = { t: t, title: tekstVan(b.title), bron: tekstVan(b.bron) };
        if (b.youtube) { uit.youtube = String(b.youtube); if (b.start) uit.start = Number(b.start) || undefined; }
        else if (b.vimeo) uit.vimeo = String(b.vimeo);
        else if (b.url) uit.url = String(b.url);
        if (!uit.bron) uit.bron = uit.youtube ? 'https://www.youtube.com/watch?v=' + uit.youtube : uit.vimeo ? 'https://vimeo.com/' + uit.vimeo : (uit.url || '');
        break;
      case 'embed': uit = { t: t, url: tekstVan(b.url), bron: tekstVan(b.bron || b.url), title: tekstVan(b.title), height: Number(b.height) || 480 }; break;
      case 'tabs': case 'accordion':
        uit = { t: t, items: lijstVan(b.items).map(function (i) { return { title: tekstVan(i && i.title), body: alsAlinea(i && i.body) }; }) }; break;
      case 'cards': uit = { t: t, items: lijstVan(b.items).map(function (i) { return { front: alsAlinea(i && i.front), back: alsAlinea(i && i.back) }; }) }; break;
      case 'links': uit = { t: t, items: lijstVan(b.items).map(function (i) { return { label: tekstVan(i && i.label), href: tekstVan(i && i.href) }; }) }; break;
      case 'timeline': uit = { t: t, items: lijstVan(b.items).map(function (i) { return { date: tekstVan(i && i.date), title: tekstVan(i && i.title), body: alsAlinea(i && i.body) }; }) }; break;
      case 'steps':
        uit = {
          t: t,
          intro: { title: tekstVan(b.intro && b.intro.title), body: tekstVan(b.intro && b.intro.body) },
          steps: lijstVan(b.steps).map(function (s) { return { title: tekstVan(s && s.title), body: tekstVan(s && s.body) }; }),
          summary: { title: tekstVan(b.summary && b.summary.title), body: tekstVan(b.summary && b.summary.body) }
        }; break;
      case 'quiz':
        uit = {
          t: t, multi: !!b.multi, question: alsAlinea(b.question),
          options: lijstVan(b.options).map(function (o) {
            var x = { text: tekstVan(o && o.text), correct: !!(o && o.correct) };
            if (o && o.feedback) x.feedback = tekstVan(o.feedback);
            return x;
          }),
          feedback: tekstVan(b.feedback), feedbackWrong: tekstVan(b.feedbackWrong)
        }; break;
      case 'match':
        uit = { t: t, question: alsAlinea(b.question), pairs: lijstVan(b.pairs).map(function (p) { return { left: tekstVan(p && p.left), right: tekstVan(p && p.right) }; }), feedback: tekstVan(b.feedback), feedbackWrong: tekstVan(b.feedbackWrong) }; break;
      case 'sort':
        var stapels = lijstVan(b.piles).map(tekstVan);
        uit = {
          t: t, question: naarTekst(b.question), piles: stapels,
          items: lijstVan(b.items).map(function (i) { var p = Number(i && i.pile) || 0; return { text: tekstVan(i && i.text), pile: p < stapels.length ? p : 0 }; }),
          feedback: tekstVan(b.feedback), feedbackWrong: tekstVan(b.feedbackWrong)
        }; break;
      case 'continue': uit = { t: t }; break;
      case 'svg': uit = { t: t, svg: schoonSvg(b.svg), alt: tekstVan(b.alt), caption: tekstVan(b.caption) }; break;
      default: return null;
    }
    uit._k = nieuwId('b');
    return uit;
  }

  function normaliseerCursus(c, opts) {
    opts = opts || {};
    c = c && typeof c === 'object' ? c : {};
    var gezien = {};
    var lessen = lijstVan(c.lessons).map(function (l, i) {
      var id = /^[A-Za-z0-9_-]{1,40}$/.test(l && l.id) && !gezien[l.id] ? l.id : nieuwId('m');
      gezien[id] = 1;
      return {
        id: id,
        title: tekstVan(l && l.title) || 'Module ' + (i + 1),
        deadline: tekstVan(l && l.deadline),
        blocks: lijstVan(l && l.blocks).map(normaliseerBlok).filter(Boolean)
      };
    });
    return {
      id: opts.nieuwId || !/^[A-Za-z0-9_-]{1,60}$/.test(c.id) ? nieuwId('c') : c.id,
      title: tekstVan(c.title) || 'Naamloze e-learning',
      subtitle: tekstVan(c.subtitle),
      author: tekstVan(c.author),
      intro: tekstVan(c.intro),
      kicker: c.kicker === undefined ? 'E-learning' : tekstVan(c.kicker),
      voorbeeld: !!c.voorbeeld && !opts.nieuwId,
      updatedAt: Number(c.updatedAt) || Date.now(),
      lessons: lessen
    };
  }

  /* ================================================================ bloktypen */

  var vid = 0;
  function veldId() { return 'v' + (++vid); }

  var V = {
    tekst: function (label, obj, key, o) {
      o = o || {};
      var id = veldId();
      var inp = o.meer
        ? h('textarea', { id: id, rows: o.rijen || 3, placeholder: o.hint || '' })
        : h('input', { type: o.type || 'text', id: id, placeholder: o.hint || '' });
      inp.value = o.html ? naarTekst(obj[key]) : (obj[key] == null ? '' : obj[key]);
      inp.addEventListener('input', function () {
        obj[key] = o.html ? naarHtml(inp.value) : inp.value;
        if (o.opInvoer) o.opInvoer(inp.value, inp);
        gewijzigd();
      });
      return h('div', { class: 'veld' }, label ? h('label', { for: id, text: label }) : null, inp, o.uitleg ? h('div', { class: 'hulp', text: o.uitleg }) : null);
    },

    rijk: function (label, obj, key, o) {
      o = o || {};
      var id = veldId();
      var vak = h('div', { class: 'rijk', id: id, contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': label || 'Tekst', 'data-leeg': o.hint || 'Typ hier je tekst…' });
      vak.innerHTML = obj[key] || '';
      var bewaarUit = function () { obj[key] = alsAlinea(vak.innerHTML); gewijzigd(); };
      vak.addEventListener('input', bewaarUit);
      vak.addEventListener('paste', function (e) {
        e.preventDefault();
        var d = e.clipboardData;
        var stuk = d.getData('text/html') ? schoonHtml(d.getData('text/html')) : naarHtml(d.getData('text/plain'));
        document.execCommand('insertHTML', false, stuk);
      });
      var linkRegel = h('div', { class: 'linkregel', hidden: true });
      var bereik = null;
      var linkInvoer = h('input', { type: 'url', placeholder: 'https://…', 'aria-label': 'Webadres van de link' });
      linkRegel.append(linkInvoer,
        h('button', { type: 'button', class: 'knop klein', onclick: function () {
          var url = linkInvoer.value.trim();
          linkRegel.hidden = true;
          vak.focus();
          if (bereik) { var s = getSelection(); s.removeAllRanges(); s.addRange(bereik); }
          if (/^(https?:|mailto:)/i.test(url)) document.execCommand('createLink', false, url);
          bewaarUit();
        } }, 'Link maken'),
        h('button', { type: 'button', class: 'knop klein', onclick: function () { linkRegel.hidden = true; } }, 'Annuleren'));
      function opdracht(cmd, waarde) {
        return function (e) {
          e.preventDefault();
          vak.focus();
          if (cmd === 'kop') {
            var blok = document.queryCommandValue('formatBlock').toLowerCase();
            document.execCommand('formatBlock', false, blok === 'h3' ? 'p' : 'h3');
          } else if (cmd === 'link') {
            var s = getSelection();
            bereik = s.rangeCount ? s.getRangeAt(0).cloneRange() : null;
            linkRegel.hidden = false;
            linkInvoer.value = '';
            setTimeout(function () { linkInvoer.focus(); });
            return;
          } else {
            document.execCommand(cmd, false, waarde);
          }
          bewaarUit();
        };
      }
      var knop = function (tekst, cmd, titel, stijl) {
        var doe = opdracht(cmd);
        return h('button', { type: 'button', title: titel, 'aria-label': titel, style: stijl, onmousedown: doe, onclick: function (e) { if (e.detail === 0) doe(e); } }, tekst);
      };
      var balk = h('div', { class: 'rijk-balk', role: 'toolbar', 'aria-label': 'Opmaak' },
        knop('B', 'bold', 'Vet'),
        knop('I', 'italic', 'Cursief', 'font-style:italic'),
        knop('Kop', 'kop', 'Tussenkop'),
        knop('• Lijst', 'insertUnorderedList', 'Opsomming'),
        knop('1. Lijst', 'insertOrderedList', 'Genummerde lijst'),
        knop('Link', 'link', 'Link toevoegen'),
        knop('Wis', 'removeFormat', 'Opmaak wissen'));
      return h('div', { class: 'veld' }, label ? h('label', { for: id, text: label }) : null, h('div', { class: 'rijk-veld' }, balk, vak, linkRegel));
    },

    schakel: function (label, obj, key, opWijzig) {
      var id = veldId();
      var inp = h('input', { type: 'checkbox', id: id, checked: !!obj[key] });
      inp.addEventListener('change', function () { obj[key] = inp.checked; if (opWijzig) opWijzig(inp.checked); gewijzigd(); });
      return h('label', { class: 'schakel', for: id }, inp, label);
    },

    keuze: function (label, obj, key, opties) {
      var id = veldId();
      var sel = h('select', { id: id }, opties.map(function (o) { return h('option', { value: String(o[0]) }, o[1]); }));
      sel.value = String(obj[key]);
      sel.addEventListener('change', function () { obj[key] = isNaN(Number(sel.value)) ? sel.value : Number(sel.value); gewijzigd(); });
      return h('div', { class: 'veld' }, h('label', { for: id, text: label }), sel);
    },

    /* Een reeks onderdelen met omhoog, omlaag en verwijderen. `compact` zet
       elk onderdeel op één regel. */
    reeks: function (ctx, label, arr, o) {
      var lijst = h('div', { class: 'reeks' });
      arr.forEach(function (item, i) {
        var acties = [
          icoonknop('omhoog', 'Omhoog', function () { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); gewijzigd(); ctx.opnieuw(); }, i === 0),
          icoonknop('omlaag', 'Omlaag', function () { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); gewijzigd(); ctx.opnieuw(); }, i === arr.length - 1),
          icoonknop('kruis', 'Verwijderen', function () { if (o.opVerwijder) o.opVerwijder(i); arr.splice(i, 1); gewijzigd(); ctx.opnieuw(); }, arr.length <= (o.min || 0))
        ];
        if (o.compact) {
          lijst.append(h('div', { class: 'reeks-rij' + (o.drie ? ' drie' : '') }, o.teken(item, i), h('div', { style: 'display:flex' }, acties)));
        } else {
          lijst.append(h('div', { class: 'reeks-item' },
            h('div', { class: 'reeks-item-kop' }, h('span', { class: 'nr', text: (i + 1) + '.' }), h('span', { class: 'veldlabel', text: o.naam + ' ' + (i + 1) }), h('span', { class: 'ruimte' }), acties),
            o.teken(item, i)));
        }
      });
      var toe = h('button', { type: 'button', class: 'knop klein', onclick: function () { arr.push(o.nieuw()); gewijzigd(); ctx.opnieuw(); } }, ico('plus'), (o.toevoegen || o.naam + ' toevoegen'));
      return h('div', { class: 'veld' }, label ? h('span', { class: 'veldlabel', text: label }) : null, lijst, h('div', null, toe));
    }
  };

  function eerste(html, n) { var t = naarTekst(html).replace(/\s+/g, ' '); return t.length > n ? t.slice(0, n - 1) + '…' : t; }

  var TYPES = {
    text: {
      naam: 'Tekst', groep: 'Tekst', uitleg: 'Kop met lopende tekst',
      nieuw: function () { return { t: 'text', heading: '', body: '' }; },
      samenvatting: function (b) { return b.heading || eerste(b.body, 80) || 'Nog leeg'; },
      velden: function (b) { return [V.tekst('Kop (mag leeg)', b, 'heading'), V.rijk('Tekst', b, 'body')]; }
    },
    list: {
      naam: 'Opsomming', groep: 'Tekst', uitleg: 'Punten of leerdoelen',
      nieuw: function () { return { t: 'list', ordered: false, items: [''] }; },
      samenvatting: function (b) { return b.items.length + (b.items.length === 1 ? ' punt' : ' punten'); },
      velden: function (b, ctx) {
        return [V.schakel('Genummerd', b, 'ordered'), V.reeks(ctx, 'Punten', b.items, {
          compact: true, naam: 'Punt', toevoegen: 'Punt toevoegen', min: 1, nieuw: function () { return ''; },
          teken: function (item, i) {
            var inp = h('input', { type: 'text', 'aria-label': 'Punt ' + (i + 1), value: naarTekst(item) });
            inp.addEventListener('input', function () { b.items[i] = esc(inp.value); gewijzigd(); });
            return inp;
          }
        })];
      }
    },
    quote: {
      naam: 'Statement', groep: 'Tekst', uitleg: 'Eén zin die blijft hangen',
      nieuw: function () { return { t: 'quote', body: '' }; },
      samenvatting: function (b) { return eerste(b.body, 80) || 'Nog leeg'; },
      velden: function (b) { return [V.tekst('Statement', b, 'body', { meer: true, rijen: 2, html: true })]; }
    },
    image: {
      naam: 'Afbeelding', groep: 'Beeld en media', uitleg: 'Foto, schema of infographic',
      nieuw: function () { return { t: 'image', src: '', caption: '', alt: '' }; },
      samenvatting: function (b) { return b.caption || (b.src ? 'Afbeelding' : 'Nog geen afbeelding'); },
      waarschuwing: function (b) {
        if (!b.src) return 'Nog geen afbeelding gekozen';
        if (!/^data:image\//.test(b.src) && !/^https?:/.test(b.src)) return 'Afbeelding niet gevonden, kies hem opnieuw';
        if (!b.caption && !b.alt) return 'Geen bijschrift of alt-tekst';
        return '';
      },
      velden: function (b, ctx) {
        var duim = h('div', { class: 'duim' }, b.src ? '' : 'Geen afbeelding');
        if (/^data:image\//.test(b.src)) duim.style.backgroundImage = 'url("' + b.src + '")';
        var kies = h('input', { type: 'file', accept: 'image/*', hidden: true });
        var info = h('div', { class: 'hulp', text: b.w ? b.w + ' × ' + b.h + ' pixels' : 'JPG, PNG of WebP. Grote foto\'s worden verkleind.' });
        kies.addEventListener('change', function () {
          var f = kies.files[0];
          if (!f) return;
          info.textContent = 'Bezig met verwerken…';
          verwerkBeeld(f).then(function (r) {
            b.src = r.src; b.w = r.w; b.h = r.h;
            gewijzigd(); ctx.opnieuw();
          }).catch(function () { info.textContent = 'Deze afbeelding kon niet worden gelezen. Probeer een JPG of PNG.'; });
        });
        return [
          h('div', { class: 'beeld-kies' }, duim, h('div', { class: 'velden' },
            h('div', { class: 'knoprij' },
              h('button', { type: 'button', class: 'knop klein', onclick: function () { kies.click(); } }, b.src ? 'Andere afbeelding' : 'Afbeelding kiezen'),
              b.src ? h('button', { type: 'button', class: 'knop klein gevaar', onclick: function () { b.src = ''; b.w = b.h = undefined; gewijzigd(); ctx.opnieuw(); } }, 'Weghalen') : null),
            info, kies)),
          V.tekst('Bijschrift', b, 'caption', { uitleg: 'Staat onder de afbeelding. Webadressen worden klikbaar.' }),
          V.tekst('Alt-tekst', b, 'alt', { hint: 'Beschrijf wat er te zien is', uitleg: 'Voor schermlezers. Laat leeg als het bijschrift het al zegt.' })
        ];
      }
    },
    video: {
      naam: 'Video', groep: 'Beeld en media', uitleg: 'YouTube, Vimeo of een link',
      nieuw: function () { return { t: 'video', bron: '', title: '' }; },
      samenvatting: function (b) { return b.title || b.bron || 'Nog geen video'; },
      waarschuwing: function (b) { return (b.youtube || b.vimeo || b.url) ? '' : 'Nog geen geldige link'; },
      velden: function (b) {
        var herkend = h('div', { class: 'herkend' });
        function toon() {
          if (b.youtube) { herkend.className = 'herkend'; herkend.textContent = 'YouTube-video herkend' + (b.start ? ', start na ' + b.start + ' seconden' : '') + '. Hij wordt ingesloten in de e-learning.'; }
          else if (b.vimeo) { herkend.className = 'herkend'; herkend.textContent = 'Vimeo-video herkend. Hij wordt ingesloten in de e-learning.'; }
          else if (b.url) { herkend.className = 'herkend niet'; herkend.textContent = 'Geen YouTube of Vimeo: de student krijgt een knop naar de video op ' + (host(b.url) || 'die site') + '. Wil je hem toch insluiten, gebruik dan het blok Insluiten.'; }
          else { herkend.className = 'herkend niet'; herkend.textContent = 'Plak de link van de video.'; }
        }
        toon();
        return [
          V.tekst('Link naar de video', b, 'bron', { type: 'url', hint: 'https://www.youtube.com/watch?v=…', opInvoer: function (w) {
            delete b.youtube; delete b.vimeo; delete b.url; delete b.start;
            var r = herkenVideo(w);
            if (r) Object.keys(r).forEach(function (k) { if (r[k] !== undefined) b[k] = r[k]; });
            toon();
          } }),
          herkend,
          V.tekst('Titel', b, 'title', { hint: 'Waar gaat de video over?' })
        ];
      }
    },
    embed: {
      naam: 'Insluiten', groep: 'Beeld en media', uitleg: 'Padlet, Mentimeter, Slides, Canva, H5P…',
      nieuw: function () { return { t: 'embed', bron: '', url: '', title: '', height: 480 }; },
      samenvatting: function (b) { return b.title || host(b.url) || 'Nog geen link'; },
      waarschuwing: function (b) { return b.url ? '' : 'Nog geen geldige link'; },
      velden: function (b) {
        var herkend = h('div', { class: 'herkend' });
        function toon(r) {
          r = r || naarInsluitUrl(b.bron);
          herkend.className = 'herkend' + (r.url ? '' : ' niet');
          herkend.textContent = b.bron ? r.tekst : 'Plak de deellink of insluitlink van de site.';
        }
        toon();
        return [
          V.tekst('Link', b, 'bron', { type: 'url', hint: 'https://…', opInvoer: function (w) { var r = naarInsluitUrl(w); b.url = r.url; toon(r); } }),
          herkend,
          h('div', { class: 'twee' },
            V.tekst('Titel', b, 'title', { hint: 'Bijvoorbeeld: Padlet met jullie vragen' }),
            V.keuze('Hoogte', b, 'height', [[320, 'Laag (320 px)'], [480, 'Gemiddeld (480 px)'], [640, 'Hoog (640 px)'], [800, 'Extra hoog (800 px)']])),
          h('div', { class: 'hulp', text: 'In dit voorbeeld zie je een plaatshouder. In de geëxporteerde e-learning staat de site echt in de pagina.' })
        ];
      }
    },
    links: {
      naam: 'Linkknoppen', groep: 'Beeld en media', uitleg: 'Knoppen naar andere sites',
      nieuw: function () { return { t: 'links', items: [{ label: '', href: '' }] }; },
      samenvatting: function (b) { return b.items.map(function (l) { return l.label || host(l.href); }).filter(Boolean).join(', ') || 'Nog geen links'; },
      waarschuwing: function (b) { return b.items.some(function (l) { return l.href && !/^https?:\/\//.test(l.href); }) ? 'Een link begint niet met https://' : ''; },
      velden: function (b, ctx) {
        return [V.reeks(ctx, 'Links', b.items, {
          compact: true, drie: true, naam: 'Link', min: 1, nieuw: function () { return { label: '', href: '' }; },
          teken: function (l, i) {
            return h('div', { class: 'twee' }, V.tekst(null, l, 'label', { hint: 'Tekst op de knop' }), V.tekst(null, l, 'href', { type: 'url', hint: 'https://…' }));
          }
        })];
      }
    },
    tabs: {
      naam: 'Tabbladen', groep: 'Interactief', uitleg: 'Inhoud naast elkaar',
      nieuw: function () { return { t: 'tabs', items: [{ title: '', body: '' }, { title: '', body: '' }] }; },
      samenvatting: function (b) { return b.items.map(function (i) { return i.title; }).filter(Boolean).join(' · ') || b.items.length + ' tabbladen'; },
      velden: function (b, ctx) {
        return [V.reeks(ctx, null, b.items, {
          naam: 'Tabblad', min: 1, nieuw: function () { return { title: '', body: '' }; },
          teken: function (item) { return h('div', { class: 'velden' }, V.tekst('Titel', item, 'title'), V.rijk('Inhoud', item, 'body')); }
        })];
      }
    },
    accordion: {
      naam: 'Uitklapblok', groep: 'Interactief', uitleg: 'Onderdelen die je openklikt',
      nieuw: function () { return { t: 'accordion', items: [{ title: '', body: '' }, { title: '', body: '' }] }; },
      samenvatting: function (b) { return b.items.map(function (i) { return i.title; }).filter(Boolean).join(' · ') || b.items.length + ' onderdelen'; },
      velden: function (b, ctx) {
        return [V.reeks(ctx, null, b.items, {
          naam: 'Onderdeel', min: 1, nieuw: function () { return { title: '', body: '' }; },
          teken: function (item) { return h('div', { class: 'velden' }, V.tekst('Titel', item, 'title'), V.rijk('Inhoud', item, 'body')); }
        })];
      }
    },
    cards: {
      naam: 'Begrippenkaartjes', groep: 'Interactief', uitleg: 'Omdraaien voor de uitleg',
      nieuw: function () { return { t: 'cards', items: [{ front: '', back: '' }, { front: '', back: '' }, { front: '', back: '' }] }; },
      samenvatting: function (b) { return b.items.map(function (i) { return naarTekst(i.front); }).filter(Boolean).join(' · ') || b.items.length + ' kaartjes'; },
      velden: function (b, ctx) {
        return [V.reeks(ctx, null, b.items, {
          naam: 'Kaartje', min: 1, nieuw: function () { return { front: '', back: '' }; },
          teken: function (item) { return h('div', { class: 'velden' }, V.tekst('Voorkant (begrip)', item, 'front', { html: true }), V.tekst('Achterkant (uitleg)', item, 'back', { meer: true, rijen: 2, html: true })); }
        })];
      }
    },
    timeline: {
      naam: 'Tijdlijn', groep: 'Interactief', uitleg: 'Fases of gebeurtenissen',
      nieuw: function () { return { t: 'timeline', items: [{ date: '', title: '', body: '' }, { date: '', title: '', body: '' }] }; },
      samenvatting: function (b) { return b.items.map(function (i) { return i.date || i.title; }).filter(Boolean).join(' → ') || b.items.length + ' punten'; },
      velden: function (b, ctx) {
        return [V.reeks(ctx, null, b.items, {
          naam: 'Punt', min: 1, nieuw: function () { return { date: '', title: '', body: '' }; },
          teken: function (item) {
            return h('div', { class: 'velden' },
              h('div', { class: 'twee' }, V.tekst('Label', item, 'date', { hint: 'Jaartal of fase' }), V.tekst('Titel', item, 'title')),
              V.tekst('Tekst', item, 'body', { meer: true, rijen: 2, html: true }));
          }
        })];
      }
    },
    steps: {
      naam: 'Stappenplan', groep: 'Interactief', uitleg: 'Genummerde werkwijze',
      nieuw: function () { return { t: 'steps', intro: { title: '', body: '' }, steps: [{ title: '', body: '' }, { title: '', body: '' }], summary: { title: '', body: '' } }; },
      samenvatting: function (b) { return b.intro.title || b.steps.length + ' stappen'; },
      velden: function (b, ctx) {
        return [
          h('div', { class: 'twee' }, V.tekst('Inleiding: titel', b.intro, 'title'), V.tekst('Inleiding: tekst', b.intro, 'body')),
          V.reeks(ctx, 'Stappen', b.steps, {
            compact: true, drie: true, naam: 'Stap', min: 1, nieuw: function () { return { title: '', body: '' }; },
            teken: function (s) { return h('div', { class: 'twee' }, V.tekst(null, s, 'title', { hint: 'Wat doe je?' }), V.tekst(null, s, 'body', { hint: 'Toelichting' })); }
          }),
          h('div', { class: 'twee' }, V.tekst('Afsluiting: titel', b.summary, 'title'), V.tekst('Afsluiting: tekst', b.summary, 'body'))
        ];
      }
    },
    quiz: {
      naam: 'Kennisvraag', groep: 'Vragen', uitleg: 'Meerkeuze, één of meer goed',
      nieuw: function () { return { t: 'quiz', multi: false, question: '', options: [{ text: '', correct: true }, { text: '', correct: false }, { text: '', correct: false }], feedback: '', feedbackWrong: '' }; },
      samenvatting: function (b) { return eerste(b.question, 90) || 'Nog geen vraag'; },
      waarschuwing: function (b) {
        if (!naarTekst(b.question)) return 'Nog geen vraag';
        if (b.options.filter(function (o) { return o.text.trim(); }).length < 2) return 'Minstens twee antwoorden nodig';
        if (!b.options.some(function (o) { return o.correct; })) return 'Geen juist antwoord aangevinkt';
        return '';
      },
      velden: function (b, ctx) {
        var vinkjes = [];
        return [
          V.tekst('Vraag', b, 'question', { meer: true, rijen: 2, html: true }),
          V.schakel('Meer dan één antwoord is goed', b, 'multi', function (aan) {
            if (!aan) { var eerst = b.options.findIndex(function (o) { return o.correct; }); b.options.forEach(function (o, i) { o.correct = i === eerst; }); ctx.opnieuw(); }
          }),
          V.reeks(ctx, 'Antwoorden (vink de juiste aan)', b.options, {
            compact: true, naam: 'Antwoord', min: 2, nieuw: function () { return { text: '', correct: false }; },
            teken: function (o, i) {
              var vink = h('input', { type: 'checkbox', checked: o.correct, 'aria-label': 'Antwoord ' + (i + 1) + ' is juist' });
              vinkjes[i] = vink;
              vink.addEventListener('change', function () {
                o.correct = vink.checked;
                if (vink.checked && !b.multi) b.options.forEach(function (x, j) { if (j !== i) { x.correct = false; if (vinkjes[j]) vinkjes[j].checked = false; } });
                gewijzigd();
              });
              var rij = h('div', { class: 'velden', style: 'gap:6px' },
                V.tekst(null, o, 'text', { hint: 'Antwoord ' + (i + 1) }),
                V.tekst(null, o, 'feedback', { hint: 'Uitleg bij dit antwoord (optioneel)' }));
              return h('div', { style: 'display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:start' }, h('label', { class: 'juist-vink', title: 'Juist antwoord' }, vink), rij);
            }
          }),
          V.tekst('Uitleg na een goed antwoord', b, 'feedback', { meer: true, rijen: 2 }),
          V.tekst('Uitleg na een fout antwoord (optioneel)', b, 'feedbackWrong', { meer: true, rijen: 2 })
        ];
      }
    },
    match: {
      naam: 'Koppelvraag', groep: 'Vragen', uitleg: 'Begrip aan omschrijving',
      nieuw: function () { return { t: 'match', question: '', pairs: [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }], feedback: '', feedbackWrong: '' }; },
      samenvatting: function (b) { return eerste(b.question, 60) || b.pairs.length + ' paren'; },
      waarschuwing: function (b) { return b.pairs.filter(function (p) { return p.left.trim() && p.right.trim(); }).length < 2 ? 'Minstens twee volledige paren nodig' : ''; },
      velden: function (b, ctx) {
        return [
          V.tekst('Opdracht', b, 'question', { meer: true, rijen: 2, html: true, hint: 'Koppel elk begrip aan de juiste omschrijving.' }),
          V.reeks(ctx, 'Paren (de student ziet de omschrijvingen door elkaar)', b.pairs, {
            compact: true, drie: true, naam: 'Paar', min: 2, nieuw: function () { return { left: '', right: '' }; },
            teken: function (p) { return h('div', { class: 'twee' }, V.tekst(null, p, 'left', { hint: 'Begrip' }), V.tekst(null, p, 'right', { hint: 'Omschrijving' })); }
          }),
          V.tekst('Uitleg na een goed antwoord', b, 'feedback', { meer: true, rijen: 2 }),
          V.tekst('Uitleg na een fout antwoord (optioneel)', b, 'feedbackWrong', { meer: true, rijen: 2 })
        ];
      }
    },
    sort: {
      naam: 'Sorteeropdracht', groep: 'Vragen', uitleg: 'Onderdelen in categorieën',
      nieuw: function () { return { t: 'sort', question: '', piles: ['', ''], items: [{ text: '', pile: 0 }, { text: '', pile: 1 }], feedback: '', feedbackWrong: '' }; },
      samenvatting: function (b) { return b.question || b.piles.filter(Boolean).join(' / ') || 'Nog leeg'; },
      waarschuwing: function (b) {
        if (b.piles.filter(function (p) { return p.trim(); }).length < 2) return 'Minstens twee categorieën nodig';
        if (!b.items.some(function (i) { return i.text.trim(); })) return 'Nog geen onderdelen';
        return '';
      },
      velden: function (b, ctx) {
        return [
          V.tekst('Opdracht', b, 'question', { hint: 'Bij welke categorie hoort elk onderdeel?' }),
          V.reeks(ctx, 'Categorieën', b.piles, {
            compact: true, naam: 'Categorie', min: 2, nieuw: function () { return ''; },
            opVerwijder: function (p) { b.items.forEach(function (i) { if (i.pile === p) i.pile = 0; else if (i.pile > p) i.pile--; }); },
            teken: function (p, i) {
              var inp = h('input', { type: 'text', value: p, placeholder: 'Categorie ' + (i + 1), 'aria-label': 'Categorie ' + (i + 1) });
              inp.addEventListener('input', function () {
                b.piles[i] = inp.value;
                Array.prototype.forEach.call(ctx.body.querySelectorAll('.stapel-keuze select'), function (sel) {
                  if (sel.options[i]) sel.options[i].textContent = inp.value || 'Categorie ' + (i + 1);
                });
                gewijzigd();
              });
              return inp;
            }
          }),
          V.reeks(ctx, 'Onderdelen', b.items, {
            compact: true, drie: true, naam: 'Onderdeel', min: 1, nieuw: function () { return { text: '', pile: 0 }; },
            teken: function (it) {
              return h('div', { class: 'twee' }, V.tekst(null, it, 'text', { hint: 'Onderdeel' }),
                h('div', { class: 'stapel-keuze' }, V.keuze('Hoort bij', it, 'pile', b.piles.map(function (p, j) { return [j, p || 'Categorie ' + (j + 1)]; }))));
            }
          })
        ];
      }
    },
    continue: {
      naam: 'Doorgaan-knop', groep: 'Structuur', uitleg: 'Verdeelt de module in stappen',
      nieuw: function () { return { t: 'continue' }; },
      samenvatting: function () { return 'De student klikt hier door naar het volgende stuk. Vragen erboven moeten eerst beantwoord zijn.'; },
      velden: function () { return []; }
    },
    svg: {
      naam: 'Schema (SVG)', groep: null, uitleg: '',
      nieuw: function () { return { t: 'svg', svg: '', alt: '', caption: '' }; },
      samenvatting: function (b) { return b.caption || 'Schema'; },
      velden: function (b) {
        return [V.tekst('SVG-code', b, 'svg', { meer: true, rijen: 6, opInvoer: function (w) { b.svg = schoonSvg(w); } }), V.tekst('Beschrijving voor schermlezers', b, 'alt'), V.tekst('Bijschrift', b, 'caption')];
      }
    }
  };

  var PALET = [
    { groep: 'Tekst', items: ['text', 'list', 'quote'] },
    { groep: 'Beeld en media', items: ['image', 'video', 'embed', 'links'] },
    { groep: 'Interactief', items: ['tabs', 'accordion', 'cards', 'timeline', 'steps'] },
    { groep: 'Vragen', items: ['quiz', 'quiz-multi', 'match', 'sort'] },
    { groep: 'Structuur', items: ['continue'] }
  ];
  function maakBlok(sleutel) {
    var b;
    if (sleutel === 'quiz-multi') { b = TYPES.quiz.nieuw(); b.multi = true; b.options[1].correct = true; }
    else b = TYPES[sleutel].nieuw();
    b._k = nieuwId('b');
    return b;
  }

  /* ================================================================ afbeeldingen */

  /* Verkleinen tot hooguit 1600 px en zo comprimeren dat een afbeelding
     onder ~230 kB blijft; dan past hij in de opslag en blijft de export licht. */
  function verwerkBeeld(file) {
    return new Promise(function (ok, fout) {
      var lezer = new FileReader();
      lezer.onerror = fout;
      lezer.onload = function () {
        var img = new Image();
        img.onerror = fout;
        img.onload = function () {
          var schaal = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
          var w = Math.max(1, Math.round(img.naturalWidth * schaal)), hh = Math.max(1, Math.round(img.naturalHeight * schaal));
          if (schaal === 1 && lezer.result.length < 240000 && /^data:image\/(png|jpeg|webp|gif)/.test(lezer.result)) return ok({ src: lezer.result, w: w, h: hh });
          var doek = document.createElement('canvas');
          var q = 0.85, uit;
          for (var poging = 0; poging < 8; poging++) {
            doek.width = w; doek.height = hh;
            var c = doek.getContext('2d');
            c.fillStyle = '#ffffff';
            c.fillRect(0, 0, w, hh);
            c.drawImage(img, 0, 0, w, hh);
            uit = doek.toDataURL('image/jpeg', q);
            if (uit.length < 240000) break;
            if (q > 0.6) q -= 0.1; else { w = Math.round(w * 0.8); hh = Math.round(hh * 0.8); }
          }
          ok({ src: uit, w: w, h: hh });
        };
        img.src = lezer.result;
      };
      lezer.readAsDataURL(file);
    });
  }

  /* ================================================================ staat */

  var S = {
    cursus: null,
    lesId: null,
    gekozenK: null,
    open: {},          /* blokken die dichtgeklapt zijn: _k -> true */
    paletNa: null,     /* index waarna het palet open staat, of -1 voor onderaan */
    vuil: {},
    verwijderdeLessen: [],
    vb: { alles: true, telefoon: false },
    vbModule: undefined,
    lijst: [],
    sample: null,
    laatstWeg: null
  };

  function les() { return S.cursus.lessons.find(function (l) { return l.id === S.lesId; }) || S.cursus.lessons[0] || null; }

  function gewijzigd(lesId) {
    if (S.cursus.voorbeeld) {
      /* Wie het voorbeeld aanpast, krijgt er een eigen kopie van. */
      S.cursus.voorbeeld = false;
      S.cursus.id = nieuwId('c');
      S.vuil['*'] = 1;
      setTimeout(renderKeuze);
    }
    S.vuil[lesId || S.lesId || '*'] = 1;
    S.cursus.updatedAt = Date.now();
    zetStatus('Niet opgeslagen…', 'bezig');
    planBewaar();
    planVoorbeeld();
    werkKopBij(S.gekozenK);
  }

  /* ================================================================ structuur (links) */

  function renderStructuur() {
    var c = S.cursus;
    var baan = $('#structuur');
    baan.innerHTML = '';

    var meta = h('div', { class: 'sectie' },
      h('div', { class: 'sectie-kop' }, h('h2', null, 'E-learning')),
      h('div', { class: 'velden' },
        V.tekst('Titel', c, 'title', { opInvoer: function () { renderKeuze(); } }),
        V.tekst('Ondertitel', c, 'subtitle'),
        V.tekst('Auteur', c, 'author', { hint: 'Je naam' }),
        V.tekst('Bovenregel', c, 'kicker', { hint: 'Bijvoorbeeld de naam van je opleiding' }),
        V.tekst('Introductie op de startpagina', c, 'intro', { meer: true, rijen: 3 })));
    meta.addEventListener('input', function () { S.vuil['*'] = 1; });

    var lijst = h('ol', { class: 'modulelijst' });
    c.lessons.forEach(function (l, i) {
      var vragen = l.blocks.filter(function (b) { return b.t === 'quiz' || b.t === 'match' || b.t === 'sort'; }).length;
      var item = h('li', { class: 'module-item' + (l.id === S.lesId ? ' actief' : '') },
        h('span', { class: 'nr', text: String(i + 1) }),
        h('button', { type: 'button', class: 'kies', onclick: function () { kiesModule(l.id); } },
          h('strong', { text: l.title || 'Module ' + (i + 1) }),
          h('small', { text: l.blocks.length + ' blokken · ' + vragen + (vragen === 1 ? ' vraag' : ' vragen') })),
        h('span', { class: 'mini' },
          icoonknop('omhoog', 'Module omhoog', function () { c.lessons.splice(i - 1, 0, c.lessons.splice(i, 1)[0]); gewijzigd('*'); renderStructuur(); renderEditor(); }, i === 0),
          icoonknop('omlaag', 'Module omlaag', function () { c.lessons.splice(i + 1, 0, c.lessons.splice(i, 1)[0]); gewijzigd('*'); renderStructuur(); renderEditor(); }, i === c.lessons.length - 1)));
      lijst.append(item);
    });

    var modules = h('div', { class: 'sectie' },
      h('div', { class: 'sectie-kop' }, h('h2', null, 'Modules'), h('span', { class: 'hulp', style: 'font-size:11.5px;color:var(--tekst-3)', text: c.lessons.length + ' totaal' })),
      lijst,
      h('div', { class: 'knoprij' },
        h('button', { type: 'button', class: 'knop klein', onclick: nieuweModule }, ico('plus'), 'Module'),
        S.sample ? h('button', { type: 'button', class: 'knop klein claude', onclick: dialoogModule }, ico('ster'), 'Module met Claude') : null));

    var beheer = h('div', { class: 'sectie' },
      h('div', { class: 'sectie-kop' }, h('h2', null, 'Bewaren en delen')),
      h('p', { class: 'hulp', style: 'margin:0 0 12px;font-size:12px;line-height:1.5;color:var(--tekst-2)', text: opslagUitleg() }),
      h('div', { class: 'knoprij' },
        h('button', { type: 'button', class: 'knop klein' + (Bestand.gekoppeld() ? '' : ' primair'), onclick: function () { Bestand.opslaan(); } }, ico('schijf'), Bestand.gekoppeld() ? 'Nu opslaan' : 'Opslaan als bestand'),
        Bestand.gekoppeld() && Bestand.kan() ? h('button', { type: 'button', class: 'knop klein', onclick: function () { Bestand.opslaan(true); } }, 'Ander bestand') : null,
        h('button', { type: 'button', class: 'knop klein', onclick: dialoogExport }, 'Exporteren'),
        h('button', { type: 'button', class: 'knop klein', onclick: dupliceerCursus }, 'Kopie maken'),
        verwijderKnop('E-learning verwijderen', verwijderCursus)));

    baan.append(meta, modules, beheer);
    renderRail();
  }

  /* De ingeklapte structuur: uitklappen, en snel van module wisselen. */
  function renderRail() {
    var rail = $('#rail-links');
    if (!rail) return;
    rail.innerHTML = '';
    rail.append(
      icoonknop('paneelL', 'Structuur uitklappen (Alt+1)', function () { Panelen.zet('links', true); }),
      h('button', { type: 'button', class: 'rail-label', title: 'Structuur uitklappen (Alt+1)', onclick: function () { Panelen.zet('links', true); } }, 'Structuur'),
      h('ol', { class: 'rail-modules', 'aria-label': 'Modules' }, S.cursus.lessons.map(function (l, i) {
        return h('li', null, h('button', {
          type: 'button', class: l.id === S.lesId ? 'actief' : '',
          title: (i + 1) + '. ' + (l.title || 'Module ' + (i + 1)),
          'aria-current': l.id === S.lesId ? 'true' : null,
          onclick: function () { kiesModule(l.id); }
        }, String(i + 1)));
      })));
  }

  function verwijderKnop(label, actie) {
    var plek = h('span');
    function normaal() {
      plek.innerHTML = '';
      plek.append(h('button', { type: 'button', class: 'knop klein gevaar', onclick: vraag }, label));
    }
    function vraag() {
      plek.innerHTML = '';
      plek.append(h('span', { class: 'bevestig' }, 'Zeker weten?',
        h('button', { type: 'button', class: 'knop klein gevaar vast', onclick: actie }, 'Verwijderen'),
        h('button', { type: 'button', class: 'knop klein', onclick: normaal }, 'Annuleren')));
    }
    normaal();
    return plek;
  }

  function kiesModule(id) {
    S.lesId = id;
    S.gekozenK = null;
    S.paletNa = null;
    S.vbModule = id;
    renderStructuur();
    renderEditor();
    tekenVoorbeeld();
    $('#editor-baan').scrollTop = 0;
    if (matchMedia('(max-width: 760px)').matches) zetTab('bewerken');
  }

  function nieuweModule() {
    var l = { id: nieuwId('m'), title: 'Module ' + (S.cursus.lessons.length + 1), deadline: '', blocks: [maakBlok('text')] };
    S.cursus.lessons.push(l);
    gewijzigd(l.id);
    kiesModule(l.id);
    var titel = $('#module-titel');
    if (titel) { titel.focus(); titel.select(); }
  }

  /* ================================================================ editor (midden) */

  var kaarten = {};

  function renderEditor() {
    var ed = $('#editor');
    ed.innerHTML = '';
    kaarten = {};
    var l = les();
    if (!l) {
      ed.append(h('div', { class: 'blok-kaart', style: 'padding:24px' },
        h('h2', { style: 'font-size:18px;margin-bottom:8px' }, 'Nog geen modules'),
        h('p', { style: 'color:var(--tekst-2);margin:0 0 14px' }, 'Een e-learning bestaat uit modules. Begin met je eerste.'),
        h('div', { class: 'knoprij' }, h('button', { type: 'button', class: 'knop primair', onclick: nieuweModule }, 'Eerste module maken'),
          S.sample ? h('button', { type: 'button', class: 'knop claude', onclick: dialoogModule }, ico('ster'), 'Laat Claude een module opzetten') : null)));
      return;
    }
    S.lesId = l.id;
    var nr = S.cursus.lessons.indexOf(l) + 1;
    var titelInp = h('input', { type: 'text', id: 'module-titel', class: 'titelveld', value: l.title, 'aria-label': 'Titel van de module' });
    titelInp.addEventListener('input', function () {
      l.title = titelInp.value;
      var item = $('.module-item.actief strong');
      if (item) item.textContent = l.title || 'Module ' + nr;
      gewijzigd(l.id);
    });

    var kop = h('div', { class: 'editor-kop' },
      h('div', { class: 'eyebrow', text: 'Module ' + nr + ' van ' + S.cursus.lessons.length }),
      titelInp,
      h('div', { class: 'rij' },
        V.tekst('Afronden vóór (optioneel)', l, 'deadline', { hint: 'Bijvoorbeeld 14 september' }),
        h('div', { class: 'knoprij', style: 'padding-bottom:1px' },
          S.sample ? h('button', { type: 'button', class: 'knop claude', onclick: dialoogVragen }, ico('ster'), 'Kennisvragen met Claude') : null,
          verwijderKnop('Module verwijderen', function () { verwijderModule(l); }))));
    ed.append(kop);

    var blokken = h('div', { class: 'blokken', id: 'blokken' });
    blokken.append(invoegPlek(-1));
    l.blocks.forEach(function (b, i) {
      blokken.append(blokKaart(b, i, l));
      blokken.append(invoegPlek(i));
    });
    ed.append(blokken);
    if (!l.blocks.length) ed.append(h('p', { style: 'color:var(--tekst-2);text-align:center;margin:12px 0 0' }, 'Deze module is nog leeg. Voeg hieronder je eerste blok toe.'));

    var onder = h('div', { class: 'toevoegen-onder' },
      S.paletNa === 'onder' ? palet('onder') : h('button', { type: 'button', class: 'knop', onclick: function () { S.paletNa = 'onder'; renderEditor(); } }, ico('plus'), 'Blok toevoegen'));
    ed.append(onder);
  }

  function invoegPlek(naIndex) {
    if (S.paletNa === naIndex) return palet(naIndex);
    var plek = h('div', { class: 'invoegen' },
      h('button', { type: 'button', onclick: function () { S.paletNa = naIndex; renderEditor(); var p = $('.palet'); if (p) p.scrollIntoView({ block: 'nearest' }); } }, '+ Blok invoegen'));
    return plek;
  }

  function palet(naIndex) {
    var p = h('div', { class: 'palet', role: 'dialog', 'aria-label': 'Kies een blok' },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center' },
        h('strong', { style: 'font-family:var(--f-kop)' }, 'Kies een blok'),
        icoonknop('kruis', 'Sluiten', function () { S.paletNa = null; renderEditor(); })));
    PALET.forEach(function (g) {
      p.append(h('div', { class: 'palet-groep' }, h('h3', null, g.groep),
        h('div', { class: 'palet-knoppen' }, g.items.map(function (sleutel) {
          var type = TYPES[sleutel === 'quiz-multi' ? 'quiz' : sleutel];
          var naam = sleutel === 'quiz-multi' ? 'Meerdere antwoorden' : sleutel === 'quiz' ? 'Meerkeuzevraag' : type.naam;
          var uitleg = sleutel === 'quiz-multi' ? 'Meer dan één antwoord goed' : sleutel === 'quiz' ? 'Eén goed antwoord' : type.uitleg;
          return h('button', { type: 'button', onclick: function () { voegBlokIn(sleutel, naIndex); } },
            ico(sleutel === 'quiz-multi' ? 'quiz' : sleutel), h('strong', null, naam), h('small', null, uitleg));
        }))));
    });
    return p;
  }

  function voegBlokIn(sleutel, naIndex) {
    var l = les();
    var b = maakBlok(sleutel);
    var plek = naIndex === 'onder' ? l.blocks.length : naIndex + 1;
    l.blocks.splice(plek, 0, b);
    S.paletNa = null;
    S.gekozenK = b._k;
    gewijzigd(l.id);
    renderEditor();
    renderStructuur();
    var k = kaarten[b._k];
    if (k) {
      k.kaart.scrollIntoView({ block: 'center' });
      var eersteVeld = k.kaart.querySelector('input, textarea, .rijk');
      if (eersteVeld) eersteVeld.focus();
    }
  }

  function blokKaart(b, i, l) {
    var type = TYPES[b.t] || TYPES.text;
    var dicht = !!S.open[b._k];
    var kaart = h('div', { class: 'blok-kaart' + (b.t === 'continue' ? ' doorgaan-kaart' : '') + (S.gekozenK === b._k ? ' gekozen' : '') + (dicht ? ' dicht' : '') });
    var samenv = h('span', { class: 'samenvatting' });
    var waarsch = h('span');
    var naamEl = h('span');
    var kopKnop = h('button', { type: 'button', class: 'type', 'aria-expanded': dicht ? 'false' : 'true', title: dicht ? 'Uitklappen' : 'Inklappen',
      onclick: function () { S.open[b._k] = !S.open[b._k]; kaart.classList.toggle('dicht'); kopKnop.setAttribute('aria-expanded', S.open[b._k] ? 'false' : 'true'); } },
      ico(b.t), naamEl);
    var kop = h('div', { class: 'blok-kop' }, kopKnop, samenv, waarsch,
      h('span', { class: 'acties' },
        icoonknop('omhoog', 'Blok omhoog', function () { verplaats(l, i, -1); }, i === 0),
        icoonknop('omlaag', 'Blok omlaag', function () { verplaats(l, i, 1); }, i === l.blocks.length - 1),
        icoonknop('kopie', 'Blok dupliceren', function () {
          var kopie = kloon(b);
          kopie._k = nieuwId('b');
          l.blocks.splice(i + 1, 0, kopie);
          S.gekozenK = kopie._k;
          gewijzigd(l.id); renderEditor(); renderStructuur();
        }),
        icoonknop('weg', 'Blok verwijderen', function () {
          l.blocks.splice(i, 1);
          S.laatstWeg = { lesId: l.id, index: i, blok: b };
          gewijzigd(l.id); renderEditor(); renderStructuur();
          melding(type.naam + ' verwijderd.', { tekst: 'Ongedaan maken', doe: function () {
            var w = S.laatstWeg;
            var doel = S.cursus.lessons.find(function (x) { return x.id === w.lesId; });
            if (!doel) return;
            doel.blocks.splice(Math.min(w.index, doel.blocks.length), 0, w.blok);
            S.gekozenK = w.blok._k;
            gewijzigd(doel.id); renderEditor(); renderStructuur();
          } });
        })));
    var body = h('div', { class: 'blok-body' });
    var ctx = {
      body: body,
      opnieuw: function () {
        body.innerHTML = '';
        voegToe(body, type.velden(b, ctx));
        werkKopBij(b._k);
      }
    };
    voegToe(body, type.velden(b, ctx));
    kaart.append(kop, body);
    kaart.addEventListener('focusin', function () { kiesBlok(b._k); });
    kaart.addEventListener('mousedown', function () { kiesBlok(b._k); });
    kaarten[b._k] = { kaart: kaart, samenv: samenv, waarsch: waarsch, naam: naamEl, blok: b, index: i };
    werkKopBij(b._k);
    return kaart;
  }

  function werkKopBij(k) {
    var x = k && kaarten[k];
    if (!x) return;
    var type = TYPES[x.blok.t] || TYPES.text;
    x.naam.textContent = x.blok.t === 'quiz' ? (x.blok.multi ? 'Meerdere antwoorden' : 'Meerkeuzevraag') : type.naam;
    x.samenv.textContent = type.samenvatting(x.blok);
    var w = type.waarschuwing ? type.waarschuwing(x.blok) : '';
    x.waarsch.innerHTML = '';
    if (w) x.waarsch.append(h('span', { class: 'waarschuwing', title: w }, ico('let'), w));
  }

  function kiesBlok(k) {
    if (S.gekozenK === k) return;
    S.gekozenK = k;
    Object.keys(kaarten).forEach(function (key) { kaarten[key].kaart.classList.toggle('gekozen', key === k); });
    var x = kaarten[k];
    if (x && vbSpeler && vbSpeler.module() === S.lesId) vbSpeler.naarBlok(x.index);
  }

  function verplaats(l, i, stap) {
    var j = i + stap;
    if (j < 0 || j >= l.blocks.length) return;
    l.blocks.splice(j, 0, l.blocks.splice(i, 1)[0]);
    gewijzigd(l.id);
    renderEditor();
    var k = kaarten[l.blocks[j]._k];
    if (k) k.kaart.scrollIntoView({ block: 'nearest' });
  }

  function verwijderModule(l) {
    var i = S.cursus.lessons.indexOf(l);
    S.cursus.lessons.splice(i, 1);
    S.verwijderdeLessen.push(l.id);
    var volgende = S.cursus.lessons[Math.min(i, S.cursus.lessons.length - 1)];
    S.lesId = volgende ? volgende.id : null;
    gewijzigd('*');
    kiesModule(S.lesId);
    melding('Module verwijderd.');
  }

  /* ================================================================ voorbeeld (rechts) */

  var vbRoot = null, vbSpeler = null, vbTimer = null;

  function initVoorbeeld() {
    var host = $('#voorbeeld');
    var schaduw = host.attachShadow({ mode: 'open' });
    /* Het voorbeeld is smaller dan het venster; daarom reageert de mobiele
       opmaak hier op de breedte van het voorbeeld in plaats van het scherm. */
    var css = $('#speler-css').textContent.replace(/@media\s*\(max-width:\s*(\d+)px\)/g, '@container speler (max-width: $1px)');
    schaduw.append(h('style', { text: css + '\n.speler-vlak { container: speler / inline-size; min-height: 100%; }' }));
    vbRoot = h('div', { class: 'cursus' });
    schaduw.append(h('div', { class: 'speler-vlak' }, vbRoot));
  }

  function spelerCursus() { return zonderSleutels(S.cursus); }

  function tekenVoorbeeld() {
    if (!vbRoot || !S.cursus) return;
    var host = $('#voorbeeld');
    var boven = host.scrollTop;
    var module = S.vbModule === undefined ? S.lesId : S.vbModule;
    var vorige = vbSpeler ? vbSpeler.module() : undefined;
    try {
      vbSpeler = Speler(vbRoot, spelerCursus(), {
        sleutel: 'bouwer-voorbeeld:',
        voorbeeld: true,
        allesTonen: S.vb.alles,
        scroller: host,
        module: module || undefined,
        opModule: function (id) {
          S.vbModule = id;
          if (id && id !== S.lesId && S.cursus.lessons.some(function (l) { return l.id === id; })) {
            S.lesId = id;
            S.gekozenK = null;
            renderStructuur();
            renderEditor();
          }
        }
      });
    } catch (e) {
      vbRoot.textContent = 'Het voorbeeld kon niet worden getekend: ' + e.message;
      return;
    }
    if (vorige === vbSpeler.module()) host.scrollTop = boven;
  }

  function planVoorbeeld() {
    clearTimeout(vbTimer);
    vbTimer = setTimeout(tekenVoorbeeld, 350);
  }

  /* ================================================================ opslag */

  /* In je account (db, per persoon privé) als dat kan, anders in deze browser.
     Een cursus staat verdeeld over documenten: één voor de gegevens, één per
     module en één per afbeelding, zodat elk document klein blijft. */
  var Opslag = {
    modus: 'geen',
    col: null,
    beelden: {},

    start: function () {
      return Promise.all([cap('db'), cap('user')]).then(function (r) {
        var db = r[0], user = r[1];
        if (!db || !user) { Opslag.modus = 'browser'; return; }
        return Promise.resolve(user.id()).then(function (uid) {
          if (!uid) { Opslag.modus = 'browser'; return; }
          var magSchrijven = user.can ? user.can('data.write') : null;
          return Promise.resolve(magSchrijven).then(function (mag) {
            if (mag === false) { Opslag.modus = 'browser'; return; }
            Opslag.col = db.collection('data/users/' + uid);
            Opslag.modus = 'account';
          });
        });
      }).catch(function () { Opslag.modus = 'browser'; });
    },

    browserIndex: function () {
      try { return JSON.parse(ls('bouwer:index') || '[]'); } catch (e) { return []; }
    },

    lijst: function () {
      var lokaal = Opslag.browserIndex().map(function (x) { x.plek = 'browser'; return x; });
      if (Opslag.modus !== 'account') return Promise.resolve(lokaal);
      return Opslag.col.where('kind', '==', 'cursus').get().then(function (snap) {
        var lijst = snap.docs.map(function (d) { var x = d.data(); return { id: x.id, title: x.title, updatedAt: x.updatedAt, plek: 'account' }; });
        lokaal.forEach(function (x) { if (!lijst.some(function (y) { return y.id === x.id; })) lijst.push(x); });
        return lijst.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
      }).catch(function () { return lokaal; });
    },

    laad: function (id) {
      function uitBrowser() {
        var ruw = ls('bouwer:c:' + id);
        if (!ruw) throw new Error('niet gevonden');
        return JSON.parse(ruw);
      }
      if (Opslag.modus !== 'account') return Promise.resolve().then(uitBrowser);
      return Opslag.col.doc('cursus-' + id).get().then(function (meta) {
        if (!meta.exists) return uitBrowser();
        var m = meta.data();
        return Promise.all((m.lessonIds || []).map(function (lid) { return Opslag.col.doc('les-' + id + '-' + lid).get(); })).then(function (lessen) {
          return Opslag.col.where('kind', '==', 'beeld').where('cursus', '==', id).get().then(function (snap) {
            var beelden = {};
            snap.docs.forEach(function (d) { var x = d.data(); beelden[x.key] = x.data; Opslag.beelden[id + ':' + x.key] = 1; });
            var c = { id: m.id, title: m.title, subtitle: m.subtitle, author: m.author, intro: m.intro, kicker: m.kicker, updatedAt: m.updatedAt, lessons: [] };
            lessen.forEach(function (d) { if (d.exists) c.lessons.push(d.data().les); });
            c.lessons.forEach(function (l) {
              (l.blocks || []).forEach(function (b) {
                if (b.t === 'image' && /^beeld:/.test(b.src)) b.src = beelden[b.src.slice(6)] || '';
              });
            });
            return c;
          });
        });
      });
    },

    bewaar: function (c, vuil, weg) {
      var kaal = zonderSleutels(c);
      var beelden = [];
      kaal.lessons.forEach(function (l) {
        l.blocks.forEach(function (b) {
          if (b.t === 'image' && /^data:/.test(b.src)) {
            var key = hash(b.src);
            beelden.push([key, b.src]);
            b.src = 'beeld:' + key;
          }
        });
      });
      var browserGelukt = Opslag.bewaarBrowser(zonderSleutels(c));
      if (Opslag.modus !== 'account') return Promise.resolve(browserGelukt ? 'browser' : 'fout');

      var col = Opslag.col;
      var keten = Promise.resolve();
      beelden.forEach(function (x) {
        if (Opslag.beelden[c.id + ':' + x[0]]) return;
        keten = keten.then(function () {
          return col.doc('beeld-' + c.id + '-' + x[0]).set({ kind: 'beeld', cursus: c.id, key: x[0], data: x[1] }).then(function () { Opslag.beelden[c.id + ':' + x[0]] = 1; });
        });
      });
      kaal.lessons.forEach(function (l) {
        if (!vuil['*'] && !vuil[l.id]) return;
        keten = keten.then(function () { return col.doc('les-' + c.id + '-' + l.id).set({ kind: 'les', cursus: c.id, les: l }); });
      });
      weg.forEach(function (lid) {
        keten = keten.then(function () { return col.doc('les-' + c.id + '-' + lid).delete(); });
      });
      keten = keten.then(function () {
        return col.doc('cursus-' + c.id).set({
          kind: 'cursus', id: c.id, title: c.title, subtitle: c.subtitle, author: c.author, intro: c.intro, kicker: c.kicker,
          lessonIds: c.lessons.map(function (l) { return l.id; }), updatedAt: c.updatedAt
        });
      });
      return keten.then(function () { return 'account'; });
    },

    bewaarBrowser: function (c) {
      try {
        ls('bouwer:c:' + c.id, JSON.stringify(c));
        var index = Opslag.browserIndex().filter(function (x) { return x.id !== c.id; });
        index.unshift({ id: c.id, title: c.title, updatedAt: c.updatedAt });
        ls('bouwer:index', JSON.stringify(index));
        return true;
      } catch (e) {
        return false;
      }
    },

    verwijder: function (id) {
      try {
        ls('bouwer:c:' + id, null);
        ls('bouwer:index', JSON.stringify(Opslag.browserIndex().filter(function (x) { return x.id !== id; })));
      } catch (e) { /* niets */ }
      if (Opslag.modus !== 'account') return Promise.resolve();
      var col = Opslag.col;
      return Promise.all([
        col.where('cursus', '==', id).get(),
        col.doc('cursus-' + id).get()
      ]).then(function (r) {
        var keten = Promise.resolve();
        r[0].docs.forEach(function (d) { keten = keten.then(function () { return col.doc(d.id).delete(); }); });
        if (r[1].exists) keten = keten.then(function () { return col.doc('cursus-' + id).delete(); });
        return keten;
      });
    }
  };

  function hash(s) {
    var x = 2166136261;
    for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
    return (x >>> 0).toString(36) + s.length.toString(36);
  }

  var bewaarTimer = null, bezigMetBewaren = null;
  function planBewaar() {
    clearTimeout(bewaarTimer);
    bewaarTimer = setTimeout(bewaarNu, 1200);
  }
  function bewaarNu() {
    if (bezigMetBewaren) { planBewaar(); return bezigMetBewaren; }
    var c = S.cursus;
    if (c.voorbeeld) return Promise.resolve();
    var vuil = S.vuil, weg = S.verwijderdeLessen.slice();
    S.vuil = {};
    S.verwijderdeLessen = [];
    zetStatus('Opslaan…', 'bezig');
    bezigMetBewaren = Opslag.bewaar(c, vuil, weg).then(function (plek) {
      ls('bouwer:laatste', c.id);
      if (plek === 'fout') zetStatus('Niet opgeslagen: exporteer als bouwbestand', 'fout');
      else statusOpgeslagen();
      if (plek === 'browser' && !Bestand.gekoppeld() && !ls('bouwer:uitleg-browser')) {
        try { ls('bouwer:uitleg-browser', '1'); } catch (e) { /* geen opslag */ }
        melding('Je werk staat alleen in deze browser. Maak met Opslaan een bestand op je computer; daar komt dan elke 15 minuten een back-up in.', { tekst: 'Opslaan', doe: function () { Bestand.opslaan(); } });
      }
      if (!S.lijst.some(function (x) { return x.id === c.id; })) S.lijst.unshift({ id: c.id, title: c.title, updatedAt: c.updatedAt, plek: plek });
      S.lijst.forEach(function (x) { if (x.id === c.id) x.title = c.title; });
      renderKeuze();
    }).catch(function () {
      Object.keys(vuil).forEach(function (k) { S.vuil[k] = 1; });
      S.verwijderdeLessen = S.verwijderdeLessen.concat(weg);
      zetStatus('Opslaan mislukt, nieuwe poging…', 'fout');
      setTimeout(planBewaar, 4000);
    }).then(function () { bezigMetBewaren = null; });
    return bezigMetBewaren;
  }

  function zetStatus(tekst, soort) {
    var s = $('#status');
    s.innerHTML = '';
    s.append(h('span', { class: 'status-tekst', text: tekst }));
    s.setAttribute('data-soort', soort || '');
  }

  /* Na het opslaan: zeg waar het werk nu staat. Alleen in de browser is een waarschuwing waard. */
  function statusOpgeslagen() {
    var c = S.cursus;
    if (c.voorbeeld) return zetStatus('Voorbeeld: wijzigingen maken een eigen kopie', '');
    var bestand = Bestand.gekoppeld() ? Bestand.naam() + ' · ' + tijdstip(Bestand.laatst()) : '';
    if (Opslag.modus === 'account') return zetStatus('Opgeslagen in je account' + (bestand ? ' en in ' + bestand : ''), 'ok');
    if (bestand) return zetStatus('In deze browser en in ' + bestand, 'ok');
    zetStatus('Alleen in deze browser opgeslagen' + (Bestand.laatst() ? ' · kopie gedownload om ' + tijdstip(Bestand.laatst()) : ''), 'let');
  }
  function tijdstip(t) {
    if (!t) return 'nog niet';
    var d = new Date(t);
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  function opslagUitleg() {
    var bestand = Bestand.gekoppeld()
      ? ' Er staat ook een kopie in het bestand ' + Bestand.naam() + ' op je computer (laatst om ' + tijdstip(Bestand.laatst()) + '). Daar komt elke 15 minuten automatisch een back-up in als je iets hebt gewijzigd.'
      : Bestand.kan()
        ? ' Druk op Opslaan om een bestand op je computer te maken. Daarna zet de bouwer daar elke 15 minuten automatisch een back-up in.'
        : ' Druk op Opslaan om een bouwbestand te downloaden. Elke 15 minuten krijg je een herinnering als er iets is gewijzigd.';
    if (Opslag.modus === 'account') return 'Je werk wordt automatisch bewaard in je account, alleen zichtbaar voor jou.' + bestand;
    if (Opslag.modus === 'browser') return 'Je werk staat alleen in deze browser. Wis je je browsergegevens, of werk je in een andere browser of op een andere computer, dan zie je het hier niet terug.' + bestand;
    return 'Opslag wordt geladen…';
  }

  /* ================================================================ cursussen kiezen */

  function renderKeuze() {
    var sel = $('#cursus-keuze');
    sel.innerHTML = '';
    var huidig = S.cursus;
    var lijst = S.lijst.slice();
    if (!huidig.voorbeeld && !lijst.some(function (x) { return x.id === huidig.id; })) lijst.unshift({ id: huidig.id, title: huidig.title });
    if (lijst.length) {
      sel.append(h('optgroup', { label: 'Mijn e-learnings' }, lijst.map(function (x) {
        return h('option', { value: x.id }, (x.id === huidig.id ? huidig.title : x.title) || 'Naamloze e-learning');
      })));
    }
    sel.append(h('optgroup', { label: 'Beginnen' },
      h('option', { value: '__nieuw' }, '+ Nieuwe e-learning'),
      h('option', { value: '__voorbeeld' }, 'Voorbeeld: Duurzaamheid en systeemdenken')));
    sel.value = huidig.voorbeeld ? '__voorbeeld' : huidig.id;
  }

  function wissel(c) {
    S.cursus = c;
    S.lesId = c.lessons[0] ? c.lessons[0].id : null;
    S.gekozenK = null;
    S.paletNa = null;
    S.vbModule = undefined;
    S.vuil = {};
    S.verwijderdeLessen = [];
    Bestand.wissel(c);
    renderAlles();
    statusOpgeslagen();
  }

  function bewaarEerst() {
    clearTimeout(bewaarTimer);
    if (Object.keys(S.vuil).length || S.verwijderdeLessen.length) return bewaarNu();
    return bezigMetBewaren || Promise.resolve();
  }

  function openCursus(id) {
    return bewaarEerst().then(function () { return Opslag.laad(id); }).then(function (ruw) {
      wissel(normaliseerCursus(ruw));
      ls('bouwer:laatste', id);
    }).catch(function () {
      melding('Deze e-learning kon niet worden geopend.');
      renderKeuze();
    });
  }

  function voorbeeldCursus() { return normaliseerCursus(JSON.parse($('#voorbeeld-cursus').textContent)); }

  function nieuweCursus() {
    return bewaarEerst().then(function () {
      var c = normaliseerCursus({ title: 'Nieuwe e-learning', lessons: [{ id: 'm1', title: 'Module 1', blocks: [{ t: 'text', heading: 'Welkom', body: '' }] }] }, { nieuwId: true });
      wissel(c);
      S.vuil['*'] = 1;
      bewaarNu();
      var t = $('#structuur input');
      if (t) { t.focus(); t.select(); }
    });
  }

  function dupliceerCursus() {
    var c = normaliseerCursus(zonderSleutels(S.cursus), { nieuwId: true });
    c.title = c.title + ' (kopie)';
    c.updatedAt = Date.now();
    bewaarEerst().then(function () {
      wissel(c);
      S.vuil['*'] = 1;
      bewaarNu();
      melding('Kopie gemaakt.');
    });
  }

  function verwijderCursus() {
    var c = S.cursus;
    clearTimeout(bewaarTimer);
    (c.voorbeeld ? Promise.resolve() : Opslag.verwijder(c.id)).then(function () {
      S.lijst = S.lijst.filter(function (x) { return x.id !== c.id; });
      melding('E-learning verwijderd.');
      if (S.lijst.length) return openCursus(S.lijst[0].id);
      wissel(voorbeeldCursus());
    });
  }

  /* ================================================================ exporteren */

  function exportDocument(c, scorm) {
    /* "<" en de twee Unicode-regeleinden als escape, zodat de gegevens het
       script-element nooit kunnen afsluiten of breken. */
    var bs = String.fromCharCode(92);
    var data = JSON.stringify(c).split('<').join(bs + 'u003c')
      .split(String.fromCharCode(0x2028)).join(bs + 'u2028')
      .split(String.fromCharCode(0x2029)).join(bs + 'u2029');
    return '<!doctype html>\n<html lang="nl">\n<head>\n<meta charset="utf-8">\n'
      + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
      + '<meta name="generator" content="E-learning Bouwer">\n'
      + '<title>' + esc(c.title) + '</title>\n'
      + '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
      + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap">\n'
      + '<style>\nhtml, body { margin: 0; min-height: 100%; }\nbody { background: #F7F4F0; }\n' + $('#speler-css').textContent + '\n</style>\n'
      + '</head>\n<body>\n<div class="cursus" id="cursus"></div>\n'
      + '<script type="application/json" id="cursus-data">' + data + '<\/script>\n'
      + '<script>\n' + Speler.toString() + '\n' + (scorm ? ScormKoppeling.toString() + '\n' : '')
      + '(function () {\n  var c = JSON.parse(document.getElementById("cursus-data").textContent);\n  var o = { hash: true };\n'
      + (scorm ? '  var lms = ScormKoppeling(c);\n  if (lms.actief) o.opslag = lms;\n' : '')
      + '  Speler(document.getElementById("cursus"), c, o);\n})();\n<\/script>\n</body>\n</html>\n';
  }

  /* SCORM 1.2: zoekt de API van het LMS, bewaart de voortgang in
     cmi.suspend_data en meldt voltooiing en score. Zonder LMS doet hij niets
     en gebruikt de speler gewoon de browser. */
  function ScormKoppeling(cursus) {
    function zoek(w) {
      for (var n = 0; w && n < 12; n++) {
        try { if (w.API) return w.API; } catch (e) { return null; }
        if (w.parent === w) break;
        w = w.parent;
      }
      return null;
    }
    var api = zoek(window) || (window.opener ? zoek(window.opener) : null);
    var actief = false;
    var begin = Date.now();
    if (api) {
      try { var r = api.LMSInitialize(''); actief = r === true || r === 'true'; } catch (e) { actief = false; }
    }
    function lees(k) { try { return String(api.LMSGetValue(k) || ''); } catch (e) { return ''; } }
    function zet(k, v) { try { api.LMSSetValue(k, String(v)); } catch (e) { /* LMS weigert */ } }
    function duur(ms) {
      var s = Math.round(ms / 1000), u = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
      s = s % 60;
      return ('000' + u).slice(-4) + ':' + ('0' + m).slice(-2) + ':' + ('0' + s).slice(-2) + '.00';
    }
    if (actief) {
      var status = lees('cmi.core.lesson_status');
      if (!status || status === 'not attempted') zet('cmi.core.lesson_status', 'incomplete');
    }
    var afgesloten = false;
    function sluit() {
      if (!actief || afgesloten) return;
      afgesloten = true;
      zet('cmi.core.session_time', duur(Date.now() - begin));
      try { api.LMSCommit(''); api.LMSFinish(''); } catch (e) { /* niets */ }
    }
    window.addEventListener('pagehide', sluit);
    window.addEventListener('beforeunload', sluit);
    return {
      actief: actief,
      lees: function () { return lees('cmi.suspend_data'); },
      schrijf: function (json, staat, module) {
        if (!actief || afgesloten) return;
        zet('cmi.suspend_data', json);
        if (module) zet('cmi.core.lesson_location', module);
        var totaal = 0, goed = 0;
        cursus.lessons.forEach(function (l) {
          var ms = staat.modules[l.id];
          var vragen = l.blocks.filter(function (b) { return b.t === 'quiz' || b.t === 'match' || b.t === 'sort'; }).length;
          totaal += vragen;
          if (ms) Object.keys(ms.antwoorden || {}).forEach(function (k) { if (ms.antwoorden[k].goed) goed++; });
        });
        if (totaal) {
          zet('cmi.core.score.min', 0);
          zet('cmi.core.score.max', 100);
          zet('cmi.core.score.raw', Math.min(100, Math.round((goed / totaal) * 100)));
        }
        var af = cursus.lessons.length > 0 && cursus.lessons.every(function (l) { return staat.modules[l.id] && staat.modules[l.id].af; });
        if (af) zet('cmi.core.lesson_status', 'completed');
        try { api.LMSCommit(''); } catch (e) { /* niets */ }
      }
    };
  }

  function scormManifest(c) {
    var t = esc(c.title);
    return '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<manifest identifier="MANIFEST-' + esc(c.id) + '" version="1.0"\n'
      + '  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"\n'
      + '  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"\n'
      + '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n'
      + '  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">\n'
      + '  <metadata>\n    <schema>ADL SCORM</schema>\n    <schemaversion>1.2</schemaversion>\n  </metadata>\n'
      + '  <organizations default="ORG-1">\n    <organization identifier="ORG-1">\n      <title>' + t + '</title>\n'
      + '      <item identifier="ITEM-1" identifierref="RES-1" isvisible="true">\n        <title>' + t + '</title>\n      </item>\n'
      + '    </organization>\n  </organizations>\n'
      + '  <resources>\n    <resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="index.html">\n      <file href="index.html"/>\n    </resource>\n  </resources>\n'
      + '</manifest>\n';
  }

  /* Een zip zonder compressie: genoeg voor een SCORM-pakket en geen bibliotheek nodig. */
  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(d) { var c = 0xFFFFFFFF; for (var i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function maakZip(bestanden) {
    var enc = new TextEncoder(), delen = [], centraal = [], offset = 0;
    var d = new Date();
    var tijd = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var datum = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    bestanden.forEach(function (b) {
      var naam = enc.encode(b.naam), data = typeof b.data === 'string' ? enc.encode(b.data) : b.data, crc = crc32(data);
      var kop = new DataView(new ArrayBuffer(30));
      kop.setUint32(0, 0x04034b50, true); kop.setUint16(4, 20, true); kop.setUint16(6, 0x0800, true); kop.setUint16(8, 0, true);
      kop.setUint16(10, tijd, true); kop.setUint16(12, datum, true); kop.setUint32(14, crc, true);
      kop.setUint32(18, data.length, true); kop.setUint32(22, data.length, true); kop.setUint16(26, naam.length, true); kop.setUint16(28, 0, true);
      delen.push(new Uint8Array(kop.buffer), naam, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, tijd, true); c.setUint16(14, datum, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, naam.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true);
      c.setUint32(38, 0, true); c.setUint32(42, offset, true);
      centraal.push(new Uint8Array(c.buffer), naam);
      offset += 30 + naam.length + data.length;
    });
    var grootte = centraal.reduce(function (s, x) { return s + x.length; }, 0);
    var eind = new DataView(new ArrayBuffer(22));
    eind.setUint32(0, 0x06054b50, true); eind.setUint16(4, 0, true); eind.setUint16(6, 0, true);
    eind.setUint16(8, bestanden.length, true); eind.setUint16(10, bestanden.length, true);
    eind.setUint32(12, grootte, true); eind.setUint32(16, offset, true); eind.setUint16(20, 0, true);
    return new Blob(delen.concat(centraal, [new Uint8Array(eind.buffer)]), { type: 'application/zip' });
  }

  function bewaarBestand(naam, data) {
    return cap('downloads').then(function (dl) {
      if (dl) {
        return dl.save({ filename: naam, data: data }).then(function () {
          melding('Opgeslagen: ' + naam);
        }).catch(function (e) {
          var code = e && e.code;
          if (code === 'declined') return;
          melding(code === 'too_large' ? 'Het bestand is te groot om op te slaan.' : code === 'rate_limited' ? 'Er staat al een opslagvraag open. Probeer het zo opnieuw.' : 'Opslaan lukte niet in dit venster.');
        });
      }
      /* Buiten Claude: gewoon een downloadlink. */
      var blob = data instanceof Blob ? data : new Blob([data], { type: 'application/octet-stream' });
      var url = URL.createObjectURL(blob);
      var a = h('a', { href: url, download: naam });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    });
  }

  function controleer(c) {
    var lijst = [];
    c.lessons.forEach(function (l, li) {
      l.blocks.forEach(function (b) {
        var type = TYPES[b.t];
        var w = type && type.waarschuwing ? type.waarschuwing(b) : '';
        if (w) lijst.push('Module ' + (li + 1) + ', ' + type.naam.toLowerCase() + ': ' + w.toLowerCase());
      });
    });
    return lijst;
  }

  function exporteer(soort) {
    var c = spelerCursus();
    delete c.voorbeeld;
    var naam = slug(c.title);
    if (soort === 'html') return bewaarBestand(naam + '.html', exportDocument(c, false));
    if (soort === 'json') return bewaarBestand(naam + '.json', JSON.stringify(c, null, 2));
    if (soort === 'scorm') {
      var zip = maakZip([{ naam: 'imsmanifest.xml', data: scormManifest(c) }, { naam: 'index.html', data: exportDocument(c, true) }]);
      return bewaarBestand(naam + '-scorm.zip', zip);
    }
  }

  function dialoog(inhoud, opSluit) {
    var achter = h('div', { class: 'dialoog-achter' });
    var d = h('div', { class: 'dialoog', role: 'dialog', 'aria-modal': 'true' });
    function sluit() { achter.remove(); document.removeEventListener('keydown', opToets); if (opSluit) opSluit(); }
    function opToets(e) { if (e.key === 'Escape') sluit(); }
    achter.addEventListener('mousedown', function (e) { if (e.target === achter) sluit(); });
    document.addEventListener('keydown', opToets);
    voegToe(d, inhoud(sluit));
    achter.append(d);
    document.body.append(achter);
    var eersteVeld = d.querySelector('textarea, input, select, button');
    if (eersteVeld) eersteVeld.focus();
    return sluit;
  }

  function dialoogExport() {
    var c = S.cursus;
    var problemen = controleer(c);
    var extern = c.lessons.some(function (l) { return l.blocks.some(function (b) { return (b.t === 'video' && (b.youtube || b.vimeo)) || b.t === 'embed'; }); });
    dialoog(function (sluit) {
      function knop(soort, titel, uitleg) {
        return h('button', { type: 'button', onclick: function () { sluit(); exporteer(soort); } }, h('strong', null, titel), h('small', null, uitleg));
      }
      return [
        h('h2', null, 'Exporteren'),
        h('p', null, 'Kies hoe je ' + (c.title || 'de e-learning') + ' wilt gebruiken.'),
        problemen.length ? h('div', { class: 'fout' }, h('strong', null, 'Nog niet alles is af:'), h('ul', { style: 'margin:6px 0 0;padding-left:18px' }, problemen.slice(0, 6).map(function (p) { return h('li', null, p); })), problemen.length > 6 ? h('div', null, 'en nog ' + (problemen.length - 6) + ' andere.') : null) : null,
        h('div', { class: 'keuzelijst' },
          knop('html', 'Webpagina (.html)', 'Eén bestand met alles erin. Zet het op GitHub Pages of je eigen site, of open het direct in de browser. De voortgang blijft in de browser van de student.'),
          knop('scorm', 'SCORM-pakket (.zip)', 'Voor Brightspace, Canvas, Moodle en andere leeromgevingen (SCORM 1.2). Het LMS houdt de voortgang, voltooiing en score bij.'),
          knop('json', 'Bouwbestand (.json)', 'Om later verder te bouwen of te delen met een collega. Open het via Openen.')),
        extern ? h('p', { style: 'font-size:12.5px' }, 'Video\'s en ingesloten sites spelen af in de export, met een internetverbinding.') : null,
        h('div', { class: 'voet' }, h('button', { type: 'button', class: 'knop', onclick: sluit }, 'Sluiten'))
      ];
    });
  }

  /* ================================================================ openen */

  /* Met een handvat (geopend via de bestandskiezer van de browser) slaat Opslaan
     daarna terug op in hetzelfde bouwbestand. */
  function openBestand(file, handvat) {
    file.text().then(function (tekst) {
      var data;
      if (/^\s*</.test(tekst)) {
        var m = tekst.match(/<script type="application\/json" id="cursus-data">([\s\S]*?)<\/script>/);
        if (!m) throw new Error('In dit HTML-bestand staat geen e-learning uit de bouwer.');
        data = JSON.parse(m[1]);
      } else {
        data = JSON.parse(tekst);
      }
      if (!data || !Array.isArray(data.lessons)) throw new Error('Dit bestand bevat geen e-learning.');
      var c = normaliseerCursus(data, { nieuwId: true });
      c.updatedAt = Date.now();
      var bouwbestand = !/^\s*</.test(tekst);
      return bewaarEerst().then(function () {
        wissel(c);
        if (handvat && bouwbestand) Bestand.koppel(handvat, c);
        S.vuil['*'] = 1;
        bewaarNu();
        var kapot = controleer(c).filter(function (p) { return /afbeelding niet gevonden/.test(p); }).length;
        melding(kapot ? 'Geopend. ' + kapot + ' afbeelding(en) moet je opnieuw kiezen.' : 'Geopend: ' + c.title);
      });
    }).catch(function (e) {
      melding(e && e.message && e.message.length < 120 ? e.message : 'Dit bestand kon niet worden geopend.');
    });
  }

  /* ================================================================ Claude */

  var SCHEMA = [
    'Bloktypen (JSON-objecten met precies deze velden):',
    '- {"t":"text","heading":"korte kop of leeg","body":"<p>alinea</p><p>alinea</p>"}',
    '- {"t":"list","ordered":false,"items":["punt","punt"]}',
    '- {"t":"quote","body":"één zin die blijft hangen"}',
    '- {"t":"tabs","items":[{"title":"tab","body":"<p>…</p>"}]}  (2 tot 5 tabs)',
    '- {"t":"accordion","items":[{"title":"onderdeel","body":"<p>…</p>"}]}',
    '- {"t":"cards","items":[{"front":"begrip","back":"uitleg in één of twee zinnen"}]}',
    '- {"t":"timeline","items":[{"date":"jaartal of fase","title":"titel","body":"<p>…</p>"}]}',
    '- {"t":"steps","intro":{"title":"","body":""},"steps":[{"title":"stap","body":"toelichting"}],"summary":{"title":"","body":""}}',
    '- {"t":"quiz","multi":false,"question":"vraag","options":[{"text":"antwoord","correct":true,"feedback":"waarom dit wel of niet klopt"}],"feedback":"uitleg na een goed antwoord","feedbackWrong":"uitleg na een fout antwoord"}  (3 tot 5 opties; multi true als er meer goede antwoorden zijn)',
    '- {"t":"match","question":"opdracht","pairs":[{"left":"begrip","right":"omschrijving"}],"feedback":"uitleg"}  (3 tot 6 paren)',
    '- {"t":"sort","question":"opdracht","piles":["categorie A","categorie B"],"items":[{"text":"onderdeel","pile":0}]}  (pile is de index in piles)',
    '- {"t":"continue"}  (doorgaan-knop: de student klikt door naar het volgende stuk; vragen erboven moeten eerst beantwoord zijn)'
  ].join('\n');

  var REGELS = [
    'Schrijf in helder Nederlands en spreek de student aan met "je".',
    'HTML alleen met <p>, <strong>, <em>, <ul>, <ol>, <li> en <h3>.',
    'Gebruik geen afbeeldingen, video\'s of links: die kan de docent zelf toevoegen.',
    'Verzin geen bronnen, cijfers of citaten. Is er een brontekst, blijf daar dan inhoudelijk bij.',
    'Elke kennisvraag heeft minstens één juist antwoord, aannemelijke foute antwoorden en uitleg per antwoord.'
  ].join('\n');

  function claudeFout(e) {
    var code = e && e.code;
    if (code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared' || code === 'capability_disabled' || code === 'capability_removed') {
      S.sample = null;
      renderStructuur();
      renderEditor();
      return 'Claude is niet beschikbaar in deze bouwer.';
    }
    if (code === 'rate_limited') return 'Even te veel verzoeken. Probeer het over een minuut opnieuw.';
    if (code === 'prompt_too_large') return 'De tekst is te lang. Plak een kortere tekst of een samenvatting.';
    if (code === 'invalid_json') return 'Claude gaf geen bruikbaar antwoord. Probeer het opnieuw, eventueel met een kortere tekst.';
    if (code === 'refused') return 'Claude wilde dit niet maken. Pas de tekst aan en probeer het opnieuw.';
    if (code === 'session_expired') return 'Log opnieuw in bij Claude en probeer het nog eens.';
    return 'Er ging iets mis. Probeer het opnieuw.';
  }

  function vraagClaude(prompt, voortgang, ctl) {
    var tekens = 0;
    voortgang.textContent = 'Claude denkt na… Dit duurt meestal een halve tot anderhalve minuut.';
    return S.sample.json(prompt, {
      signal: ctl.signal,
      onText: function (u) {
        tekens = u.text.length;
        voortgang.textContent = 'Claude schrijft… ' + tekens.toLocaleString('nl-NL') + ' tekens';
      }
    });
  }

  function claudeDialoog(cfg) {
    var ctl = null;
    dialoog(function (sluit) {
      var voortgang = h('div', { class: 'voortgang', hidden: true });
      var fout = h('div', { class: 'fout', hidden: true });
      var gaKnop = h('button', { type: 'button', class: 'knop primair' }, ico('ster'), cfg.knop);
      var stop = h('button', { type: 'button', class: 'knop', hidden: true, onclick: function () { if (ctl) ctl.abort(); } }, 'Stoppen');
      var velden = cfg.velden();
      gaKnop.addEventListener('click', function () {
        var prompt = cfg.prompt();
        if (!prompt) return;
        ctl = new AbortController();
        fout.hidden = true;
        voortgang.hidden = false;
        gaKnop.disabled = true;
        stop.hidden = false;
        vraagClaude(prompt, voortgang, ctl).then(function (data) {
          var aantal = cfg.verwerk(data);
          if (!aantal) throw { code: 'invalid_json' };
          sluit();
        }).catch(function (e) {
          voortgang.hidden = true;
          if (e && e.code === 'cancelled') return;
          fout.textContent = claudeFout(e);
          fout.hidden = false;
        }).then(function () { gaKnop.disabled = false; stop.hidden = true; ctl = null; });
      });
      return [h('h2', null, cfg.titel), h('p', null, cfg.uitleg), velden, voortgang, fout,
        h('div', { class: 'voet' }, h('button', { type: 'button', class: 'knop', onclick: function () { if (ctl) ctl.abort(); sluit(); } }, 'Annuleren'), stop, gaKnop)];
    }, function () { if (ctl) ctl.abort(); });
  }

  function vinkjes(opties) {
    return h('div', { class: 'knoprij', style: 'gap:14px' }, opties.map(function (o) {
      var id = veldId();
      return h('label', { class: 'schakel', for: id }, h('input', { type: 'checkbox', id: id, value: o[0], checked: o[2] !== false }), o[1]);
    }));
  }
  function gekozenVinkjes(el) { return Array.prototype.slice.call(el.querySelectorAll('input:checked')).map(function (i) { return i.value; }); }

  function blokkenUit(data) {
    var lijst = Array.isArray(data) ? data : (data && Array.isArray(data.blocks) ? data.blocks : []);
    return lijst.map(normaliseerBlok).filter(Boolean);
  }

  function dialoogModule() {
    var onderwerp, niveau, omvang, soorten;
    claudeDialoog({
      titel: 'Module met Claude',
      uitleg: 'Beschrijf het onderwerp en je leerdoelen, of plak een brontekst. Claude zet een complete module op in dit format. Daarna pas je alles zelf aan.',
      knop: 'Module maken',
      velden: function () {
        onderwerp = h('textarea', { id: 'cl-onderwerp', rows: 8, placeholder: 'Bijvoorbeeld: De R-ladder voor tweedejaars bedrijfskunde. Leerdoel: studenten kunnen per R-strategie een voorbeeld geven en uitleggen waarom hogere strategieën meer waarde behouden.' });
        niveau = h('select', { id: 'cl-niveau' }, ['mbo', 'hbo, propedeuse', 'hbo, hoofdfase', 'wo of master'].map(function (n) { return h('option', null, n); }));
        niveau.value = 'hbo, hoofdfase';
        omvang = h('select', { id: 'cl-omvang' }, [['kort', 'Kort (3 tot 4 stappen)'], ['gemiddeld', 'Gemiddeld (5 tot 7 stappen)'], ['uitgebreid', 'Uitgebreid (8 tot 10 stappen)']].map(function (o) { return h('option', { value: o[0] }, o[1]); }));
        omvang.value = 'gemiddeld';
        soorten = vinkjes([['interactief', 'Tabbladen, uitklapblokken, kaartjes en tijdlijnen'], ['quiz', 'Meerkeuzevragen'], ['match', 'Koppelvragen'], ['sort', 'Sorteeropdrachten']]);
        return [
          h('div', { class: 'veld' }, h('label', { for: 'cl-onderwerp' }, 'Onderwerp, leerdoelen of brontekst'), onderwerp),
          h('div', { class: 'twee' }, h('div', { class: 'veld' }, h('label', { for: 'cl-niveau' }, 'Niveau'), niveau), h('div', { class: 'veld' }, h('label', { for: 'cl-omvang' }, 'Omvang'), omvang)),
          h('div', { class: 'veld' }, h('span', { class: 'veldlabel' }, 'Gebruik'), soorten)
        ];
      },
      prompt: function () {
        var tekst = onderwerp.value.trim();
        if (tekst.length < 10) { onderwerp.focus(); return null; }
        var wensen = gekozenVinkjes(soorten);
        return 'Je schrijft één module voor een e-learning. Niveau: ' + niveau.value + '. Omvang: ' + omvang.value + '.\n\n'
          + 'Onderwerp, leerdoelen of brontekst van de docent:\n"""\n' + tekst.slice(0, 60000) + '\n"""\n\n'
          + SCHEMA + '\n\n'
          + 'Opbouw: begin met een korte inleiding (text) en de leerdoelen (list). Wissel uitleg af met '
          + (wensen.indexOf('interactief') >= 0 ? 'interactieve blokken (tabs, accordion, cards, timeline of steps waar dat past)' : 'gewone tekstblokken')
          + '. Zet na elke 2 tot 4 blokken een {"t":"continue"}. Zet na elk inhoudelijk stuk één of twee kennisvragen en sluit af met een korte samenvatting.\n'
          + 'Toegestane vraagvormen: ' + (['quiz', 'match', 'sort'].filter(function (s) { return wensen.indexOf(s) >= 0; }).join(', ') || 'quiz') + '.\n\n'
          + REGELS + '\n\n'
          + 'Antwoord met alleen JSON: {"title":"titel van de module","blocks":[...]}';
      },
      verwerk: function (data) {
        var blokken = blokkenUit(data);
        if (!blokken.length) return 0;
        var l = { id: nieuwId('m'), title: String((data && data.title) || 'Nieuwe module'), deadline: '', blocks: blokken };
        S.cursus.lessons.push(l);
        gewijzigd(l.id);
        kiesModule(l.id);
        melding('Module toegevoegd. Lees hem goed na voordat je hem gebruikt.');
        return blokken.length;
      }
    });
  }

  function dialoogVragen() {
    var l = les();
    var aantal, soorten;
    var stof = l.blocks.map(function (b) {
      if (b.t === 'text') return (b.heading ? b.heading + '\n' : '') + naarTekst(b.body);
      if (b.t === 'list') return b.items.map(function (i) { return '- ' + naarTekst(i); }).join('\n');
      if (b.t === 'tabs' || b.t === 'accordion') return b.items.map(function (i) { return i.title + ': ' + naarTekst(i.body); }).join('\n');
      if (b.t === 'cards') return b.items.map(function (i) { return naarTekst(i.front) + ': ' + naarTekst(i.back); }).join('\n');
      if (b.t === 'timeline') return b.items.map(function (i) { return i.date + ' ' + i.title + ': ' + naarTekst(i.body); }).join('\n');
      if (b.t === 'steps') return b.steps.map(function (s) { return s.title + ': ' + s.body; }).join('\n');
      if (b.t === 'quote') return naarTekst(b.body);
      return '';
    }).filter(Boolean).join('\n\n');
    if (stof.length < 80) { melding('Schrijf eerst wat inhoud in deze module; Claude baseert de vragen daarop.'); return; }
    claudeDialoog({
      titel: 'Kennisvragen met Claude',
      uitleg: 'Claude maakt vragen bij de tekst van "' + (l.title || 'deze module') + '" en zet ze onderaan, na een doorgaan-knop.',
      knop: 'Vragen maken',
      velden: function () {
        aantal = h('select', { id: 'cl-aantal' }, [3, 5, 8].map(function (n) { return h('option', { value: String(n) }, n + ' vragen'); }));
        aantal.value = '5';
        soorten = vinkjes([['quiz', 'Meerkeuzevragen'], ['match', 'Koppelvragen'], ['sort', 'Sorteeropdrachten', false]]);
        return [h('div', { class: 'veld' }, h('label', { for: 'cl-aantal' }, 'Aantal'), aantal), h('div', { class: 'veld' }, h('span', { class: 'veldlabel' }, 'Vraagvormen'), soorten)];
      },
      prompt: function () {
        var vormen = gekozenVinkjes(soorten);
        if (!vormen.length) vormen = ['quiz'];
        return 'Maak ' + aantal.value + ' kennisvragen bij deze lesstof voor een e-learning. Toets begrip en toepassing, niet alleen feiten.\n\n'
          + 'Lesstof:\n"""\n' + stof.slice(0, 60000) + '\n"""\n\n'
          + SCHEMA + '\n\nGebruik alleen deze vraagvormen: ' + vormen.join(', ') + '.\n\n' + REGELS + '\n\n'
          + 'Antwoord met alleen JSON: {"blocks":[...]} met alleen vraagblokken.';
      },
      verwerk: function (data) {
        var blokken = blokkenUit(data).filter(function (b) { return b.t === 'quiz' || b.t === 'match' || b.t === 'sort'; });
        if (!blokken.length) return 0;
        var laatste = l.blocks[l.blocks.length - 1];
        if (laatste && laatste.t !== 'continue') l.blocks.push(maakBlok('continue'));
        l.blocks.push(maakBlok('text'));
        l.blocks[l.blocks.length - 1].heading = 'Kennisvragen';
        Array.prototype.push.apply(l.blocks, blokken);
        S.gekozenK = blokken[0]._k;
        gewijzigd(l.id);
        renderEditor();
        renderStructuur();
        var k = kaarten[blokken[0]._k];
        if (k) k.kaart.scrollIntoView({ block: 'start' });
        melding(blokken.length + ' vragen toegevoegd. Controleer de antwoorden voordat je ze gebruikt.');
        return blokken.length;
      }
    });
  }

  /* ================================================================ indeling */

  /* Structuur links en voorbeeld rechts klap je in tot een smalle strook of
     sleep je breder, zodat het midden ruim wordt. De browser onthoudt het. */
  var Panelen = (function () {
    var RAIL = 44, MIN_LINKS = 220, MAX_LINKS = 440, MIN_RECHTS = 320, MIN_MIDDEN = 420, DICHT_ONDER = 150;
    var P = { links: 280, rechts: 0, linksOpen: true, rechtsOpen: true };
    var voorFocus = null;
    try { var bewaard = JSON.parse(ls('bouwer:indeling') || 'null'); if (bewaard) Object.keys(P).forEach(function (k) { if (typeof bewaard[k] === typeof P[k]) P[k] = bewaard[k]; }); } catch (e) { /* standaard */ }

    function breed() { return window.matchMedia('(min-width: 1181px)').matches; }
    function werkBreedte() { return $('#werk').clientWidth || window.innerWidth; }
    function maxRechts() { return Math.max(MIN_RECHTS, werkBreedte() - (P.linksOpen ? P.links : RAIL) - MIN_MIDDEN); }
    function klem(x, lo, hi) { return Math.min(Math.max(x, lo), hi); }
    function inFocus() { return !P.linksOpen && (!P.rechtsOpen || !breed()); }

    function toon() {
      var werk = $('#werk');
      var rechts = klem(P.rechts || Math.max(380, Math.round(werkBreedte() * 0.4)), MIN_RECHTS, maxRechts());
      werk.style.setProperty('--baan-l', (P.linksOpen ? klem(P.links, MIN_LINKS, MAX_LINKS) : RAIL) + 'px');
      werk.style.setProperty('--baan-r', (P.rechtsOpen ? rechts : RAIL) + 'px');
      werk.setAttribute('data-links', P.linksOpen ? 'open' : 'dicht');
      werk.setAttribute('data-rechts', P.rechtsOpen ? 'open' : 'dicht');
      $('#paneel-links').setAttribute('aria-pressed', String(P.linksOpen));
      $('#paneel-rechts').setAttribute('aria-pressed', String(P.rechtsOpen));
      $('#paneel-focus').setAttribute('aria-pressed', String(inFocus()));
    }
    function bewaar() {
      try { ls('bouwer:indeling', JSON.stringify(P)); } catch (e) { /* alleen voor deze sessie */ }
    }
    function zet(kant, open) {
      if (kant === 'links') P.linksOpen = open; else P.rechtsOpen = open;
      voorFocus = null;
      toon();
      bewaar();
    }
    function wissel(kant) { zet(kant, !(kant === 'links' ? P.linksOpen : P.rechtsOpen)); }
    function focus() {
      if (inFocus()) {
        var v = voorFocus || { l: true, r: true };
        P.linksOpen = v.l; P.rechtsOpen = v.r;
        voorFocus = null;
      } else {
        voorFocus = { l: P.linksOpen, r: P.rechtsOpen };
        P.linksOpen = false;
        if (breed()) P.rechtsOpen = false;
      }
      toon();
      bewaar();
    }

    /* Slepen aan de rand; smaller dan DICHT_ONDER klapt de baan in. */
    function sleepbaar(greep, kant) {
      greep.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
        greep.setPointerCapture(e.pointerId);
        var werk = $('#werk');
        var rand = werk.getBoundingClientRect();
        /* Dichtgesleept gaat de baan later weer open op de breedte van voor het slepen. */
        var begin = kant === 'links' ? P.links : P.rechts;
        werk.classList.add('slepen');
        function beweeg(ev) {
          var b = kant === 'links' ? ev.clientX - rand.left : rand.right - ev.clientX;
          var open = b >= DICHT_ONDER;
          if (kant === 'links') { P.linksOpen = open; P.links = open ? klem(b, MIN_LINKS, MAX_LINKS) : begin; }
          else { P.rechtsOpen = open; P.rechts = open ? klem(b, MIN_RECHTS, maxRechts()) : begin; }
          voorFocus = null;
          toon();
        }
        function los() {
          greep.removeEventListener('pointermove', beweeg);
          greep.removeEventListener('pointerup', los);
          greep.removeEventListener('pointercancel', los);
          werk.classList.remove('slepen');
          bewaar();
        }
        greep.addEventListener('pointermove', beweeg);
        greep.addEventListener('pointerup', los);
        greep.addEventListener('pointercancel', los);
      });
      greep.addEventListener('dblclick', function () {
        if (kant === 'links') { P.links = 280; P.linksOpen = true; } else { P.rechts = 0; P.rechtsOpen = true; }
        toon();
        bewaar();
      });
      greep.addEventListener('keydown', function (e) {
        var stap = e.shiftKey ? 80 : 24;
        var groter = kant === 'links' ? 'ArrowRight' : 'ArrowLeft';
        var kleiner = kant === 'links' ? 'ArrowLeft' : 'ArrowRight';
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); wissel(kant); return; }
        if (e.key !== groter && e.key !== kleiner) return;
        e.preventDefault();
        var d = e.key === groter ? stap : -stap;
        if (kant === 'links') { P.linksOpen = true; P.links = klem(P.links + d, MIN_LINKS, MAX_LINKS); }
        else { P.rechtsOpen = true; P.rechts = klem((P.rechts || Math.round(werkBreedte() * 0.4)) + d, MIN_RECHTS, maxRechts()); }
        toon();
        bewaar();
      });
    }

    function start() {
      $('#paneel-links').addEventListener('click', function () { wissel('links'); });
      $('#paneel-rechts').addEventListener('click', function () { wissel('rechts'); });
      $('#paneel-focus').addEventListener('click', focus);
      sleepbaar($('#sleep-links'), 'links');
      sleepbaar($('#sleep-rechts'), 'rechts');
      $('#rail-rechts').append(
        icoonknop('paneelR', 'Voorbeeld uitklappen (Alt+2)', function () { zet('rechts', true); }),
        h('button', { type: 'button', class: 'rail-label', title: 'Voorbeeld uitklappen (Alt+2)', onclick: function () { zet('rechts', true); } }, 'Voorbeeld'));
      var wacht = 0;
      window.addEventListener('resize', function () { cancelAnimationFrame(wacht); wacht = requestAnimationFrame(toon); });
      toon();
    }

    return { start: start, zet: zet, wissel: wissel, focus: focus, breed: breed };
  })();

  /* ================================================================ bestand op je computer */

  /* Opslaan maakt de eerste keer een bouwbestand op je computer en werkt dat
     daarna bij. Zolang er wijzigingen zijn, komt er elke 15 minuten vanzelf een
     back-up in. Browsers zonder bestandstoegang (Firefox, Safari, het artifact)
     downloaden een kopie en krijgen een herinnering in plaats van een back-up. */
  var Bestand = (function () {
    var KWARTIER = 15 * 60 * 1000;
    var B = { handvat: null, cursusId: null, laatst: 0, versie: 0, sinds: Date.now(), herinnerd: 0 };
    var kan = typeof window.showSaveFilePicker === 'function' && (function () { try { return window.top === window.self; } catch (e) { return false; } })();

    /* Handvatten blijven in IndexedDB bewaard, zodat een herladen pagina het bestand nog kent. */
    var dbBelofte = null;
    function idb(modus, fn) {
      if (!dbBelofte) dbBelofte = new Promise(function (ok, nee) {
        var r = indexedDB.open('elearning-bouwer', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('bestanden'); };
        r.onsuccess = function () { ok(r.result); };
        r.onerror = function () { nee(r.error); };
      });
      return dbBelofte.then(function (db) {
        return new Promise(function (ok, nee) {
          var tx = db.transaction('bestanden', modus);
          var req = fn(tx.objectStore('bestanden'));
          tx.oncomplete = function () { ok(req.result); };
          tx.onerror = function () { nee(tx.error); };
        });
      });
    }
    function idbLees(id) { try { return idb('readonly', function (s) { return s.get(id); }).catch(function () { return null; }); } catch (e) { return Promise.resolve(null); } }
    function idbZet(id, h) { try { return idb('readwrite', function (s) { return s.put(h, id); }).catch(function () {}); } catch (e) { return Promise.resolve(); } }

    function meta(id, waarde) {
      if (arguments.length === 1) { try { return JSON.parse(ls('bouwer:bestand:' + id) || 'null'); } catch (e) { return null; } }
      try { ls('bouwer:bestand:' + id, JSON.stringify(waarde)); } catch (e) { /* niet erg */ }
    }

    function gekoppeld() { return !!(B.handvat && S.cursus && B.cursusId === S.cursus.id); }

    function wisselCursus(c) {
      B.handvat = null; B.cursusId = null; B.laatst = 0; B.versie = 0; B.herinnerd = 0;
      B.sinds = Date.now();
      if (!kan || c.voorbeeld) return;
      var id = c.id;
      idbLees(id).then(function (h) {
        if (!h || !S.cursus || S.cursus.id !== id || B.handvat) return;
        var m = meta(id) || {};
        B.handvat = h; B.cursusId = id; B.laatst = m.laatst || 0; B.versie = m.versie || 0;
        statusNa();
      });
    }

    function koppel(h, c) {
      B.handvat = h; B.cursusId = c.id; B.laatst = Date.now(); B.versie = c.updatedAt || 0;
      idbZet(c.id, h);
      meta(c.id, { laatst: B.laatst, versie: B.versie });
    }

    function toestemming(h, vragen) {
      if (!h.queryPermission) return Promise.resolve(h);
      var o = { mode: 'readwrite' };
      return h.queryPermission(o).then(function (s) {
        if (s === 'granted') return h;
        if (!vragen) return null;
        return h.requestPermission(o).then(function (s2) { return s2 === 'granted' ? h : null; });
      }).catch(function () { return null; });
    }

    function inhoud() {
      var c = spelerCursus();
      delete c.voorbeeld;
      return JSON.stringify(c, null, 2);
    }

    function schrijf(h) {
      var versie = S.cursus.updatedAt || 0;
      var tekst = inhoud();
      return h.createWritable().then(function (w) {
        return w.write(tekst).then(function () { return w.close(); });
      }).then(function () {
        B.laatst = Date.now(); B.versie = versie;
        meta(S.cursus.id, { laatst: B.laatst, versie: B.versie });
        statusNa();
      });
    }

    function statusNa() {
      if (!bezigMetBewaren && !Object.keys(S.vuil).length) statusOpgeslagen();
      /* Niet hertekenen terwijl iemand in de structuur typt. */
      if (!$('#structuur').contains(document.activeElement)) renderStructuur();
    }

    function download() {
      var versie = S.cursus.updatedAt || 0;
      return exporteer('json').then(function () {
        B.laatst = Date.now(); B.versie = versie; B.herinnerd = Date.now();
        statusNa();
      });
    }

    /* Op een klik of Ctrl+S. kiesNieuw: altijd een (ander) bestand laten kiezen. */
    function opslaan(kiesNieuw) {
      var c = S.cursus;
      if (c.voorbeeld) gewijzigd('*');
      c = S.cursus;
      if (!kan) return download();
      var bestaand = !kiesNieuw && gekoppeld() ? toestemming(B.handvat, true) : Promise.resolve(null);
      var nieuwGekozen = false;
      return bestaand.then(function (h) {
        if (h) return h;
        return window.showSaveFilePicker({
          suggestedName: slug(c.title) + '.json',
          types: [{ description: 'Bouwbestand e-learning', accept: { 'application/json': ['.json'] } }]
        }).then(function (nieuw) { koppel(nieuw, c); nieuwGekozen = true; return nieuw; });
      }).then(function (h) {
        return schrijf(h).then(function () {
          melding(nieuwGekozen ? 'Opgeslagen in ' + h.name + '. Zolang je wijzigt, komt daar elke 15 minuten automatisch een back-up in.' : 'Opgeslagen in ' + h.name + '.');
        });
      }).catch(function (e) {
        if (e && e.name === 'AbortError') return;
        if (e && e.name === 'SecurityError') { kan = false; return download(); }
        melding('Opslaan in een bestand lukte niet. Er wordt een kopie gedownload.');
        return download();
      });
    }

    /* Elke minuut kijken of er een kwartier voorbij is sinds het bestand is bijgewerkt. */
    function tik() {
      var c = S.cursus;
      if (!c || c.voorbeeld || (c.updatedAt || 0) <= B.versie) return;
      var nu = Date.now();
      if (nu - Math.max(B.laatst, B.sinds, B.herinnerd) < KWARTIER) return;
      if (gekoppeld()) {
        toestemming(B.handvat, false).then(function (h) {
          if (h) return schrijf(h).catch(herinner);
          herinner();
        });
      } else if (Opslag.modus === 'browser') herinner();
    }
    function herinner() {
      B.herinnerd = Date.now();
      melding(gekoppeld() ? 'De back-up naar ' + B.handvat.name + ' wacht op je toestemming.' : 'Je werk staat alleen in deze browser. Maak een back-up op je computer.', { tekst: 'Opslaan', doe: function () { opslaan(); } });
    }
    setInterval(tik, 60 * 1000);

    return {
      kan: function () { return kan; },
      gekoppeld: gekoppeld,
      naam: function () { return B.handvat ? B.handvat.name : ''; },
      laatst: function () { return B.laatst; },
      wissel: wisselCursus,
      koppel: koppel,
      opslaan: opslaan
    };
  })();

  /* Uitleg bij een klik op de status: waar staat mijn werk? */
  function dialoogBewaren() {
    dialoog(function (sluit) {
      return [
        h('h2', null, 'Waar staat je werk?'),
        h('p', null, opslagUitleg()),
        Opslag.modus === 'browser' ? h('p', null, 'Een bouwbestand kun je altijd weer openen met Openen, ook in een andere browser of op een andere computer.') : null,
        h('div', { class: 'voet' },
          h('button', { type: 'button', class: 'knop', onclick: sluit }, 'Sluiten'),
          Bestand.gekoppeld() && Bestand.kan() ? h('button', { type: 'button', class: 'knop', onclick: function () { sluit(); Bestand.opslaan(true); } }, 'Ander bestand kiezen') : null,
          h('button', { type: 'button', class: 'knop primair', onclick: function () { sluit(); Bestand.opslaan(); } }, ico('schijf'), Bestand.gekoppeld() ? 'Nu opslaan' : 'Opslaan als bestand'))
      ];
    });
  }

  /* ================================================================ alles samen */

  function zetTab(tab) {
    $('#werk').setAttribute('data-tab', tab);
    Array.prototype.forEach.call(document.querySelectorAll('#tabs-smal button'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-tab') === tab ? 'true' : 'false'); });
    if (tab === 'voorbeeld') tekenVoorbeeld();
  }

  function renderAlles() {
    renderKeuze();
    renderStructuur();
    renderEditor();
    tekenVoorbeeld();
  }

  function koppel() {
    $('#cursus-keuze').addEventListener('change', function (e) {
      var w = e.target.value;
      if (w === '__nieuw') nieuweCursus();
      else if (w === '__voorbeeld') bewaarEerst().then(function () { wissel(voorbeeldCursus()); });
      else if (w !== S.cursus.id) openCursus(w);
    });
    $('#knop-export').addEventListener('click', dialoogExport);
    $('#knop-opslaan').addEventListener('click', function () { Bestand.opslaan(); });
    $('#status').addEventListener('click', dialoogBewaren);
    $('#knop-openen').addEventListener('click', function () {
      /* Via de bestandskiezer van de browser onthouden we het bestand, zodat Opslaan erin terugschrijft. */
      if (!Bestand.kan() || typeof window.showOpenFilePicker !== 'function') { $('#bestand-openen').click(); return; }
      window.showOpenFilePicker({ types: [{ description: 'Bouwbestand of geëxporteerde e-learning', accept: { 'application/json': ['.json'], 'text/html': ['.html', '.htm'] } }] }).then(function (lijst) {
        var h = lijst[0];
        return h.getFile().then(function (f) { openBestand(f, /\.json$/i.test(h.name) ? h : null); });
      }).catch(function (e) { if (!e || e.name !== 'AbortError') $('#bestand-openen').click(); });
    });
    Panelen.start();
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        Bestand.opslaan();
        return;
      }
      if (!e.altKey || e.ctrlKey || e.metaKey || document.querySelector('.dialoog-achter')) return;
      if (e.code === 'Digit1') { e.preventDefault(); Panelen.wissel('links'); }
      else if (e.code === 'Digit2') {
        e.preventDefault();
        if (Panelen.breed()) Panelen.wissel('rechts');
        else zetTab($('#werk').getAttribute('data-tab') === 'voorbeeld' ? 'bewerken' : 'voorbeeld');
      }
      else if (e.code === 'Digit0') { e.preventDefault(); Panelen.focus(); }
    });
    $('#bestand-openen').addEventListener('change', function (e) {
      var f = e.target.files[0];
      e.target.value = '';
      if (f) openBestand(f);
    });
    Array.prototype.forEach.call(document.querySelectorAll('#tabs-smal button'), function (b) {
      b.addEventListener('click', function () { zetTab(b.getAttribute('data-tab')); });
    });
    function paar(a, b, sleutel, waarde) {
      $(a).addEventListener('click', function () { S.vb[sleutel] = waarde; $(a).setAttribute('aria-pressed', 'true'); $(b).setAttribute('aria-pressed', 'false'); naVoorbeeldKeuze(sleutel); });
    }
    function naVoorbeeldKeuze(sleutel) {
      if (sleutel === 'telefoon') $('#voorbeeld').classList.toggle('telefoon', S.vb.telefoon);
      tekenVoorbeeld();
    }
    paar('#vb-alles', '#vb-student', 'alles', true);
    paar('#vb-student', '#vb-alles', 'alles', false);
    paar('#vb-breed', '#vb-telefoon', 'telefoon', false);
    paar('#vb-telefoon', '#vb-breed', 'telefoon', true);
    $('#vb-wis').addEventListener('click', function () { if (vbSpeler) vbSpeler.wisVoortgang(); tekenVoorbeeld(); melding('Antwoorden in het voorbeeld gewist.'); });
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { /* oudere browser */ }
    window.addEventListener('pagehide', function () { if (Object.keys(S.vuil).length) bewaarNu(); });
  }

  /* Opstarten: eerst het voorbeeld tonen, dan opslag en Claude erbij. */
  S.cursus = voorbeeldCursus();
  S.lesId = S.cursus.lessons[0].id;
  initVoorbeeld();
  koppel();
  renderAlles();
  zetStatus('Voorbeeld: wijzigingen maken een eigen kopie', '');

  cap('sample').then(function (s) { S.sample = s; if (s) { renderStructuur(); renderEditor(); } });

  Opslag.start().then(function () { return Opslag.lijst(); }).then(function (lijst) {
    S.lijst = lijst;
    var laatste = ls('bouwer:laatste');
    var doel = lijst.find(function (x) { return x.id === laatste; }) || lijst[0];
    renderStructuur();
    if (doel && S.cursus.voorbeeld && !Object.keys(S.vuil).length) return openCursus(doel.id);
    renderKeuze();
  });
})();
