# paper-hero

A hero section where **paper notes fly around your headline, then assemble into your products as the page scrolls**. Messy before, tidy after.

- One WebGL2 draw call, no library, about 24 KB of JavaScript.
- The page scrolls natively on every device. The scroll position drives the animation; nothing hijacks the finger.
- Falls back to a static version without WebGL, with reduced motion, or without JavaScript.
- English and French included, any language possible.

**Demo:** https://frigaaabdou.github.io/paper-hero/ (or open `index.html` from a local server).

## Use it in your page

1. Copy `paper-hero.css`, `paper-hero.js`, and the `screens/` folder next to your page. Optional: `smooth-anchors.js`.
2. Load the two fonts (the notes use a handwriting font):
   ```html
   <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600&family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
   <link rel="stylesheet" href="paper-hero.css">
   ```
3. Paste the `<section class="paper-hero">` block from `index.html` where you want the hero.
4. Before `</body>`:
   ```html
   <script src="paper-hero.js"></script>
   <script src="smooth-anchors.js"></script> <!-- optional -->
   ```

The page must **not** have `overflow: hidden` on a parent of the hero (`overflow: clip` is fine), otherwise the pinned stage cannot stick.

## Make it yours

**Colours and header height** (CSS, top of `paper-hero.css`):

```css
:root { --ph-blue: #0066ff; --ph-green: #00f53b; --ph-ink: #070c2d; --ph-header: 83px; --ph-header-mobile: 67px; }
```
`--ph-header` is the height of your sticky menu: the hero slides under it. Keep the same blue in the script settings below.

**Settings** (JavaScript, before `paper-hero.js`):

```html
<script>
  window.PaperHero = {
    languages: ["en", "fr"],                   // first = fallback; follows <html lang>
    blue: [0, 0.4, 1],                         // same colour as --ph-blue, as 0..1 RGB
    screenUrl: (name, lang) => `screens/${name}-${lang}.jpg`, // name is tool | site | app
    words: { en: ["call back\nMrs Benali", /* 8 short notes */] },
  };
</script>
```

**The three screens** are images, shown flat once everything has landed: `tool` (large window), `site` and `app` (two phones). Replace them with screenshots of your own product at the same ratio (tool 1.6:1, phones 390×844). `screens/screens-source.html` is the page used to produce the examples.

**The eight notes** are the chaos your product replaces: the more specific to your audience, the better.

**Menu on blue.** While the hero is on screen, `<html>` has the class `ph-over`. For example:
```css
html.ph-over .my-header { background: transparent; color: #fff; }
```

## How it works (short)

- Each tile of the three screens is one instance of a paper sheet. A vertex shader places it from a scattered position to its place in the final screen, driven by one number, the scroll progress `p` (0 to 1).
- The front of each sheet is a note texture drawn on a canvas, the back is the screen image, so the sheets turn over as they land.
- `p` is read from the position of the section (`getBoundingClientRect`) and smoothed with a critically damped spring with a top speed, so a fast flick never makes the animation jump.
- Pointer: on desktop the notes drift away from the cursor.
- On phones the canvas is limited to 1.75× pixel density, and the animation is held still while a link scroll glides, otherwise Safari drops frames.

## Browser support

Any browser with WebGL2 (Chrome, Edge, Firefox, Safari 15+). Otherwise the static version is shown.

## Rebuild it with an AI assistant

See [`PROMPT.md`](PROMPT.md): the brief and the pitfalls, ready to paste into any AI coding assistant.

## Licence

Free for everyone, for any use, commercial or not. Public domain ([Unlicense](LICENSE)): no condition, no credit required.
