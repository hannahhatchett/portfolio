// Reveal on scroll using IntersectionObserver, with a small stagger per group.
(function () {
  const els = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("in"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        // Stagger siblings so groups of reveals cascade in.
        const parent = el.parentElement;
        const siblings = parent
          ? Array.from(parent.querySelectorAll(":scope > .reveal"))
          : [el];
        const idx = siblings.indexOf(el);
        const delay = Math.max(0, idx) * 90;
        el.style.transitionDelay = delay + "ms";
        el.classList.add("in");
        io.unobserve(el);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  els.forEach((el) => io.observe(el));

  // Statement hero "selection" frame — measures the rendered headline and
  // draws a Figma-style bounding box (corner handles + layer label + live
  // dimensions) around it, with guide lines running the full width at the
  // box's top/bottom edges. Recomputed on resize/font-load/keystroke since
  // the text (and therefore the box) reflows as the edit loop below types.
  const heroFrame = document.getElementById("heroFrame");
  let layoutHeroFrame = null;
  if (heroFrame) {
    const band = document.querySelector(".statement-band");
    const box = heroFrame.querySelector(".hero-frame-box");
    const line1 = document.querySelector(".statement-line1");
    const line2 = document.querySelector(".statement-line2");
    const dimsLabel = heroFrame.querySelector(".hero-frame-dims");
    const guideTop = heroFrame.querySelector(".hero-guide-top");
    const guideBottom = heroFrame.querySelector(".hero-guide-bottom");
    const PAD = 22;

    layoutHeroFrame = () => {
      if (!band || !box || !line1 || !line2) return;
      const bandRect = band.getBoundingClientRect();
      const r1 = line1.getBoundingClientRect();
      const r2 = line2.getBoundingClientRect();
      const left = Math.min(r1.left, r2.left) - bandRect.left - PAD;
      const top = Math.min(r1.top, r2.top) - bandRect.top - PAD;
      const right = Math.max(r1.right, r2.right) - bandRect.left + PAD;
      const bottom = Math.max(r1.bottom, r2.bottom) - bandRect.top + PAD;
      const w = right - left;
      const h = bottom - top;

      box.style.left = left + "px";
      box.style.top = top + "px";
      box.style.width = w + "px";
      box.style.height = h + "px";
      box.classList.add("is-ready");

      if (dimsLabel) dimsLabel.textContent = Math.round(w) + " × " + Math.round(h);
      if (guideTop) guideTop.style.top = top + "px";
      if (guideBottom) guideBottom.style.top = bottom + "px";
    };

    layoutHeroFrame();
    window.addEventListener("resize", layoutHeroFrame);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutHeroFrame);
  }

  // Statement hero "live edit" loop — the Hannah cursor selects the second
  // line, deletes it, and retypes the other phrase, on repeat: a small,
  // literal replay of adjusting a text box in a design tool, rather than a
  // decorative crossfade. Skipped entirely under reduced motion (the markup
  // already shows a static first phrase with no selection/caret visible).
  (function () {
    const band = document.querySelector(".statement-band");
    const line2Inner = document.getElementById("statementLine2Inner");
    const typedEl = document.getElementById("statementTyped");
    const selectionEl = document.getElementById("statementSelection");
    const caretEl = document.getElementById("statementCaret");
    const cursor = document.getElementById("heroCursor");
    if (!band || !line2Inner || !typedEl || !selectionEl || !caretEl || !cursor) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const PHRASES = [
      "finding patterns hiding inside hard problems.",
      "turning ambiguity into something tangible.",
      "leading with research to develop magical experiences.",
    ];
    const DWELL_AFTER_TYPE = 1400;
    const MOVE_DURATION = 280;
    const SELECT_DURATION = 420;
    const DWELL_SELECTED = 250;
    const DELETE_DURATION = 130;
    const TYPE_DELAY_MIN = 20;
    const TYPE_DELAY_MAX = 44;
    const REST_OFFSET_Y = 34;

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Fix the line to the width of its longer phrase so it never reflows
    // the page mid-type — text grows from a fixed left edge instead of the
    // whole block re-centering as it's typed.
    const sizeLine = () => {
      const probe = document.createElement("span");
      const cs = getComputedStyle(typedEl);
      probe.style.cssText =
        "position:absolute;visibility:hidden;white-space:nowrap;top:-9999px;left:-9999px;";
      probe.style.font = cs.font;
      probe.style.letterSpacing = cs.letterSpacing;
      document.body.appendChild(probe);
      let max = 0;
      PHRASES.forEach((p) => {
        probe.textContent = p;
        max = Math.max(max, probe.getBoundingClientRect().width);
      });
      document.body.removeChild(probe);
      line2Inner.style.width = Math.ceil(max) + "px";
      if (layoutHeroFrame) layoutHeroFrame();
    };
    sizeLine();
    window.addEventListener("resize", sizeLine);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeLine);

    const bandRelative = (rect) => {
      const bandRect = band.getBoundingClientRect();
      return { x: rect.left - bandRect.left, y: rect.top - bandRect.top, w: rect.width, h: rect.height };
    };
    const textMidY = () => {
      const r = bandRelative(typedEl.getBoundingClientRect());
      return r.y + r.h / 2;
    };
    const textStartX = () => bandRelative(typedEl.getBoundingClientRect()).x;
    const textEndX = () => {
      const r = bandRelative(typedEl.getBoundingClientRect());
      return r.x + r.w;
    };
    // Position relative to line2Inner's own box rather than assuming the
    // text starts flush at its left edge — needed since the text is
    // centered within the (fixed-width) line, not left-anchored.
    const localTextEdges = () => {
      const c = line2Inner.getBoundingClientRect();
      const t = typedEl.getBoundingClientRect();
      return { left: t.left - c.left, right: t.right - c.left, width: t.width };
    };
    // One fixed idle spot, anchored to the (fixed-width) line box itself —
    // not to the current text — so it's identical whether the line is full,
    // empty, or mid-type, instead of drifting between two places.
    const restPoint = () => {
      const r = bandRelative(line2Inner.getBoundingClientRect());
      return { x: r.x + r.w / 2 - 11, y: r.y + r.h / 2 + REST_OFFSET_Y };
    };
    const placeCursor = (x, y, durationMs) => {
      cursor.style.transitionDuration = durationMs + "ms";
      cursor.style.left = x + "px";
      cursor.style.top = y + "px";
    };
    const click = async () => {
      cursor.classList.add("is-clicking");
      await wait(220);
      cursor.classList.remove("is-clicking");
    };

    const selectLine = async () => {
      const y = textMidY();
      placeCursor(textStartX() - 6, y, MOVE_DURATION);
      cursor.classList.add("is-ready");
      await wait(MOVE_DURATION + 80);
      await click();
      const edges = localTextEdges();
      selectionEl.style.transitionDuration = SELECT_DURATION + "ms";
      selectionEl.style.opacity = "1";
      selectionEl.style.left = edges.left + "px";
      selectionEl.style.width = edges.width + "px";
      placeCursor(textEndX() + 4, y, SELECT_DURATION);
      await wait(SELECT_DURATION);
      await wait(DWELL_SELECTED);
    };

    const deleteLine = async () => {
      typedEl.style.transitionDuration = DELETE_DURATION + "ms";
      typedEl.style.opacity = "0";
      selectionEl.style.transitionDuration = DELETE_DURATION + "ms";
      selectionEl.style.opacity = "0";
      await wait(DELETE_DURATION);
      typedEl.textContent = "";
      typedEl.style.opacity = "1";
      selectionEl.style.width = "0px";
      if (layoutHeroFrame) layoutHeroFrame();
      // Line's empty now — step the cursor to the one fixed rest spot
      // instead of leaving it parked at the old (now-deleted) text's edge.
      const rest = restPoint();
      placeCursor(rest.x, rest.y, MOVE_DURATION);
      await wait(MOVE_DURATION + 180);
    };

    const typeLine = async (text) => {
      const y = textMidY();
      placeCursor(textStartX() - 6, y, MOVE_DURATION);
      await wait(MOVE_DURATION);
      await click();
      caretEl.style.left = localTextEdges().right + "px";
      caretEl.classList.add("is-visible");
      // Caret's placed — hand off to the keyboard and step back to rest for
      // the whole typed stretch, instead of hovering over each character.
      const rest = restPoint();
      placeCursor(rest.x, rest.y, MOVE_DURATION);
      for (let i = 0; i < text.length; i++) {
        typedEl.textContent += text[i];
        caretEl.style.left = localTextEdges().right + "px";
        if (layoutHeroFrame) layoutHeroFrame();
        await wait(TYPE_DELAY_MIN + Math.random() * (TYPE_DELAY_MAX - TYPE_DELAY_MIN));
      }
      await wait(220);
      caretEl.classList.remove("is-visible");
      // Cursor already stepped back to rest before typing started — stays put.
    };

    (async () => {
      let idx = 0; // .statement-typed already renders PHRASES[0] server-side
      // Give layout a beat to settle (fonts, initial frame box) before moving.
      await wait(700);
      while (true) {
        await wait(DWELL_AFTER_TYPE);
        await selectLine();
        await deleteLine();
        idx = (idx + 1) % PHRASES.length;
        await typeLine(PHRASES[idx]);
      }
    })();
  })();

  // Case-study hero(s): click / arrow keys / dots cycle through screenshots.
  document.querySelectorAll(".case-hero-viewer").forEach((heroViewer) => {
    // Slides are normally <img>. A carousel awaiting artwork can use
    // .hero-slide placeholders instead — they cycle the same way.
    const imgs = Array.from(heroViewer.querySelectorAll("img, .hero-slide"));
    if (!imgs.length) return;
    const figure = heroViewer.closest(".case-hero");
    const dots = Array.from(figure.querySelectorAll(".case-hero-dots .dot"));
    const counterEl = figure.querySelector(".hero-counter");
    const captionEl = figure.querySelector(".hero-cap-text");
    let idx = 0;

    const cropFractionFor = (img) =>
      (img.src || "").indexOf("final-bottlecap") !== -1 ? 0.035 : 0;
    const applyRatio = (img) => {
      const crop = cropFractionFor(img);
      heroViewer.style.aspectRatio =
        img.naturalWidth + " / " + img.naturalHeight * (1 - crop);
    };
    const setRatio = (img) => {
      if (img.naturalWidth && img.naturalHeight) {
        applyRatio(img);
      } else {
        img.addEventListener("load", () => applyRatio(img), { once: true });
      }
    };

    const setActive = (next) => {
      idx = ((next % imgs.length) + imgs.length) % imgs.length;
      imgs.forEach((img, i) => img.classList.toggle("active", i === idx));
      dots.forEach((dot, i) => dot.classList.toggle("active", i === idx));
      if (counterEl) {
        counterEl.textContent =
          String(idx + 1).padStart(2, "0") + " / " + String(imgs.length).padStart(2, "0");
      }
      if (captionEl) captionEl.innerHTML = imgs[idx].dataset.caption || imgs[idx].alt;
      setRatio(imgs[idx]);
    };

    heroViewer.addEventListener("click", () => setActive(idx + 1));
    heroViewer.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
        e.preventDefault();
        setActive(idx + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActive(idx - 1);
      }
    });
    dots.forEach((dot, i) => {
      dot.addEventListener("click", (e) => {
        e.stopPropagation();
        setActive(i);
      });
    });

    const prevBtn = figure.querySelector(".hero-nav-prev");
    const nextBtn = figure.querySelector(".hero-nav-next");
    if (prevBtn) {
      prevBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setActive(idx - 1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setActive(idx + 1);
      });
    }

    setActive(0);
  });

  // Cursor-driven tilt for case-study device mocks — each device subtly
  // rotates toward the visitor's cursor as they move across the page.
  const tiltDevices = document.querySelectorAll(
    ".card-media-3d .device, .card-media-3d .laptop, .card-media-3d .tablet, .card-media-3d .phone"
  );
  if (
    tiltDevices.length &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    let raf = null;
    let mx = 0, my = 0;
    document.addEventListener(
      "mousemove",
      (e) => {
        mx = e.clientX;
        my = e.clientY;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          tiltDevices.forEach((device) => {
            const rect = device.getBoundingClientRect();
            // Skip offscreen devices
            if (rect.bottom < -100 || rect.top > window.innerHeight + 100) return;
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = mx - cx;
            const dy = my - cy;
            const dist = Math.hypot(dx, dy);
            const maxDist = 700;
            const intensity = Math.max(0, 1 - dist / maxDist);
            const tiltY = (-dx / 80) * intensity;
            const tiltX = (dy / 80) * intensity;
            device.style.setProperty("--tilt-x", tiltX.toFixed(2) + "deg");
            device.style.setProperty("--tilt-y", tiltY.toFixed(2) + "deg");
          });
          raf = null;
        });
      },
      { passive: true }
    );
  }

  // Custom cursor — replaces the native pointer with a coral arrow + "me" pill.
  // Skipped on case-study pages so deep-read views keep the standard cursor.
  if (
    window.matchMedia("(pointer: fine)").matches &&
    !document.body.classList.contains("case-study-page")
  ) {
    const cursor = document.createElement("div");
    cursor.className = "custom-cursor hidden";
    cursor.setAttribute("aria-hidden", "true");
    cursor.innerHTML =
      '<svg viewBox="0 0 16 16">' +
      '<path d="M2 1 L2 13 L5.5 10 L7.8 14.2 L9.6 13.4 L7.3 9.2 L11.5 9.2 Z" ' +
      'fill="#ff6b5b" stroke="#fff" stroke-width="0.8" stroke-linejoin="round" />' +
      "</svg>" +
      '<span class="custom-cursor-pill">me</span>';
    document.body.appendChild(cursor);

    let mx = 0, my = 0;
    let frame = null;
    document.addEventListener(
      "mousemove",
      (e) => {
        mx = e.clientX;
        my = e.clientY;
        cursor.classList.remove("hidden");
        if (frame) return;
        frame = requestAnimationFrame(() => {
          cursor.style.transform =
            "translate3d(" + (mx - 3) + "px, " + (my - 1) + "px, 0)";
          frame = null;
        });
      },
      { passive: true }
    );
    document.addEventListener("mouseleave", () => cursor.classList.add("hidden"));
    document.addEventListener("mouseenter", () => cursor.classList.remove("hidden"));
  }
})();

// Click-to-enlarge lightbox for case study photos.
(function () {
  const lightbox = document.getElementById("lightbox");
  if (!lightbox) return;
  const lightboxImg = document.getElementById("lightboxImg");
  const closeBtn = lightbox.querySelector(".lightbox-close");

  const open = (src, alt) => {
    lightboxImg.src = src;
    lightboxImg.alt = alt || "";
    lightbox.hidden = false;
    requestAnimationFrame(() => lightbox.classList.add("open"));
    document.body.style.overflow = "hidden";
  };
  const close = () => {
    lightbox.classList.remove("open");
    document.body.style.overflow = "";
    setTimeout(() => {
      lightbox.hidden = true;
    }, 240);
  };

  document
    .querySelectorAll(
      ".case-media-board img, .case-media-crop img, img.case-media-inline, img.case-media-tile"
    )
    .forEach((img) => {
      img.addEventListener("click", () => open(img.src, img.alt));
    });

  closeBtn.addEventListener("click", close);
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightbox.classList.contains("open")) close();
  });
})();

// Case-study jump nav — highlights whichever section is currently in view,
// matching the solid-pill "active" treatment on the site's main nav.
(function () {
  const toc = document.querySelector(".case-side-nav");
  if (!toc) return;
  const links = Array.from(toc.querySelectorAll("a[href^='#']"));
  const sections = links
    .map((a) => document.getElementById(a.getAttribute("href").slice(1)))
    .filter(Boolean);
  if (!sections.length || !("IntersectionObserver" in window)) return;

  const setActive = (id) => {
    links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + id));
  };

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
  );
  sections.forEach((section) => io.observe(section));

  // The nav is position:fixed and hidden by default (see styles.css) so it
  // never appears above "What is Optimizely?" on first load. Once the
  // reader has scrolled past the hero + "What I did" lead a single time,
  // reveal it for good — scrolling back up to re-read the hero shouldn't
  // make it disappear again.
  const lead = document.querySelector(".case-hero-lead");
  if (lead && "IntersectionObserver" in window) {
    const leadIo = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.boundingClientRect.bottom <= 0) {
            toc.classList.add("visible");
            leadIo.disconnect();
          }
        });
      },
      { threshold: 0 }
    );
    leadIo.observe(lead);
  } else {
    toc.classList.add("visible");
  }
})();
