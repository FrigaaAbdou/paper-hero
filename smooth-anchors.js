/* Optional: every in-page link (<a href="#id">) glides instead of jumping.
   Soft start, soft landing, any wheel / touch / key press takes over. Also tells paper-hero to hold still while gliding. */
(() => {
  let frame = 0;
  const gliding = (on) => { document.documentElement.classList.toggle("is-gliding", on); window.dispatchEvent(new Event("paperhero:glide")); };
  const stop = () => { if (!frame) return; cancelAnimationFrame(frame); frame = 0; gliding(false); };
  ["wheel", "touchstart", "pointerdown", "keydown"].forEach((name) => window.addEventListener(name, stop, { passive: true }));
  const ease = (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (2 - 2 * t) ** 4 / 2);
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href^="#"]');
    const target = link && document.getElementById(link.hash.slice(1));
    if (!target || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    event.preventDefault();
    stop();
    const from = window.scrollY;
    const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    const goal = () => Math.max(0, Math.min(target.getBoundingClientRect().top + window.scrollY - margin, document.documentElement.scrollHeight - window.innerHeight));
    const duration = Math.min(1700, Math.max(700, 600 + Math.abs(goal() - from) * 0.35));
    let start = 0;
    const step = (now) => {
      start = start || now;
      const t = Math.min(1, (now - start) / duration);
      window.scrollTo({ top: from + (goal() - from) * ease(t), behavior: "instant" });
      if (t < 1) frame = requestAnimationFrame(step); else stop();
    };
    gliding(true);
    frame = requestAnimationFrame(step);
    if (location.hash !== link.hash) history.pushState(null, "", link.hash);
  });
})();
