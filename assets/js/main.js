/* Cooper Technology Group: interaction layer
   Vanilla JS, no framework. Every effect degrades to a readable static page. */
(function () {
  "use strict";

  var doc = document.documentElement;
  var body = document.body;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var desktop = window.matchMedia("(min-width: 900px)");
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { window.sessionStorage.removeItem(k); } catch (e) {} }
  };

  /* ------------------------------------------------------------------
     Smooth scroll (Lenis, when available and appropriate)
     ------------------------------------------------------------------ */
  var lenis = null;
  if (!reduce && window.Lenis && finePointer) {
    lenis = new window.Lenis({ duration: 1.15, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true });
    var raf = function (time) { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  var scrollY = function () { return window.scrollY || window.pageYOffset; };
  var onScroll = function (fn) {
    if (lenis) lenis.on("scroll", fn);
    window.addEventListener("scroll", fn, { passive: true });
  };

  /* Anchor links scroll smoothly */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (id.length < 2) return;
      var t = document.getElementById(id.slice(1));
      if (!t) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(t, { offset: -70 });
      else t.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      t.setAttribute("tabindex", "-1");
      t.focus({ preventScroll: true });
    });
  });

  /* ------------------------------------------------------------------
     Page transitions
     ------------------------------------------------------------------ */
  function revealPage() {
    body.classList.add("is-loaded");
    if (doc.classList.contains("is-entering")) {
      requestAnimationFrame(function () {
        // Paint the covered state before starting the incoming curtain motion.
        requestAnimationFrame(function () {
          doc.classList.add("is-entered");
          doc.classList.remove("is-entering");
          setTimeout(function () { doc.classList.remove("is-entered"); }, 1100);
        });
      });
    }
  }
  revealPage();
  store.del("ctg-transition");

  $$("a[href]").forEach(function (a) {
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#" || /^(mailto|tel|sms|https?):/i.test(href) || a.target === "_blank" || a.hasAttribute("download")) return;
    if (href !== "/" && !/\.html(#.*)?$/.test(href)) return;
    a.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (reduce) return;
      e.preventDefault();
      store.set("ctg-transition", "1");
      doc.classList.add("is-leaving");
      if (body.classList.contains("menu-open")) setMenu(false);
      setTimeout(function () { window.location.href = href; }, 620);
    });
  });
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) {
      doc.classList.remove("is-leaving", "is-entering");
      if (toggle && menu) setMenu(false);
    }
  });

  /* ------------------------------------------------------------------
     Navigation
     ------------------------------------------------------------------ */
  var nav = $(".nav");
  var lastY = scrollY();
  function navState() {
    var y = scrollY();
    if (!nav) return;
    nav.classList.toggle("is-scrolled", y > 40);
    if (!body.classList.contains("menu-open")) {
      var down = y > lastY + 4, up = y < lastY - 4;
      if (down && y > 700) nav.classList.add("is-hidden");
      else if (up || y < 700) nav.classList.remove("is-hidden");
    }
    lastY = y;
  }
  navState();
  onScroll(navState);

  var toggle = $(".nav__toggle");
  var menu = $("#menu");
  function setMenu(open) {
    body.classList.toggle("menu-open", open);
    $$("main, footer").forEach(function (element) { element.inert = open; });
    toggle.setAttribute("aria-expanded", String(open));
    toggle.querySelector("span").textContent = open ? "Close" : "Menu";
    menu.setAttribute("aria-hidden", String(!open));
    if (open) { menu.removeAttribute("inert"); nav.classList.remove("is-hidden"); if (lenis) lenis.stop(); else body.style.overflow = "hidden"; var f = $("a", menu); if (f) f.focus({ preventScroll: true }); }
    else { menu.setAttribute("inert", ""); if (lenis) lenis.start(); else body.style.overflow = ""; }
  }
  if (toggle && menu) {
    menu.setAttribute("inert", "");
    toggle.addEventListener("click", function () { setMenu(!body.classList.contains("menu-open")); });
    window.matchMedia("(min-width: 1100px)").addEventListener("change", function (event) {
      if (event.matches && body.classList.contains("menu-open")) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (!body.classList.contains("menu-open")) return;
      if (e.key === "Escape") { setMenu(false); toggle.focus(); }
      if (e.key === "Tab") {
        var stops = [toggle].concat($$('a[href], button:not(:disabled)', menu));
        var current = stops.indexOf(document.activeElement);
        if (current === -1 || (!e.shiftKey && current === stops.length - 1) || (e.shiftKey && current === 0)) {
          e.preventDefault(); stops[e.shiftKey ? stops.length - 1 : 0].focus();
        }
      }
    });
  }

  /* ------------------------------------------------------------------
     Word masking for headlines
     ------------------------------------------------------------------ */
  function splitWords(el) {
    var i = 0;
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var parts = child.textContent.split(/([ \t\n\r]+)/);
          var frag = document.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^[ \t\n\r]+$/.test(p)) { frag.appendChild(document.createTextNode(" ")); return; }
            var w = document.createElement("span"); w.className = "w";
            var inner = document.createElement("span"); inner.textContent = p; inner.style.setProperty("--i", i++);
            w.appendChild(inner); frag.appendChild(w);
          });
          child.parentNode.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== "BR") { walk(child); }
      });
    };
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    walk(el);
    $$(".w", el).forEach(function (w) { w.setAttribute("aria-hidden", "true"); });
  }
  if (!reduce) $$("[data-split]").forEach(splitWords);

  /* ------------------------------------------------------------------
     Reveal on view
     ------------------------------------------------------------------ */
  var revealTargets = $$("[data-reveal], [data-split], .media[data-img], .log, [data-count]");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        var delay = parseInt(el.getAttribute("data-delay") || "0", 10);
        var go = function () {
          el.classList.add("is-in");
          if (el.hasAttribute("data-count")) countUp(el);
        };
        // hold first-screen reveals until the page is visible
        if (!body.classList.contains("is-loaded")) {
          var wait = setInterval(function () { if (body.classList.contains("is-loaded")) { clearInterval(wait); setTimeout(go, delay + 250); } }, 50);
        } else setTimeout(go, delay);
        io.unobserve(el);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    revealTargets.forEach(function (el) { io.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ------------------------------------------------------------------
     Counters
     ------------------------------------------------------------------ */
  function countUp(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var dur = 1600, t0 = null;
    var fmt = function (v) { return Math.round(v).toString(); };
    var step = function (t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - p, 4);
      el.firstChild.nodeValue = fmt(target * e);
      if (p < 1) requestAnimationFrame(step);
    };
    if (el.firstChild && el.firstChild.nodeType === 3) requestAnimationFrame(step);
  }

  /* ------------------------------------------------------------------
     Parallax + horizontal track (one rAF loop)
     ------------------------------------------------------------------ */
  var para = reduce ? [] : $$("[data-parallax]");
  var hs = $(".hs");
  var hsTrack = hs ? $(".hs__track", hs) : null;
  var hsBar = hs ? $(".hs__progress i", hs) : null;
  var hsActive = false, hsDist = 0;

  function sizeHs() {
    if (!hs) return;
    hsActive = desktop.matches && !reduce;
    if (!hsActive) { hs.style.height = ""; hsTrack.style.transform = ""; return; }
    hsDist = Math.max(0, hsTrack.scrollWidth - window.innerWidth);
    hs.style.height = (window.innerHeight + hsDist) + "px";
  }
  var ticking = false;
  function frame() {
    ticking = false;
    var vh = window.innerHeight;
    para.forEach(function (img) {
      var host = img.closest(".media") || img.parentElement;
      var r = host.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      var speed = parseFloat(img.getAttribute("data-parallax")) || 0.1;
      var off = (r.top + r.height / 2 - vh / 2) * -speed;
      img.style.transform = "translate3d(0," + off.toFixed(1) + "px,0)";
    });
    if (hs && hsActive) {
      var r2 = hs.getBoundingClientRect();
      var total = hs.offsetHeight - vh;
      var p = Math.min(1, Math.max(0, -r2.top / (total || 1)));
      hsTrack.style.transform = "translate3d(" + (-p * hsDist).toFixed(1) + "px,0,0)";
      if (hsBar) hsBar.style.transform = "scaleX(" + p.toFixed(4) + ")";
    }
  }
  function requestFrame() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  if (para.length || hs) {
    sizeHs(); frame();
    onScroll(requestFrame);
    window.addEventListener("resize", function () { sizeHs(); requestFrame(); });
    window.addEventListener("load", function () { sizeHs(); requestFrame(); });
  }

  /* ------------------------------------------------------------------
     Generic tabs (roving focus, arrow keys)
     ------------------------------------------------------------------ */
  function tabs(list, onSelect) {
    var btns = $$('[role="tab"]', list);
    var select = function (btn, focus) {
      btns.forEach(function (b) {
        var on = b === btn;
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
        var pid = b.getAttribute("aria-controls");
        var panel = pid && document.getElementById(pid);
        if (panel) { panel.classList.toggle("is-active", on); if (panel.hasAttribute("data-hide")) panel.hidden = !on; }
      });
      if (focus) btn.focus();
      if (onSelect) onSelect(btn, btns.indexOf(btn));
    };
    btns.forEach(function (b) {
      b.addEventListener("click", function () { select(b); list.dispatchEvent(new CustomEvent("tabs:user")); });
      b.addEventListener("keydown", function (e) {
        var i = btns.indexOf(b), n = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") n = btns[(i + 1) % btns.length];
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = btns[(i - 1 + btns.length) % btns.length];
        if (e.key === "Home") n = btns[0];
        if (e.key === "End") n = btns[btns.length - 1];
        if (n) { e.preventDefault(); select(n, true); list.dispatchEvent(new CustomEvent("tabs:user")); }
      });
    });
    var cur = btns.filter(function (b) { return b.getAttribute("aria-selected") === "true"; })[0] || btns[0];
    if (cur) select(cur);
    return { select: select, btns: btns };
  }

  /* Auto-advance helper: cycles while in view until the visitor takes over */
  function autoCycle(root, api, ms) {
    if (reduce || !api.btns.length) return;
    var timer = null, user = false, visible = false;
    var next = function () {
      var i = api.btns.findIndex(function (b) { return b.getAttribute("aria-selected") === "true"; });
      api.select(api.btns[(i + 1) % api.btns.length]);
    };
    var run = function () { clearInterval(timer); if (visible && !user) timer = setInterval(next, ms); };
    root.addEventListener("tabs:user", function () { user = true; clearInterval(timer); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; run(); }, { threshold: 0.35 }).observe(root);
    }
  }

  /* ------------------------------------------------------------------
     Home: services switcher
     ------------------------------------------------------------------ */
  var sw = $(".switcher");
  if (sw) {
    var items = $$(".switcher__item", sw);
    var imgs = $$(".switcher__img", sw);
    var panels = $$(".switcher__panel", sw);
    var swUser = false, swTimer = null, swVisible = false;
    var activate = function (i) {
      items.forEach(function (b, j) { b.classList.toggle("is-active", i === j); b.setAttribute("aria-pressed", String(i === j)); });
      imgs.forEach(function (m, j) { m.classList.toggle("is-active", i === j); });
      panels.forEach(function (p, j) { p.hidden = i !== j; p.classList.remove("is-showing"); if (i === j) { void p.offsetWidth; p.classList.add("is-showing"); } });
    };
    items.forEach(function (b, i) {
      if (finePointer) b.addEventListener("mouseenter", function () { swUser = true; clearInterval(swTimer); activate(i); });
      b.addEventListener("focus", function () { swUser = true; clearInterval(swTimer); activate(i); });
      b.addEventListener("click", function () { swUser = true; clearInterval(swTimer); activate(i); });
    });
    activate(0);
    if (!reduce && "IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        swVisible = en[0].isIntersecting; clearInterval(swTimer);
        if (swVisible && !swUser) swTimer = setInterval(function () {
          var cur = items.findIndex(function (b) { return b.classList.contains("is-active"); });
          activate((cur + 1) % items.length);
        }, 4200);
      }, { threshold: 0.4 }).observe(sw);
    }
  }

  /* ------------------------------------------------------------------
     Home: scenes
     ------------------------------------------------------------------ */
  var sc = $(".scenes");
  if (sc) {
    var view = $(".scenes__view", sc);
    var veil = $(".scenes__veil", sc);
    var shade = $(".scenes__shade", sc);
    var hud = $$(".scenes__hud [data-k]", sc);
    var list = $(".scenes__tabs", sc);
    var api = tabs(list, function (btn) {
      var d = btn.dataset;
      veil.style.opacity = d.veil;
      shade.style.height = d.shade + "%";
      hud.forEach(function (h) {
        var v = d[h.getAttribute("data-k")];
        if (h.textContent === v) return;
        h.style.opacity = 0;
        setTimeout(function () { h.textContent = v; h.style.opacity = 1; }, 220);
      });
      view.setAttribute("aria-label", "Scene preview: " + btn.querySelector("strong").textContent);
    });
    autoCycle(list, api, 3800);
  }

  /* ------------------------------------------------------------------
     Residential: a day in the house
     ------------------------------------------------------------------ */
  var day = $(".day");
  if (day) {
    var dImgs = $$(".day__img", day);
    var clock = $(".day__clock", day);
    var bar = $(".day__bar i", day);
    var dList = $(".day__list", day);
    var dApi = tabs(dList, function (btn, i) {
      dImgs.forEach(function (m) { m.classList.toggle("is-active", m.getAttribute("data-img-key") === btn.dataset.img); });
      clock.textContent = btn.dataset.time;
      bar.style.width = ((i + 1) / dApi_len()) * 100 + "%";
    });
    function dApi_len() { return $$('[role="tab"]', dList).length; }
    autoCycle(dList, dApi, 4200);
  }

  /* ------------------------------------------------------------------
     Disclosure / accordions
     ------------------------------------------------------------------ */
  $$("[data-disclose]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var open = btn.getAttribute("aria-expanded") === "true";
      var group = btn.closest("[data-accordion]");
      if (group && !open) {
        $$("[data-disclose]", group).forEach(function (b) { if (b !== btn) b.setAttribute("aria-expanded", "false"); });
      }
      btn.setAttribute("aria-expanded", String(!open));
      setTimeout(function () { if (hs) sizeHs(); if (lenis) lenis.resize(); }, 850);
    });
  });

  /* About timeline, commercial index */
  $$("[data-tabs]").forEach(function (list) {
    var api = tabs(list);
    if (list.hasAttribute("data-auto")) autoCycle(list, api, parseInt(list.getAttribute("data-auto"), 10));
  });

  /* Commercial: sector hover list */
  var sl = $(".sectors-c");
  if (sl) {
    var sImgs = $$(".sectors-c__view .media", sl);
    $$(".sectorlist li", sl).forEach(function (li, i) {
      var on = function () {
        $$(".sectorlist li", sl).forEach(function (x, j) { x.classList.toggle("is-active", i === j); });
        sImgs.forEach(function (m, j) { m.classList.toggle("is-active", i === j); });
      };
      li.addEventListener("mouseenter", on);
      li.addEventListener("focusin", on);
    });
  }

  /* ------------------------------------------------------------------
     Services page: segmented switch + cursor image
     ------------------------------------------------------------------ */
  var seg = $(".seg");
  if (seg) {
    var pill = $(".seg__pill", seg);
    var place = function (btn) { pill.style.width = btn.offsetWidth + "px"; pill.style.transform = "translateX(" + (btn.offsetLeft - 4.8) + "px)"; };
    tabs(seg, function (btn) {
      place(btn);
      setTimeout(function () { if (lenis) lenis.resize(); }, 60);
    });
    window.addEventListener("resize", function () { place($('[aria-selected="true"]', seg)); });
    if (document.fonts) document.fonts.ready.then(function () { place($('[aria-selected="true"]', seg)); });
    var h = (window.location.hash || "").slice(1);
    if (h === "commercial") { var cb = $('[aria-controls="svc-commercial"]', seg); if (cb) cb.click(); }
  }
  var ci = $(".cursor-img");
  if (ci && finePointer) {
    var cx = 0, cy = 0, tx = 0, ty = 0, on = false;
    var loop = function () {
      cx += (tx - cx) * 0.16; cy += (ty - cy) * 0.16;
      ci.style.left = cx + "px"; ci.style.top = cy + "px";
      if (on || Math.abs(tx - cx) > .5) requestAnimationFrame(loop);
    };
    $$(".slist__btn").forEach(function (b) {
      b.addEventListener("mouseenter", function (e) {
        if (b.getAttribute("aria-expanded") === "true") return;
        $$("img", ci).forEach(function (im) { im.classList.toggle("is-active", im.getAttribute("data-key") === b.dataset.img); });
        tx = cx = e.clientX; ty = cy = e.clientY; on = true; ci.classList.add("is-on"); requestAnimationFrame(loop);
      });
      b.addEventListener("mousemove", function (e) { tx = e.clientX; ty = e.clientY; });
      b.addEventListener("mouseleave", function () { on = false; ci.classList.remove("is-on"); });
      b.addEventListener("click", function () { on = false; ci.classList.remove("is-on"); });
    });
  }

  /* ------------------------------------------------------------------
     Journal filters
     ------------------------------------------------------------------ */
  var filters = $$(".filter");
  if (filters.length) {
    filters.forEach(function (f) {
      f.addEventListener("click", function () {
        var cat = f.getAttribute("data-filter");
        filters.forEach(function (x) { x.setAttribute("aria-pressed", String(x === f)); });
        $$(".post").forEach(function (p) {
          var show = cat === "all" || p.getAttribute("data-cat") === cat;
          p.classList.toggle("is-hidden", !show);
          if (show) { $$(".media[data-img]", p).forEach(function (m) { m.classList.add("is-in"); }); p.classList.add("is-in"); }
        });
        var count = $$(".post:not(.is-hidden)").length;
        var out = $("#filter-count"); if (out) out.textContent = count + (count === 1 ? " article" : " articles");
        if (lenis) lenis.resize();
      });
    });
  }

  /* Copy phone number */
  $$("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () {
      var txt = b.getAttribute("data-copy");
      var label = b.querySelector("span") || b;
      var done = function () { var o = label.textContent; label.textContent = "Copied"; setTimeout(function () { label.textContent = o; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, function () {});
    });
  });

  /* Image pins: map photo coordinates through object-fit: cover */
  var pinSets = $$("[data-pins]");
  if (pinSets.length) {
    var placePins = function () {
      pinSets.forEach(function (set) {
        var box = set.parentNode, im = $("img", box);
        if (!im) return;
        var iw = im.naturalWidth || +im.getAttribute("width"), ih = im.naturalHeight || +im.getAttribute("height");
        var br = box.getBoundingClientRect(), r = im.getBoundingClientRect();
        var k = Math.max(r.width / iw, r.height / ih), dw = iw * k, dh = ih * k;
        var ox = r.left - br.left + (r.width - dw) / 2, oy = r.top - br.top + (r.height - dh) / 2;
        $$(".pin", set).forEach(function (p) {
          var x = ox + parseFloat(p.dataset.x) * dw, y = oy + parseFloat(p.dataset.y) * dh;
          var inside = x > 12 && x < br.width - 12 && y > 12 && y < br.height - 12;
          p.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
          var lab = p.lastElementChild, lw = lab ? lab.offsetWidth : 0;
          var fitsL = x - 26 - lw > 12, fitsR = x + 26 + lw < br.width - 12;
          var below = !fitsL && !fitsR;
          p.classList.toggle("is-left", !below && fitsL && (p.dataset.side === "left" || !fitsR));
          p.classList.toggle("is-below", below);
          if (lab) lab.style.left = below ? (Math.min(Math.max(x - lw / 2, 12), br.width - 12 - lw) - x).toFixed(1) + "px" : "";
          p.classList.toggle("is-on", inside);
        });
      });
    };
    var pinTick = false;
    var queuePins = function () { if (!pinTick) { pinTick = true; requestAnimationFrame(function () { pinTick = false; placePins(); }); } };
    onScroll(queuePins);
    window.addEventListener("resize", queuePins);
    pinSets.forEach(function (s) { var im = $("img", s.parentNode); if (im && !im.complete) im.addEventListener("load", queuePins); });
    placePins(); setTimeout(placePins, 400); setTimeout(placePins, 1600);
  }

  window.ctgReady = true;

  /* Footer logo: play the cable animation when it scrolls into view; nav logo replays on hover */
  var footLogo = $(".logo--onview");
  if (footLogo && "IntersectionObserver" in window) {
    var lio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { footLogo.classList.add("is-in"); lio.disconnect(); } }); }, { threshold: 0.35 });
    lio.observe(footLogo);
  } else if (footLogo) footLogo.classList.add("is-in");
  var navLogo = $(".brand__logo");
  if (navLogo && !reduce) {
    $(".brand").addEventListener("mouseenter", function () {
      var parts = $$(".logo__draw, .logo__plug", navLogo);
      if (parts.some(function (p) { return p.getAnimations && p.getAnimations().some(function (a) { return a.playState === "running"; }); })) return;
      parts.forEach(function (p) { p.style.animation = "none"; p.getBBox && p.getBBox(); });
      requestAnimationFrame(function () { parts.forEach(function (p) { p.style.animation = ""; }); });
    });
  }
})();
