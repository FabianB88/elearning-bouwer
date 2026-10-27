# E-learning Bouwer

Een bouwer voor e-learnings in het format van de [e-learnings van de minor Circulaire Economie](https://github.com/FabianB88/minor-ce-elearnings), zoals *Business Ethics* en *Duurzame waarde*. Je klikt blokken aan en vult ze in, en ziet ze live in dezelfde speler die studenten gebruiken.

- **Claude-artifact** (met opslag in je account en Claude-hulp): https://claude.ai/artifact/RnohLRy2qXGiJBwsbL1ZMK. Het artifact is privé; vraag de eigenaar om toegang als Bijdrager.
- **Online, zonder account:** https://fabianb88.github.io/elearning-bouwer/. Alles werkt, behalve de Claude-hulp. Je werk staat dan alleen in je browser: maak met **Opslaan** een bestand op je computer.
- **Los bestand:** open `index.html` in een browser; dat werkt hetzelfde als de online versie.

## Wat de bouwer kan

- **Cursus en modules:** titel, ondertitel, auteur, intro en modules die je kunt ordenen.
- **Blokken:**
  - Tekst met opmaak, opsomming en statement.
  - Afbeelding (wordt automatisch verkleind) en video (YouTube, Vimeo).
  - Insluiten: Google Slides, Forms en Docs, Canva, Padlet, Mentimeter, Genially, H5P, Spotify en andere sites. Een gewone deellink wordt waar mogelijk omgezet naar de insluitlink.
  - Linkknoppen, tabbladen, uitklapblok, begrippenkaartjes, tijdlijn, stappenplan, SVG-afbeelding.
  - Meerkeuze (een of meer juiste antwoorden, uitleg per antwoord), koppelvraag, sorteeropdracht.
  - Doorgaan-knop: deelt een module op in stukken; vragen moeten eerst beantwoord zijn.
- **Vormgeving:** kies een designsjabloon voor de e-learning: *Minor CE* (warm wit met saliegroen), *HAN huisstijl* (HAN-rood #E50056, zwart, wit en de HAN-grijzen; Avenir Next waar die op de computer staat, anders Roboto, zoals de HAN voor digitaal voorschrijft), *Helder blauw* of *Hoog contrast* (zwart op wit met Atkinson Hyperlegible). Daarover kun je een eigen accentkleur en lettertype zetten; de bouwer waarschuwt als witte tekst op je accentkleur slecht leesbaar is. Het ontwerp gaat mee in alle exports.
- **Waarschuwingen** voor wat nog niet af is, zoals een vraag zonder juist antwoord of een afbeelding zonder alt-tekst.
- **Indeling:** klap de structuur (links) en het voorbeeld (rechts) in tot een smalle strook, of sleep de randen breder of smaller. De focusknop klapt beide in, zodat de editor het hele scherm krijgt. Sneltoetsen: Alt+1 structuur, Alt+2 voorbeeld, Alt+0 focus. Je indeling wordt onthouden.
- **Opslaan als bestand (Ctrl+S):** de eerste keer kies je waar het bouwbestand op je computer komt; daarna werkt Opslaan dat bestand bij, en zolang je wijzigt komt er elke 15 minuten automatisch een back-up in. Dat werkt in Chrome en Edge. In Firefox, Safari en het artifact downloadt Opslaan een kopie en krijg je elk kwartier een herinnering. Een bouwbestand dat je via Openen opent, wordt bij Opslaan bijgewerkt.
- **Waar staat je werk:** de status bovenin zegt het altijd, en is gemarkeerd zolang je werk alleen in de browser staat. Klik erop voor uitleg.
- **Claude** (alleen in het artifact): een module laten opzetten vanuit een onderwerp of brontekst, of kennisvragen laten maken bij een module.
- **Exporteren:**
  - **Webpagina (.html):** één bestand dat overal werkt, zoals op GitHub Pages of je eigen site. Voortgang wordt in de browser van de student bewaard.
  - **SCORM 1.2 (.zip):** voor Brightspace, Canvas, Moodle en andere LMS'en. Het LMS krijgt voortgang, plek, score, voltooiing en sessieduur, en de student kan hervatten.
  - **Bouwbestand (.json):** om later verder te bouwen of te delen.
- **Openen:** een bouwbestand, een geëxporteerde webpagina of een `course.json` uit de e-learnings-repo. Afbeeldingen uit een `course.json` moet je opnieuw kiezen.

## Opbouw

| Bestand | Inhoud |
| --- | --- |
| `src/sjabloon.html` | Opmaak en indeling van de bouwer, met plaatshouders voor de andere delen |
| `src/speler.js` | De speler (afgeleid van `assets/cursus.js` uit minor-ce-elearnings), plus het bloktype `embed` |
| `src/speler.css` | Stijl van de speler (afgeleid van `assets/cursus.css`) |
| `src/bouwer.js` | De bouwer: editors per bloktype, opslag, voorbeeld, Claude-dialogen, export naar HTML, SCORM en JSON |
| `src/voorbeeld.json` | Voorbeeldcursus waarmee de bouwer opent (twee ingekorte modules van Duurzame waarde) |
| `bouw.js` | Voegt alles samen tot `index.html` |
| `index.html` | De gebouwde bouwer, één bestand |

Na een wijziging in `src/`:

```bash
node bouw.js
```

Het formaat van een cursus is hetzelfde `course.json` als in minor-ce-elearnings. De speler en de bouwer moeten in de pas blijven met `assets/cursus.js` daar; een wijziging in een bloktype hoort in beide.

## Het artifact bijwerken

`node bouw.js` maakt ook `artifact.html`: dezelfde bouwer zonder HTML-omhulsel, omdat claude.ai dat bij het publiceren zelf toevoegt. Publiceer `artifact.html` opnieuw naar dezelfde artifact-URL, met de capabilities `db`, `user`, `sample` en `downloads`.

Gemaakt door Fabian Berndsen.
