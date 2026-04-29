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

  // Animated selection cycler — Hannah's cursor "drags" the box to fit each word.
  const cycler = document.querySelector(".selected-word-cycler");
  if (cycler) {
    const words = ["fun", "stories", "brand"];
    const textEl = cycler.querySelector(".selected-word-text");
    const emEl = textEl.querySelector("em");

    // Hidden measurer span — copies the em's font so width measurements are accurate.
    const measure = document.createElement("span");
    measure.setAttribute("aria-hidden", "true");
    measure.style.cssText =
      "position:absolute; visibility:hidden; white-space:nowrap; pointer-events:none; top:0; left:0;";
    document.body.appendChild(measure);

    const syncFont = () => {
      const cs = getComputedStyle(emEl);
      measure.style.font = cs.font;
      measure.style.fontStyle = cs.fontStyle;
      measure.style.fontWeight = cs.fontWeight;
      measure.style.fontSize = cs.fontSize;
      measure.style.fontFamily = cs.fontFamily;
      measure.style.letterSpacing = cs.letterSpacing;
    };

    const padX = () => {
      const cs = getComputedStyle(cycler);
      return (
        parseFloat(cs.paddingLeft) +
        parseFloat(cs.paddingRight) +
        parseFloat(cs.borderLeftWidth) +
        parseFloat(cs.borderRightWidth)
      );
    };

    const widthFor = (word) => {
      syncFont();
      measure.textContent = word;
      // Synthetic italic shears glyphs past the measured advance width, so
      // pad the box width by a fraction of the font-size to fit the overhang.
      const fontSize = parseFloat(getComputedStyle(emEl).fontSize) || 32;
      const italicSlack = Math.ceil(fontSize * 0.28);
      return Math.ceil(measure.getBoundingClientRect().width) + padX() + italicSlack;
    };

    const setWord = (word, animate = true) => {
      if (!animate) {
        const prev = cycler.style.transition;
        cycler.style.transition = "none";
        cycler.style.width = widthFor(word) + "px";
        emEl.textContent = word;
        // Force reflow then restore transition.
        void cycler.offsetWidth;
        cycler.style.transition = prev;
        return;
      }
      cycler.classList.add("dragging");
      emEl.textContent = word;
      cycler.style.width = widthFor(word) + "px";
    };

    cycler.addEventListener("transitionend", (e) => {
      if (e.propertyName === "width") cycler.classList.remove("dragging");
    });

    // Initial size, no animation.
    const initial = () => setWord(words[0], false);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(initial);
    } else {
      initial();
    }

    let i = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      setInterval(() => {
        i = (i + 1) % words.length;
        setWord(words[i]);
      }, 2200);
    }

    // Re-measure on resize so font-size changes (clamp) stay accurate.
    window.addEventListener("resize", () => {
      cycler.style.width = widthFor(emEl.textContent) + "px";
    });
  }

  // Case-study hero(s): click / arrow keys / dots cycle through screenshots.
  document.querySelectorAll(".case-hero-viewer").forEach((heroViewer) => {
    const imgs = Array.from(heroViewer.querySelectorAll("img"));
    const figure = heroViewer.closest(".case-hero");
    const dots = Array.from(figure.querySelectorAll(".case-hero-dots .dot"));
    const counterEl = figure.querySelector(".hero-counter");
    const captionEl = figure.querySelector(".hero-cap-text");
    let idx = 0;

    const cropFractionFor = (img) =>
      img.src.indexOf("final-bottlecap") !== -1 ? 0.035 : 0;
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

  // Sticky top nav — toggle a bottom border once the user scrolls past the top.
  const nav = document.querySelector(".site-nav");
  if (nav) {
    const onScroll = () => {
      nav.classList.toggle("scrolled", window.scrollY > 6);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }
})();
