# E-learning Bouwer

Een bouwer voor e-learnings in het format van de [e-learnings van de minor Circulaire Economie](https://github.com/FabianB88/minor-ce-elearnings), zoals *Business Ethics* en *Duurzame waarde*. Je klikt blokken aan en vult ze in, en ziet ze live in dezelfde speler die studenten gebruiken.

- **Claude-artifact** (met opslag in je account en Claude-hulp): https://claude.ai/artifact/RnohLRy2qXGiJBwsbL1ZMK. Het artifact is privé; vraag de eigenaar om toegang als Bijdrager.
- **Online, zonder account:** https://fabianb88.github.io/elearning-bouwer/. Alles werkt, behalve de Claude-hulp; je werk wordt in je browser bewaard.
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
- **Waarschuwingen** voor wat nog niet af is, zoals een vraag zonder juist antwoord of een afbeelding zonder alt-tekst.
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
