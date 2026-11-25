# Prompt: build your own paper-hero

Paste everything below the line into an AI coding assistant, in your project. Replace the parts in `[brackets]`. Or point the assistant at this repository and say "use paper-hero for my hero".

---

Build a full-screen hero for **[your company / what you sell]**, aimed at **[your audience]**.

## The idea

Messy before, tidy after. The hero opens on a bold headline with paper notes, post-its, a torn lined page, chat bubbles, a spreadsheet and a crossed-out calendar floating around it in 3D. The notes are the chaos of **[your audience's daily mess, 8 short phrases, e.g. "call back Mrs Benali", "2pm or 3pm?", "stock ???"]**. As the visitor scrolls, the notes fly in a swirl and land to form three clean product screens (a large window and two phones). The headline fades out and a closing line fades in: **["Here. All tidy."]** with one button.

## Copy

- Headline: **[…]** (one word in an accent colour)
- One-line description: **[what you do, plain words]**
- Cue button under it: **[e.g. "Scroll, we'll tidy up."]**
- Closing line + sentence + button: **[…]**

## Look

- Flat background colour **[#0066ff]**, accent **[#00f53b]**, ink **[#070c2d]**. Big, tight, bold headline.
- Notes: yellow, white, accent green and pale blue paper; handwriting font (Caveat); a red hand-drawn line under some.
- The three screens are generic examples titled "Your business", never real clients, labelled "Example".

## Technical constraints (they matter)

1. **One WebGL2 draw call, no library.** Instanced quads. Each instance has a scattered position, a target position in the final screen, a size, and a UV rectangle of the screen image it carries. The vertex shader mixes scattered to target with a smooth step driven by one uniform `p` (0 to 1), adds a swirl and a rotation while travelling, bends the sheet while it flies, and flips it so the note texture is on the front and the screen image on the back.
2. **Native scrolling only.** The section is `position: relative` with a height of about 340vh (290vh on phones) and an inner `position: sticky; top: 0; height: 100svh` stage. Progress `p = clamp(-section.top / (section.height - viewportHeight))`. Never listen to touchmove to move the page, never `preventDefault` a touch: it breaks on iPhone.
3. **Smooth the progress**, don't use it raw: a critically damped spring with a maximum speed (the assembly never plays faster than about 2.6 s), frame-rate independent. On desktop, optionally glide wheel events only while the hero is pinned.
4. **Headline keeps a clear zone**: no note is placed over the text; the menu zone stays clear too.
5. **Layout the target screens from the space available** between the closing line and its button, not from fixed pixels. Rebuild on resize, but ignore small height changes (the Safari address bar).
6. **Fallbacks**: if `prefers-reduced-motion`, no WebGL2, or context lost, show a static version (headline, the three screen images, closing line). Images keep real `alt` text.
7. **Phones**: cap device pixel ratio at 1.75, hold the animation still while an in-page link is smooth-scrolling (Safari drops frames otherwise), keep a landscape-phone fallback to a plain screen.
8. **Accessibility and SEO**: all text is real HTML over the canvas; the canvas is `aria-hidden`.
9. Menu on the blue: add a class on `<html>` while the hero is on screen so the menu can turn white.
10. Smooth anchor links: every `a[href^="#"]` glides (ease in-out quart, 0.7 to 1.7 s depending on distance); any wheel, touch or key press cancels it; skip it with reduced motion.

## Test before showing me

- Desktop and a phone-size viewport; real finger swipe on an iPhone simulator (Safari), not only Chrome.
- Frames recorded during a scroll must show a continuous assembly, no jump.
- No horizontal overflow at 320 px; no console error; the static fallback works with reduced motion.

---

### Pitfalls we hit (so you skip them)

- Hijacking touch scroll (preventDefault on touchmove) feels broken on iPhone. Use native scroll and read the position.
- An instant jump (`scrollIntoView` with behavior instant) on the cue button makes the animation vanish: use a glide.
- A sticky stage in `vh` shakes when the Safari bar collapses: use `svh` for the stage and rebuild only on real size changes.
- Trackpad inertia can carry the page past the end of the pinned hero: hold the final frame for a moment.
- `overflow: hidden` on a parent of the sticky stage breaks it; use `overflow: clip`.
- Mobile Safari renders the first frames late on a loaded machine: do not judge smoothness from a single screenshot, record a video and look at the frames.
