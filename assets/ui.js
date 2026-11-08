(() => {
  "use strict";

  const html = document.documentElement;
  const getTheme = () => html.dataset.theme === "dark" ? "dark" : "light";

  const themeButton = () => {
    const button = document.createElement("button");
    button.className = "theme-toggle";
    button.type = "button";
    button.dataset.themeToggle = "";
    button.title = "تبديل المظهر";
    button.innerHTML = '<span class="theme-toggle-icon" aria-hidden="true">☾</span><span class="theme-toggle-label">الوضع الداكن</span>';
    return button;
  };

  const updateThemeControls = () => {
    const dark = getTheme() === "dark";
    let themeColor = document.querySelector('meta[name="theme-color"]');
    if (!themeColor) {
      themeColor = document.createElement("meta");
      themeColor.name = "theme-color";
      document.head.append(themeColor);
    }
    themeColor.content = dark ? "#101b29" : "#f4f8fc";
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      const icon = button.querySelector(".theme-toggle-icon");
      const label = button.querySelector(".theme-toggle-label");
      if (icon) icon.textContent = dark ? "☀" : "☾";
      if (label) label.textContent = dark ? "الوضع الفاتح" : "الوضع الداكن";
      button.setAttribute("aria-label", dark ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن");
      button.setAttribute("aria-pressed", String(dark));
    });
  };

  const setTheme = (theme) => {
    html.dataset.theme = theme;
    try { localStorage.setItem("philo-theme", theme); } catch (_) { /* Storage may be blocked. */ }
    updateThemeControls();
  };

  // Lesson pages share one compact header without changing their standalone content.
  const sitebar = document.querySelector(".sitebar .wrap");
  if (sitebar) {
    const oldHome = sitebar.querySelector("a");
    const oldCrumb = [...sitebar.children].find((node) => node.tagName === "SPAN");
    const brand = document.createElement("a");
    brand.className = "sitebar-brand";
    brand.href = "../index.html";
    brand.setAttribute("aria-label", "العودة إلى الصفحة الرئيسية");
    brand.innerHTML = '<span class="brand-symbol" aria-hidden="true">ف</span><span class="brand-copy">الفلسفة<small>مساحة المراجعة الشخصية</small></span>';

    const crumbs = document.createElement("div");
    crumbs.className = "sitebar-breadcrumbs";
    const home = oldHome || document.createElement("a");
    home.href = "../index.html";
    home.textContent = "الرئيسية";
    home.className = "site-home-link";
    crumbs.append(home);
    if (oldCrumb && oldCrumb.textContent.trim()) {
      const text = document.createElement("span");
      text.textContent = oldCrumb.textContent.trim().replace(/^\/+/, "");
      crumbs.append(text);
    }

    const actions = document.createElement("div");
    actions.className = "sitebar-actions";
    actions.append(themeButton());
    sitebar.replaceChildren(brand, crumbs, actions);
  }

  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", () => setTheme(getTheme() === "dark" ? "light" : "dark"));
  });
  updateThemeControls();

  // Reading progress, section highlighting and a discreet return-to-top control.
  const contentsNav = document.querySelector(".topnav");
  if (contentsNav) {
    const progress = document.createElement("div");
    progress.className = "reading-progress";
    progress.setAttribute("aria-hidden", "true");
    progress.innerHTML = "<span></span>";
    document.body.append(progress);

    const backToTop = document.createElement("button");
    backToTop.className = "back-to-top";
    backToTop.type = "button";
    backToTop.textContent = "↑";
    backToTop.setAttribute("aria-label", "العودة إلى أعلى الصفحة");
    backToTop.title = "العودة إلى الأعلى";
    document.body.append(backToTop);
    backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

    const progressFill = progress.querySelector("span");
    let scrollQueued = false;
    const updateScrollUI = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const percent = Math.min(100, Math.max(0, (window.scrollY / maxScroll) * 100));
      progressFill.style.width = `${percent}%`;
      backToTop.classList.toggle("is-visible", window.scrollY > 420);
      scrollQueued = false;
    };
    window.addEventListener("scroll", () => {
      if (!scrollQueued) {
        scrollQueued = true;
        window.requestAnimationFrame(updateScrollUI);
      }
    }, { passive: true });
    window.addEventListener("resize", updateScrollUI, { passive: true });
    updateScrollUI();

    const navLinks = [...contentsNav.querySelectorAll('a[href^="#"]')];
    const sections = navLinks
      .map((link) => document.getElementById(decodeURIComponent(link.getAttribute("href").slice(1))))
      .filter(Boolean);
    if ("IntersectionObserver" in window && sections.length) {
      const linkById = new Map(navLinks.map((link) => [link.getAttribute("href").slice(1), link]));
      const observer = new IntersectionObserver((entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        navLinks.forEach((link) => {
          const active = link === linkById.get(visible.target.id);
          link.classList.toggle("is-active", active);
          if (active) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      }, { rootMargin: "-22% 0px -66% 0px", threshold: [0, .15, .35, .6] });
      sections.forEach((section) => observer.observe(section));
    }
  }
})();

// Scroll reveal: cards fade in once as they enter the viewport.
(() => {
  "use strict";
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const items = document.querySelectorAll(".quotes li, .theses li, .args li, .ideas li, .problem, .concept");
  if (!items.length) return;
  document.documentElement.classList.add("reveal-on");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: .08 });
  items.forEach((el) => {
    const sibs = el.parentElement ? [...el.parentElement.children] : [el];
    el.style.setProperty("--i", Math.min(sibs.indexOf(el), 5));
    io.observe(el);
  });
})();

// Hero background: drifting particles joined by thin lines (home + lesson headers).
(() => {
  "use strict";
  const host = document.querySelector(".home-hero, header.hero");
  if (!host || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.className = "hero-bg";
  canvas.setAttribute("aria-hidden", "true");
  host.prepend(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let w = 0, h = 0, dpr = 1, dots = [], color = "96,151,199", running = true, tick = 0;
  const mouse = { x: -999, y: -999 };

  const readColor = () => {
    const probe = document.createElement("span");
    probe.style.color = getComputedStyle(document.body).getPropertyValue("--uc").trim()
      || getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#6097c7";
    document.body.appendChild(probe);
    const m = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g);
    probe.remove();
    if (m && m.length >= 3) color = `${m[0]},${m[1]},${m[2]}`;
  };

  const resize = () => {
    const r = host.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(70, Math.round((w * h) / 9000));
    dots = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35,
      r: Math.random() * 1.4 + .7
    }));
  };

  const frame = () => {
    if (!running) return;
    if (tick++ % 90 === 0) readColor();
    ctx.clearRect(0, 0, w, h);
    const link = 120;
    for (let i = 0; i < dots.length; i++) {
      const a = dots[i];
      a.x += a.vx; a.y += a.vy;
      if (a.x < 0 || a.x > w) a.vx *= -1;
      if (a.y < 0 || a.y > h) a.vy *= -1;
      ctx.fillStyle = `rgba(${color},.55)`;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.2832); ctx.fill();
      for (let j = i + 1; j < dots.length; j++) {
        const b = dots[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < link) {
          ctx.strokeStyle = `rgba(${color},${(1 - d / link) * .28})`;
          ctx.lineWidth = .8;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      const dm = Math.hypot(a.x - mouse.x, a.y - mouse.y);
      if (dm < 150) {
        ctx.strokeStyle = `rgba(${color},${(1 - dm / 150) * .4})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
      }
    }
    requestAnimationFrame(frame);
  };

  host.addEventListener("pointermove", (e) => {
    const r = host.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  });
  host.addEventListener("pointerleave", () => { mouse.x = mouse.y = -999; });
  window.addEventListener("resize", resize);

  // Pause when the hero is off-screen or the tab is hidden.
  const start = () => { if (!running) { running = true; requestAnimationFrame(frame); } };
  new IntersectionObserver(([e]) => { if (e.isIntersecting) start(); else running = false; }).observe(host);
  document.addEventListener("visibilitychange", () => { if (document.hidden) running = false; else start(); });

  readColor(); resize(); requestAnimationFrame(frame);
})();
