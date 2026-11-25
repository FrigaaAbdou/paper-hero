/* paper-hero: paper notes fly around the headline, then assemble into your products as the page scrolls.
   One WebGL2 draw call, no library. Public domain. Settings: see README.md (window.PaperHero). */
(() => {
  const root = document.documentElement;
  const hero = document.querySelector(".paper-hero");
  if (!hero) return;
  const cfg = Object.assign({
    languages: ["en", "fr"],                       // languages you ship words and screens for (first = fallback)
    screenUrl: (name, lang) => `screens/${name}-${lang}.jpg`, // name: tool | site | app
    blue: [0, 0.4, 1],                             // background colour, 0..1 RGB (keep it equal to --ph-blue in the CSS)
    words: {},                                     // { en: ["8 short notes"…], fr: […] }; see DEFAULT_WORDS
  }, window.PaperHero || {});
  const langOf = () => (cfg.languages.includes(root.lang) ? root.lang : cfg.languages[0]);

  const stage = hero.querySelector(".ph-stage");
  const canvas = hero.querySelector(".ph-canvas");
  const copy = hero.querySelector(".ph-copy");
  const end = hero.querySelector(".ph-end");
  const clamp = (v) => Math.min(Math.max(v, 0), 1);
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

  // Phone held sideways: no pinned animation (same query in hero.css). Otherwise the page scrolls natively and drives the animation.
  const short = matchMedia("(max-height: 480px) and (hover: none) and (pointer: coarse)");
  const touchy = matchMedia("(hover: none) and (pointer: coarse)");

  // White menu only while nothing light can slide under it.
  const overHero = () => {
    const r = hero.getBoundingClientRect();
    root.classList.toggle("ph-over", hero.classList.contains("is-static") ? r.top > -40 : r.bottom > (short.matches ? 120 : innerHeight - 40));
  };
  addEventListener("scroll", overHero, { passive: true });
  addEventListener("resize", overHero);
  overHero();

  const screens = [...hero.querySelectorAll("[data-screen]")];
  const localizeScreens = () => screens.forEach((img) => { img.src = cfg.screenUrl(img.dataset.screen, langOf()); });
  let onLanguage = () => {};
  new MutationObserver(() => { localizeScreens(); onLanguage(); }).observe(root, { attributes: true, attributeFilter: ["lang"] });
  localizeScreens();

  const goStatic = () => { hero.classList.add("is-static"); overHero(); };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return goStatic();
  const gl = canvas.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: true });
  if (!gl) return goStatic();

  /* ---------- Shaders ---------- */
  const VS = `#version 300 es
  precision highp float;
  layout(location=0) in vec2 q;            // -0.5..0.5
  layout(location=1) in vec3 aScatter;     // px, z toward the viewer
  layout(location=2) in vec4 aSeed;
  layout(location=3) in vec3 aTarget;
  layout(location=4) in vec4 aSize;        // note w,h, tile w,h
  layout(location=5) in vec4 aUv;          // u0,v0,du,dv in the screen image
  layout(location=6) in vec2 aMeta;        // surface, note cell
  uniform vec2 uHalf; uniform float uP, uT, uIntro; uniform vec2 uPtr; uniform vec2 uTilt; uniform float uWind;
  out vec2 vQ; out vec2 vScreen; flat out vec2 vMeta; out float vDepth; out float vLight; out float vE;
  mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1,0,0, 0,c,s, 0,-s,c);}
  mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0,-s, 0,1,0, s,0,c);}
  mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0, -s,c,0, 0,0,1);}
  void main(){
    float delay = .07 + aSeed.w*.30;
    float e = clamp((uP-delay)/.46, 0., 1.); e = e*e*e*(e*(e*6.-15.)+10.); // soft start, soft landing
    float o = 1.-e;
    float it = clamp(uIntro*1.7 - aSeed.x*.7, 0., 1.); it = 1.-pow(1.-it, 4.);
    // scattered
    vec3 sc = aScatter;
    sc.y += sin(uT*.7 + aSeed.x*40.)*14.; sc.x += cos(uT*.5 + aSeed.y*40.)*10.;
    vec2 away = sc.xy/(1.-sc.z/1400.) - uPtr;
    float push = exp(-dot(away,away)/52000.)*uWind;
    sc.xy += normalize(away+.001)*push*110.; sc.z += push*60.;
    sc = mix(vec3(0.,0.,-900.), sc, it);
    // travel: swirl, then land
    float sw = sin(e*3.14159)*(1.1+aSeed.y*.9);
    vec3 pos = mix(sc, aTarget, e);
    pos.xy = mat2(cos(sw),sin(sw),-sin(sw),cos(sw))*pos.xy;
    pos.z += sin(e*3.14159)*(aSeed.z-.35)*420.;
    // paper: size, bend, rotation
    vec2 size = mix(aSize.xy, aSize.zw, smoothstep(.35,1.,e));
    vec3 l = vec3(q*size, 0.);
    float bend = o*(.5+push)*(.4+aSeed.z);
    float wave = q.x*1.2 + q.y*.8;
    l.z += (wave*wave*.55 + sin(q.y*3.+uT*1.6+aSeed.x*20.)*.05)*size.x*bend;
    vec3 r = vec3((aSeed.x-.5)*1.5 + sin(uT*.6+aSeed.y*30.)*.22, (aSeed.y-.5)*1.5 + cos(uT*.5+aSeed.x*30.)*.25, (aSeed.z-.5)*2.2)*o;
    r.xy += push*vec2(.9,-.8)*o;
    mat3 R = rz(r.z)*ry(r.y + e*3.14159265)*rx(r.x);
    vec3 n = R*normalize(vec3(-wave*bend*1.3, -wave*bend*.9, 1.));
    vec3 w = R*l*mix(.2,1.,it) + pos;
    // finished products follow the pointer slightly
    vec3 t = ry(uTilt.x)*rx(uTilt.y)*w; w = mix(w, t, e*e);
    float per = 1.-w.z/1400.;
    per = max(per, .08);
    gl_Position = vec4(w.xy/uHalf, -w.z/3000.*per, per);
    vQ = q+.5; vMeta = aMeta; vE = e;
    vScreen = aUv.xy + vec2(1.-vQ.x, 1.-vQ.y)*aUv.zw;
    vDepth = clamp(-sc.z/900., 0., 1.)*o;
    vLight = .80 + .24*abs(dot(n, normalize(vec3(.35,.55,.9))));
    vLight = mix(vLight, 1., smoothstep(.8,1.,e));
  }`;
  const FS = `#version 300 es
  precision highp float;
  in vec2 vQ; in vec2 vScreen; flat in vec2 vMeta; in float vDepth, vLight, vE;
  uniform sampler2D uNotes, uS0, uS1, uS2; uniform vec3 uBox[3]; // w,h,radius px
  out vec4 c;
  void main(){
    vec3 col;
    if (gl_FrontFacing) {
      vec2 cell = vec2(mod(vMeta.y,4.), floor(vMeta.y/4.));
      vec4 n = texture(uNotes, (cell + vec2(vQ.x, 1.-vQ.y)*.985+.0075)/4.);
      if (n.a < .5) discard;
      col = n.rgb;
    } else {
      int s = int(vMeta.x+.5);
      vec3 b = uBox[s];
      vec2 uv = s>0 ? clamp(.5+(vScreen-.5)*b.xy/(b.xy-13.), 0., 1.) : vScreen;
      vec2 d = abs(vScreen-.5)*b.xy - b.xy*.5 + b.z;
      float sd = length(max(d,0.)) + min(max(d.x,d.y),0.) - b.z;
      if (sd > 0.) discard;
      col = s==0 ? texture(uS0,uv,-.6).rgb : s==1 ? texture(uS1,uv,-.6).rgb : texture(uS2,uv,-.6).rgb;
      if (s>0) col = mix(vec3(.027,.047,.176), col, smoothstep(0.,1., -sd-5.));
    }
    col *= vLight;
    col = mix(col, vec3(${cfg.blue.map((v) => Number(v).toFixed(3)).join(",")}), vDepth*.55);
    c = vec4(col,1.);
  }`;
  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (error) { console.error(error); return goStatic(); }
  gl.useProgram(program);
  const U = {};
  ["uHalf", "uP", "uT", "uIntro", "uPtr", "uTilt", "uWind", "uNotes", "uS0", "uS1", "uS2", "uBox"].forEach((name) => { U[name] = gl.getUniformLocation(program, name); });

  /* ---------- Textures ---------- */
  const makeTexture = (unit) => {
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([243, 247, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    return texture;
  };
  const upload = (unit, source) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
  };
  [0, 1, 2, 3].forEach(makeTexture);
  gl.uniform1i(U.uNotes, 0); gl.uniform1i(U.uS0, 1); gl.uniform1i(U.uS1, 2); gl.uniform1i(U.uS2, 3);
  const loadScreens = () => screens.forEach((img, index) => {
    const load = new Image();
    load.onload = () => { if (load.src === img.src) try { upload(index + 1, load); } catch (error) { goStatic(); } };
    load.onerror = goStatic;
    load.src = img.src;
  });
  loadScreens();

  // Eight short notes per language: the chaos your product replaces. Keep each under ~18 characters per line, "\n" = new line.
  const DEFAULT_WORDS = {
    en: ["call back\nMrs Benali", "2pm ?\nor 3pm", "send the\nquote !!", "stock ???", "ask\nKarim", "lost\ninvoice", "Saturday\nfull ?", "check\nWhatsApp"],
    fr: ["rappeler\nMme Benali", "RDV 14h ?\nou 15h", "devis à\nenvoyer !!", "stock ???", "demander\nà Karim", "facture\nperdue", "samedi\ncomplet ?", "voir\nWhatsApp"],
  };
  const WORDS = Object.assign({}, DEFAULT_WORDS, cfg.words);
  function drawNotes() {
    const S = 320, c = document.createElement("canvas");
    c.width = c.height = S * 4;
    const x = c.getContext("2d");
    const words = WORDS[langOf()] || WORDS[cfg.languages[0]];
    const hand = '600 70px Caveat, cursive';
    const paper = ["#ffe04a", "#ffffff", "#00f53b", "#dfeaff", "#ffe04a", "#ffffff", "#ffe04a", "#ffffff"];
    for (let i = 0; i < 16; i++) {
      x.save();
      x.translate((i % 4) * S, Math.floor(i / 4) * S);
      x.beginPath(); x.rect(0, 0, S, S); x.clip();
      if (i < 8) {
        x.fillStyle = paper[i]; x.fillRect(0, 0, S, S);
        x.fillStyle = "#070c2d"; x.font = hand; x.textAlign = "center"; x.textBaseline = "middle";
        x.translate(S / 2, S / 2); x.rotate((i % 3 - 1) * 0.05);
        const lines = words[i].split("\n");
        lines.forEach((line, k) => x.fillText(line, 0, (k - (lines.length - 1) / 2) * 78));
        if (i % 2 === 0) { x.strokeStyle = i === 2 ? "#070c2d" : "#e00416"; x.lineWidth = 5; x.lineCap = "round"; x.beginPath(); x.moveTo(-90, 104); x.quadraticCurveTo(0, 92, 96, 108); x.stroke(); }
      } else if (i === 8 || i === 12) { // spreadsheet
        x.fillStyle = "#fff"; x.fillRect(0, 0, S, S); x.fillStyle = "#cfe0ff"; x.fillRect(0, 0, S, 44);
        x.strokeStyle = "#b9c7dd"; x.lineWidth = 3;
        for (let k = 1; k < 8; k++) { x.beginPath(); x.moveTo(0, k * 44); x.lineTo(S, k * 44); x.moveTo(k * 80, 0); x.lineTo(k * 80, S); x.stroke(); }
        x.fillStyle = "#33415f"; for (let k = 0; k < 14; k++) x.fillRect((k * 3 % 4) * 80 + 12, 60 + (k % 6) * 44, 34 + (k * 17) % 24, 11);
        x.fillStyle = "#ffb3b8"; x.fillRect(82, 178, 77, 41);
      } else if (i === 9 || i === 13) { // torn lined page
        x.fillStyle = "#fff"; x.fillRect(0, 0, S, S); x.strokeStyle = "#a9c7ff"; x.lineWidth = 3;
        for (let k = 1; k < 8; k++) { x.beginPath(); x.moveTo(0, k * 40); x.lineTo(S, k * 40); x.stroke(); }
        x.strokeStyle = "#0b1a6b"; x.lineWidth = 5; x.lineCap = "round";
        for (let k = 1; k < 7; k++) { x.beginPath(); x.moveTo(26, k * 40 - 8); for (let m = 0; m < 10 + (k * 3) % 7; m++) x.lineTo(26 + m * 16, k * 40 - 8 - ((m * 7 + k * 5) % 17)); x.stroke(); }
      } else if (i === 10 || i === 14) { // chat bubbles
        x.fillStyle = "#e8f1ff"; x.fillRect(0, 0, S, S);
        [["#fff", 22, 30, 190], ["#00f53b", 100, 104, 196], ["#fff", 22, 178, 230], ["#00f53b", 150, 250, 146]].forEach(([f, a, b, w]) => {
          x.fillStyle = f; x.beginPath(); x.roundRect(a, b, w, 58, 22); x.fill(); x.fillStyle = "#070c2d"; x.fillRect(a + 22, b + 20, w - 76, 7); x.fillRect(a + 22, b + 34, w - 110, 7);
        });
      } else { // paper calendar, crossed out
        x.fillStyle = "#fff"; x.fillRect(0, 0, S, S); x.fillStyle = "#070c2d"; x.fillRect(0, 0, S, 64);
        x.fillStyle = "#33415f"; x.font = "600 30px system-ui, sans-serif"; x.textAlign = "center";
        for (let k = 0; k < 20; k++) x.fillText(String(k + 1), 34 + (k % 5) * 63, 112 + Math.floor(k / 5) * 58);
        x.strokeStyle = "#e00416"; x.lineWidth = 7; x.lineCap = "round";
        [[1, 0], [3, 1], [0, 2], [4, 3]].forEach(([a, b]) => { const u = 34 + a * 63, v = 102 + b * 58; x.beginPath(); x.moveTo(u - 22, v - 18); x.lineTo(u + 22, v + 18); x.moveTo(u + 22, v - 18); x.lineTo(u - 22, v + 18); x.stroke(); });
      }
      x.restore();
    }
    upload(0, c);
  }
  drawNotes();
  if (document.fonts) document.fonts.load("600 70px Caveat").then(drawNotes).catch(() => {});
  onLanguage = () => { drawNotes(); loadScreens(); requestAnimationFrame(relayout); };

  /* ---------- Geometry ---------- */
  const N = 8, verts = [], index = [];
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) verts.push(i / N - 0.5, j / N - 0.5);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i; index.push(a, a + 1, a + N + 1, a + 1, a + N + 2, a + N + 1); }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(index), gl.STATIC_DRAW);
  const instances = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instances);
  const parts = [3, 4, 3, 4, 4, 2], stride = 20 * 4;
  parts.reduce((offset, size, i) => { gl.enableVertexAttribArray(i + 1); gl.vertexAttribPointer(i + 1, size, gl.FLOAT, false, stride, offset * 4); gl.vertexAttribDivisor(i + 1, 1); return offset + size; }, 0);

  let W = 0, H = 0, count = 0;
  function layout() {
    W = stage.clientWidth; H = stage.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(devicePixelRatio || 1, W < 700 ? 1.75 : 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.uHalf, W / 2, H / 2);
    const small = W < 700 || W < H * 0.85;
    // Products fill the space between the closing line and its button.
    const [line, button] = end.children;
    const header = parseFloat(getComputedStyle(copy).top) || 82;
    const top = header + line.offsetTop + line.offsetHeight, bottom = header + button.offsetTop, room = bottom - top;
    const winH = small ? Math.min(W * 0.88 / 1.6, room * 0.5) : Math.min(H * 0.56, (W * 0.66) / 1.6, room * 0.84), winW = winH * 1.6;
    const phH = small ? Math.min(room * 0.64, W * 1.02) : winH * 0.86, phW = phH * (390 / 844);
    const cy = H / 2 - (top + bottom) / 2;
    const winY = small ? H / 2 - top - room * 0.04 - winH / 2 : cy + winH * 0.03;
    const phX = Math.min(winW / 2 + phW * 0.46, W / 2 - phW * 0.58 - 14) / 1.1; // beside the tool, over its margin only
    const phY = H / 2 - bottom + room * 0.07 + phH * 0.52;
    const surfaces = small
      ? [{ w: winW, h: winH, x: 0, y: winY, z: 0, nx: 10, ny: 6, r: 12 }, { w: phW, h: phH, x: -Math.min(W * 0.2, phW * 0.6), y: phY, z: 60, nx: 4, ny: 8, r: 20 }, { w: phW, h: phH, x: Math.min(W * 0.21, phW * 0.6), y: phY + room * 0.05, z: 90, nx: 4, ny: 8, r: 20 }]
      : [{ w: winW, h: winH, x: 0, y: winY, z: 0, nx: 14, ny: 9, r: 16 }, { w: phW, h: phH, x: -phX, y: winY - winH * 0.09, z: 110, nx: 5, ny: 10, r: 26 }, { w: phW, h: phH, x: phX, y: winY - winH * 0.04, z: 150, nx: 5, ny: 10, r: 26 }];
    gl.uniform3fv(U.uBox, surfaces.flatMap((s) => [s.w, s.h, s.r]));

    // The headline keeps a clear zone: no paper is placed over it.
    const base = stage.getBoundingClientRect();
    const zones = [...copy.children].map((el) => { const r = el.getBoundingClientRect(); return { x0: r.left - base.left - W / 2, x1: r.right - base.left - W / 2, y0: H / 2 - (r.bottom - base.top), y1: H / 2 - (r.top - base.top) }; });
    zones.push({ x0: -W, x1: W, y0: H / 2 - (small ? 58 : 66), y1: H }); // the menu stays readable too
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const note = small ? Math.min(120, W * 0.16) : Math.max(88, Math.min(W, 1800) * 0.068);
    const data = [];
    surfaces.forEach((s, si) => {
      for (let j = 0; j < s.ny; j++) for (let i = 0; i < s.nx; i++) {
        const tw = s.w / s.nx, th = s.h / s.ny;
        let x, y, z, n = 0;
        do {
          z = -620 + rnd() * 820;
          const per = 1 - z / 1400;
          const px = (rnd() - 0.5) * W * 1.16, py = (rnd() - 0.5) * H * 1.2, pad = (note * 0.72) / per;
          const hit = zones.some((b) => px > b.x0 - pad && px < b.x1 + pad && py > b.y0 - pad && py < b.y1 + pad);
          x = px * per; y = py * per;
          if (!hit) break;
        } while (++n < 60);
        if (n >= 60) { const side = rnd() < 0.5 ? -1 : 1; y = side * H * 0.62; z = 0; }
        const k = note * (0.8 + rnd() * 0.5);
        // The products build up from the centre outward, slightly loosely, instead of at random.
        const far = Math.min(1, Math.hypot((s.x + (i + 0.5) * tw - s.w / 2) / (W * 0.46), (s.y + s.h / 2 - (j + 0.5) * th) / (H * 0.5)));
        data.push(x, y, z, rnd(), rnd(), rnd(), far * 0.62 + rnd() * 0.38, s.x + (i + 0.5) * tw - s.w / 2, s.y + s.h / 2 - (j + 0.5) * th, s.z, k, k, tw + 0.6, th + 0.6, (i - 0.3 / tw) / s.nx, (j - 0.3 / th) / s.ny, (1 + 0.6 / tw) / s.nx, (1 + 0.6 / th) / s.ny, si, Math.floor(rnd() * 16));
      }
    });
    count = data.length / 20;
    gl.bindBuffer(gl.ARRAY_BUFFER, instances);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
  }

  /* ---------- Loop ---------- */
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 0);
  const ptr = { x: 9999, y: 9999, tx: 9999, ty: 9999, wind: 0, twind: 0, rx: 0, ry: 0 };
  if (matchMedia("(hover: hover)").matches) {
    stage.addEventListener("pointermove", (event) => {
      const r = stage.getBoundingClientRect();
      ptr.tx = event.clientX - r.left - W / 2; ptr.ty = H / 2 - (event.clientY - r.top);
      if (ptr.x > 9000) { ptr.x = ptr.tx; ptr.y = ptr.ty; }
      ptr.twind = 1;
    });
    stage.addEventListener("pointerleave", () => { ptr.twind = 0; });
  }
  // Critically damped follow with a top speed; same feel at 60 and 120 Hz.
  const follow = (value, goal, state, time, max, dt) => {
    const omega = 2 / time, x = omega * dt, decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const limit = max * time, change = Math.min(Math.max(value - goal, -limit), limit), to = value - change;
    const temp = (state.v + omega * change) * dt;
    state.v = (state.v - omega * temp) * decay;
    let next = to + (change + temp) * decay;
    if (goal > value === next > goal) { next = goal; state.v = 0; }
    return next;
  };
  const FULL = 2.6; // seconds: the assembly never plays faster than this
  const speed = { v: 0 };
  let p = -1, start = 0, last = 0, frame = 0, visible = false;
  const target = () => short.matches ? 0 : clamp(-hero.getBoundingClientRect().top / Math.max(1, hero.offsetHeight - H));
  function draw(now) {
    frame = 0;
    if (!visible || hero.classList.contains("is-static") || paused()) return;
    if (!start) start = now;
    const dt = Math.min(0.05, Math.max(0.001, (now - (last || now - 16)) / 1000));
    last = now;
    glide(now, dt);
    const goal = target();
    if (p < 0) { p = goal; speed.v = 0; }
    p = clamp(follow(p, goal, speed, 0.22, 1 / FULL, dt));
    if (Math.abs(goal - p) < 0.0003) { p = goal; speed.v = 0; }
    ptr.x += (ptr.tx - ptr.x) * 0.1; ptr.y += (ptr.ty - ptr.y) * 0.1; ptr.wind += (ptr.twind - ptr.wind) * 0.08;
    const nx = ptr.twind ? ptr.tx / (W / 2) : 0, ny = ptr.twind ? ptr.ty / (H / 2) : 0;
    ptr.rx += (nx * 0.16 - ptr.rx) * 0.06; ptr.ry += (ny * 0.1 - ptr.ry) * 0.06;

    const out = smooth(0.05, 0.2, p), done = smooth(0.8, 0.93, p);
    copy.style.opacity = 1 - out;
    copy.style.transform = `translateY(${-out * 60}px) scale(${1 - out * 0.06})`;
    copy.style.visibility = out > 0.99 ? "hidden" : "visible";
    end.style.opacity = done;
    end.style.visibility = done > 0.02 ? "visible" : "hidden";
    end.style.transform = `translateY(${(1 - done) * 18}px)`;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform1f(U.uP, p); gl.uniform1f(U.uT, (now - start) / 1000); gl.uniform1f(U.uIntro, clamp((now - start) / 1500));
    gl.uniform2f(U.uPtr, ptr.x, ptr.y); gl.uniform1f(U.uWind, ptr.wind); gl.uniform2f(U.uTilt, ptr.rx, ptr.ry);
    gl.drawElementsInstanced(gl.TRIANGLES, index.length, gl.UNSIGNED_SHORT, 0, count);
    frame = requestAnimationFrame(draw);
  }
  // Phones: while a link glides the page, the paper holds still and leaves the processor to the scroll.
  const paused = () => touchy.matches && root.classList.contains("is-gliding");
  const wake = () => { if (!frame && visible && !paused()) frame = requestAnimationFrame(draw); };
  addEventListener("paperhero:glide", () => { last = 0; wake(); });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!visible) { p = -1; last = 0; tgt = null; } // off screen: no catching up to watch
    wake();
  }).observe(hero);

  /* ---------- Wheel and trackpad: smooth and speed-limited, only while the hero is pinned ---------- */
  let tgt = null, pos = 0, arrived = 0, lastWheel = 0, lastDelta = 0;
  const glideSpeed = { v: 0 };
  const bounds = () => { const a = hero.getBoundingClientRect().top + scrollY; return [Math.max(0, a), a + hero.offsetHeight - H]; };
  const active = () => visible && !short.matches && !hero.classList.contains("is-static");
  const finished = () => p < 0 || p > 0.94;
  function glide(now, dt) {
    if (tgt === null) return;
    if (Math.abs(scrollY - pos) > 3) { tgt = null; return; } // scrollbar or script took over
    const [a, b] = bounds();
    pos = follow(pos, tgt, glideSpeed, 0.2, (b - a) / 2.3, dt);
    if (Math.abs(tgt - pos) < 0.4) pos = tgt;
    scrollTo({ top: pos, behavior: "instant" });
    if (pos >= b - 1 && !arrived) arrived = now;
    if (pos === tgt) { tgt = null; glideSpeed.v = 0; }
  }
  function push(delta, lead) {
    const [a, b] = bounds();
    if (tgt === null) { pos = scrollY; tgt = pos; glideSpeed.v = 0; }
    const reach = (b - a) * lead; // a violent gesture cannot queue more than this
    tgt = Math.min(Math.max(tgt + delta, pos - reach, a), pos + reach, b);
    wake();
  }
  // A click on a link or a key press always wins over the glide.
  const release = () => { tgt = null; glideSpeed.v = 0; };
  addEventListener("pointerdown", release);
  addEventListener("keydown", release);
  addEventListener("click", release, true);

  addEventListener("wheel", (event) => {
    if (!active() || event.ctrlKey || event.defaultPrevented) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
    const [a, b] = bounds(), y = scrollY, now = performance.now(), gap = now - lastWheel, size = Math.abs(event.deltaY);
    const fading = size < lastDelta || size < 30;
    lastWheel = now; lastDelta = size;
    if (event.deltaY < 0 || y < b - 1) arrived = 0;
    if (event.deltaY > 0 ? y >= a - 1 && y < b - 1 : y > a + 1 && y <= b + 1) {
      event.preventDefault();
      push(event.deltaY * (event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? innerHeight : 1), 0.42);
    } else if (event.deltaY > 0 && y >= b - 1 && y < b + 2) {
      // Final frame: finish the assembly, then let the momentum of that same gesture die out.
      if (!arrived) arrived = now;
      const held = now - arrived;
      if ((!finished() && held < 2600) || (gap < 140 && held < (fading ? 2600 : 900))) event.preventDefault();
    }
  }, { passive: false });

  canvas.addEventListener("webglcontextlost", (event) => { event.preventDefault(); goStatic(); });

  // Measure the headline at rest, whatever the scroll position.
  const relayout = () => { const t = copy.style.transform; copy.style.transform = "none"; layout(); copy.style.transform = t; };
  let lastW = 0, lastH = 0;
  new ResizeObserver(() => {
    const w = stage.clientWidth, h = stage.clientHeight;
    // Phones change height when the address bar hides: rebuild only for a real change.
    if (w === lastW && Math.abs(h - lastH) < 4) return;
    lastW = w; lastH = h; relayout();
  }).observe(stage);
  if (document.fonts) document.fonts.ready.then(relayout);
  relayout();
})();
