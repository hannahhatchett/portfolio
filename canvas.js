// Home canvas — Melius-style Figma node board.
// A dark, dotted canvas of case-study image "nodes" wired together; hovering
// or focusing a node expands its image on the sticky feature panel at left.
//
// One node = one project. To add work, append to NODES. Positions:
//   x = fraction of canvas width for the node's left edge
//   y = px from the top of the canvas   |   w = node width in px
// Projects with no cover artwork yet use `placeholder:true` and render the
// brand mark instead of an image. That's independent of linking: any node with
// a real `href` (anything but "#") becomes a clickable <a>, mark or not.
(function () {
  // Coral cursor mark (from the site's hero) — used for placeholder cards.
  const MARK =
    '<svg viewBox="0 0 16 16" aria-hidden="true">' +
    '<path d="M2 1 L2 13 L5.5 10 L7.8 14.2 L9.6 13.4 L7.3 9.2 L11.5 9.2 Z" fill="#ff6b5b"/></svg>';

  // Realistic pointer for the browse animation on the left display.
  const CURSOR_SVG =
    '<svg viewBox="0 0 16 16" aria-hidden="true">' +
    '<path d="M2 1 L2 13 L5.5 10 L7.8 14.2 L9.6 13.4 L7.3 9.2 L11.5 9.2 Z" fill="#1b1b1f" stroke="#fff" stroke-width="0.9" stroke-linejoin="round"/></svg>';

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animControllers = [];

  // Positions/sizes are FRACTIONS of the canvas width so the board scales with
  // the window (no overlap when the tab is narrowed). `y` is in "design px" at
  // DESIGN_W and is scaled by the same factor, so vertical rhythm tracks too.
  const NODES = [
    {
      name: "Optimizely",
      tags: ["UX", "B2B SaaS", "Completed"],
      blurb: "A new case study is in the works — check back soon.",
      img: "images/optimizely-home-card.jpg", href: "optimizely.html", bg: "#b9c79a",
      x: 0.05, y: 64, w: 0.46, ar: "808 / 396",
      // Left-display browse animation: real captures from the live
      // prototype. Overview is a dashboard — nothing there is worth
      // scrolling to, so it skips straight to the nudge and clicks it
      // (a real action, leads to the picker). The picker just scrolls
      // through the campaigns, then the loop restarts — no fake click back.
      anim: [
        { img: "images/optimizely-overview-top.jpg", click: [83, 51], scroll: false },
        { img: "images/optimizely-picker-full.jpg" },
      ],
    },
    {
      name: "Haunted Heist",
      tags: ["UX", "Indie Game", "In Progress"],
      blurb: "A new case study is in the works — check back soon.",
      img: "images/haunted-heist-key-art.jpg",
      previewVideo: "videos/haunted-heist-preview.mp4",
      href: "haunted-heist.html", bg: "#f4d8d4",
      x: 0.53, y: 300, w: 0.42, ar: "1704 / 976",
    },
    {
      name: "Bottle Cap",
      agency: "Element 47",
      tags: ["Web Design", "Design Agency", "Shipped"],
      blurb: "Redesigning the brand and website for a Nashville pub with an outdated web presence. Owned the process end-to-end, from client strategy through wireframes and contractor collaboration.",
      img: "images/final-bottlecap-home-clean.png", href: "bottle-cap.html",
      bg: "#cfe1f2",
      x: 0.09, y: 560, w: 0.45, ar: "16 / 11",
      // Left-display browse animation: full-length page captures. Each page
      // (~4s) scrolls down while the cursor moves to the side, then the cursor
      // returns to the next nav item (click = [x%, y%] of the screen) and clicks
      // — zooming in close on the mouse — before crossfading to the next page:
      // home → Food & Drink → Specials & Events → (Bottle Cap logo) back home.
      anim: [
        { img: "images/bottlecap-home-full.jpg", click: [44.4, 10.9] },     // → Food & Drink
        { img: "images/bottlecap-food-full.jpg", click: [57.0, 10.9] },     // → Specials & Events
        { img: "images/bottlecap-specials-full.jpg", click: [13, 10.8] }, // → Bottle Cap logo (loops home)
      ],
    },
  ];
  const EDGES = [[0, 1], [1, 2]];
  const DEFAULT_ACTIVE = 0;
  const DESIGN_W = 700;   // reference width for scaling the vertical rhythm
  const MAX_W = 460;      // cap card width on very wide screens

  const stage = document.querySelector(".cv-stage");
  const wires = document.querySelector(".cv-wires");
  const screenEl = document.querySelector(".device-screen");
  const featureEl = document.querySelector(".cv-feature");
  if (!stage || !wires || !screenEl) return;

  const isTouch = window.matchMedia("(hover: none)").matches;
  const nodeEls = [];
  const featureEls = [];

  // ---- Screen layers (inside the monitor) ----
  NODES.forEach((n, i) => {
    let f;
    if (n.anim) {
      // Animated slot: stacked page frames + a moving cursor.
      f = document.createElement("div");
      f.className = "cv-anim";
      [...new Set(n.anim.map((s) => s.img))].forEach((url, k) => {
        const im = document.createElement("img");
        im.className = "cv-frame-img" + (k === 0 ? " on" : "");
        im.src = url;
        im.alt = "";
        im.dataset.url = url;
        f.appendChild(im);
      });
      const cur = document.createElement("div");
      cur.className = "cv-cursor";
      cur.innerHTML = CURSOR_SVG;
      f.appendChild(cur);
      animControllers[i] = makeAnim(f, n.anim);
    } else if (n.placeholder) {
      f = document.createElement("div");
      f.className = "cv-shot is-mark";
      f.innerHTML = MARK;
    } else if (n.previewVideo) {
      f = document.createElement("video");
      f.className = "cv-shot";
      f.src = n.previewVideo;
      f.autoplay = true;
      f.loop = true;
      f.muted = true;
      f.playsInline = true;
    } else {
      f = document.createElement("img");
      f.className = "cv-shot";
      f.src = n.previewImg || n.img;
      f.alt = "";
    }
    screenEl.appendChild(f);
    featureEls[i] = f;
  });

  // ---- Nodes (right) ----
  NODES.forEach((n, i) => {
    // A node links out as long as it has a real href; `placeholder` only says
    // whether we have cover art for it yet.
    const linked = n.href && n.href !== "#";
    const el = document.createElement(linked ? "a" : "div");
    el.className = "cv-node" + (n.placeholder ? " is-placeholder" : "");
    if (linked) el.href = n.href;
    el.tabIndex = 0;
    el.setAttribute("aria-label", n.name);
    const media = n.placeholder
      ? `<div class="cv-mark">${MARK}</div>`
      : `<img src="${n.img}" alt="${n.name}" loading="lazy" />`;
    const tagsHtml = (n.tags || []).map((t) => `<span>${t}</span>`).join("");
    el.innerHTML =
      `<div class="cv-node-labels"><span class="l">${n.name}</span>` +
      `<div class="cv-node-tags">${tagsHtml}</div></div>` +
      `<div class="cv-card">` +
      `<div class="cv-frame" style="aspect-ratio:${n.ar}">${media}</div></div>`;

    if (!isTouch) el.addEventListener("mouseenter", () => setActive(i));
    el.addEventListener("focus", () => setActive(i));
    stage.appendChild(el);
    nodeEls[i] = el;
  });

  function setActive(i) {
    nodeEls.forEach((el, k) => el.classList.toggle("is-active", k === i));
    featureEls.forEach((el, k) => el.classList.toggle("is-active", k === i));
    if (featureEl && NODES[i].bg) featureEl.style.backgroundColor = NODES[i].bg;
    // Run the browse animation only for the active project.
    animControllers.forEach((c, k) => { if (c) (k === i ? c.start() : c.stop()); });
  }

  // Fake-cursor browse animation for a slot: snappy, zoom-driven. Each page
  // reveals at the top with a zoom, the cursor clicks the next nav item, then
  // a quick zoom-dive down through the page crossfades to the next one — no
  // slow scroll-up. Cancellable via a token so it stops when another project
  // is hovered.
  function makeAnim(container, scenes) {
    const cursor = container.querySelector(".cv-cursor");
    const frames = Array.from(container.querySelectorAll(".cv-frame-img"));
    const frameFor = (url) => frames.find((f) => f.dataset.url === url);
    let token = 0;
    let running = false;

    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
    const showFrame = (url) =>
      frames.forEach((im) => im.classList.toggle("on", im.dataset.url === url));

    // Instant reset: scale 1, given scroll position, origin centered.
    function frameInstant(fr, pos) {
      fr.style.transition = "none";
      fr.style.transformOrigin = "50% 50%";
      fr.style.transform = "scale(1)";
      fr.style.objectPosition = "center " + pos + "%";
      void fr.offsetWidth;
      fr.style.transition = "opacity 500ms ease";
    }
    // Animate the scroll position only (no zoom).
    function frameScroll(fr, pos, dur) {
      fr.style.transition = "object-position " + dur + "ms linear, opacity 500ms ease";
      fr.style.objectPosition = "center " + pos + "%";
    }
    // Zoom into a point [x%, y%] (used on click).
    function frameZoom(fr, scale, ox, oy, dur) {
      fr.style.transformOrigin = ox + "% " + oy + "%";
      fr.style.transition = "transform " + dur + "ms cubic-bezier(0.4,0,0.2,1), opacity 500ms ease";
      fr.style.transform = "scale(" + scale + ")";
    }
    function moveCursor(pct, instant) {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      const x = (pct[0] / 100) * w - 3;
      const y = (pct[1] / 100) * h - 2;
      cursor.style.transition = instant ? "none" : "";
      cursor.style.transform = `translate(${x}px, ${y}px)`;
      if (instant) void cursor.offsetWidth;
    }
    // Scroll time scales with page length (~constant reading speed): taller
    // pages get more time to digest, shorter pages stay snappy.
    const scrollDur = (fr) =>
      Math.min(5600, Math.max(2000, Math.round(((fr.naturalHeight || 4000) / 1600) * 1000)));

    async function run() {
      const my = ++token;
      running = true;
      let idx = 0;
      frames.forEach((f) => frameInstant(f, 0));
      showFrame(scenes[0].img);
      moveCursor([50, 50], true);
      await wait(200); if (my !== token) return;
      cursor.style.opacity = "1";
      while (my === token) {
        const s = scenes[idx];
        const fr = frameFor(s.img);
        showFrame(s.img);
        frameInstant(fr, 0);                       // start at the top
        cursor.style.opacity = "1";
        await wait(350); if (my !== token) return;
        if (s.scroll === false) {
          // Dashboard-style scene: nothing worth scrolling to. Go straight
          // to the click target instead of scrolling through it first.
          moveCursor(s.click, false);
          await wait(500); if (my !== token) return;
        } else {
          // scroll down through the page; cursor moves out to the side.
          // Duration scales with page height so long pages get a longer scroll.
          const dur = scrollDur(fr);
          moveCursor([93, 46], false);
          frameScroll(fr, 100, dur);
          await wait(dur + 150); if (my !== token) return;
          if (s.click) {
            // cursor returns to the nav item; snap the page back to the top
            moveCursor(s.click, false);
            await wait(430); if (my !== token) return;
            frameInstant(fr, 0);
            await wait(300); if (my !== token) return;
          }
        }
        if (s.click) {
          // click: zoom in close, centered on the mouse
          cursor.classList.add("click");
          frameZoom(fr, 2.8, s.click[0], s.click[1], 600);
          await wait(340); if (my !== token) return;
          cursor.classList.remove("click");
          await wait(220); if (my !== token) return;
        } else {
          // No click here — just a beat before the loop restarts.
          cursor.style.opacity = "0";
          await wait(400); if (my !== token) return;
        }
        // crossfade to the next page (fresh, at the top, no zoom)
        idx = (idx + 1) % scenes.length;
        const nf = frameFor(scenes[idx].img);
        frameInstant(nf, 0);
        showFrame(scenes[idx].img);
        await wait(500); if (my !== token) return;
        frameInstant(fr, 0);                        // reset the page we left
      }
    }

    return {
      start() {
        if (REDUCED) { showFrame(scenes[0].img); return; }
        if (!running) run();
      },
      stop() {
        token++;
        running = false;
        cursor.classList.remove("click");
        cursor.style.opacity = "0";
        frames.forEach((f) => frameInstant(f, 0));
        showFrame(scenes[0].img);
      },
    };
  }

  // ---- Layout: place nodes, size the stage, draw wires ----
  function layout() {
    const W = stage.clientWidth;
    const k = W / DESIGN_W;
    let maxBottom = 0;
    NODES.forEach((n, i) => {
      const el = nodeEls[i];
      const wPx = Math.min(n.w * W, MAX_W);
      const leftPx = Math.max(8, Math.min(n.x * W, W - wPx - 8));
      const topPx = n.y * k;
      el.style.width = wPx + "px";
      el.style.left = leftPx + "px";
      el.style.top = topPx + "px";
      maxBottom = Math.max(maxBottom, topPx + el.offsetHeight);
    });
    stage.style.minHeight = maxBottom + 70 * k + "px";
    drawWires();
  }

  // Connect the facing edges of two cards (right→left or left→right) with a
  // horizontal cubic bezier + endpoint dots, the way Melius wires its nodes.
  function drawWires() {
    const sRect = stage.getBoundingClientRect();
    wires.innerHTML = "";
    const NS = "http://www.w3.org/2000/svg";
    EDGES.forEach(([a, b]) => {
      const ca = nodeEls[a].querySelector(".cv-card").getBoundingClientRect();
      const cb = nodeEls[b].querySelector(".cv-card").getBoundingClientRect();
      const aL = ca.left - sRect.left, aR = aL + ca.width, aY = ca.top - sRect.top + ca.height / 2;
      const bL = cb.left - sRect.left, bR = bL + cb.width, bY = cb.top - sRect.top + cb.height / 2;
      const bCenter = bL + cb.width / 2, aCenter = aL + ca.width / 2;

      let x1, x2, d1, d2;
      if (bCenter >= aCenter) { x1 = aR; x2 = bL; d1 = 1; d2 = -1; }
      else { x1 = aL; x2 = bR; d1 = -1; d2 = 1; }
      const k = Math.max(60, Math.abs(x2 - x1) * 0.5);
      const c1x = x1 + d1 * k, c2x = x2 + d2 * k;
      const d = `M ${x1} ${aY} C ${c1x} ${aY}, ${c2x} ${bY}, ${x2} ${bY}`;

      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      wires.appendChild(path);
      [[x1, aY], [x2, bY]].forEach(([cx, cy]) => {
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", cx);
        c.setAttribute("cy", cy);
        c.setAttribute("r", "3.5");
        wires.appendChild(c);
      });
    });
  }

  setActive(DEFAULT_ACTIVE);
  requestAnimationFrame(layout);
  window.addEventListener("load", layout);

  // Re-lay-out (nodes + wires) whenever the canvas changes size, so the whole
  // board — including the flow links between projects — scales with the window.
  const canvasEl = document.querySelector(".cv-canvas");
  if (canvasEl && "ResizeObserver" in window) {
    let raf = null;
    const ro = new ResizeObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = null; layout(); });
    });
    ro.observe(canvasEl);
  } else {
    let rt;
    window.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(layout, 120);
    });
  }
})();
