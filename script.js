const SESSION_KEY = "house-shower-opened";
const STORAGE_KEY = "house-shower-reservations";

/* ─── Utils ─── */
const esc = (t) => { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; };

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3200);
}

function getReservations() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}

function saveReservation(id, name) {
  const r = getReservations();
  r[id] = { name, date: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
}

function clearReservation(id) {
  const r = getReservations();
  delete r[id];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
}

/* ─── Config ─── */
function applyConfig() {
  const c = window.CONFIG;
  if (!c) return;

  const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };

  const heroImg = document.getElementById("hero-img");
  const heroSourceMobile = document.getElementById("hero-img-mobile");
  if (heroImg && c.heroPhoto) heroImg.src = c.heroPhoto;
  if (heroSourceMobile && c.heroPhotoMobile) heroSourceMobile.srcset = c.heroPhotoMobile;
  if (c.heroPhotoPosition) {
    document.documentElement.style.setProperty("--hero-position", c.heroPhotoPosition);
  }
  if (c.heroPhotoMobilePosition) {
    document.documentElement.style.setProperty("--hero-position-mobile", c.heroPhotoMobilePosition);
  }

  set("hero-names", c.hosts);
  set("nav-brand", c.hosts);
  set("signoff-names", c.hosts);
  set("footer-names", c.hosts);
  set("event-date", c.eventDate);
  set("event-time", c.eventTime);
  set("event-address", c.address);
  set("event-neighborhood", c.neighborhood);
  set("event-map-note", c.mapNote);
  set("map-address-text", `${c.address}, ${c.neighborhood}`);

  const welcome = document.getElementById("welcome-message");
  if (welcome && c.welcomeMessage) welcome.textContent = c.welcomeMessage;

  const letterDate = document.getElementById("letter-date");
  if (letterDate) letterDate.textContent = `${c.eventDate?.replace(" de 2026", "") || "25 de julio"} a las ${c.eventTime || "16 hs"}`;

  document.title = `${c.hosts} · House Shower`;

  const maps = document.getElementById("maps-link");
  if (maps && c.mapsUrl) maps.href = c.mapsUrl;

  const embed = document.getElementById("map-embed");
  if (embed) {
    const q = encodeURIComponent(`${c.address}, ${c.neighborhood}`);
    embed.src = c.mapsEmbed || `https://maps.google.com/maps?q=${q}&output=embed`;
  }

  const url = c.regalameUrl || c.mercadoLibreListUrl;
  ["ml-list-link", "contrib-link"].forEach((id) => {
    const el = document.getElementById(id);
    if (el && url) el.href = url;
  });

  const audio = document.getElementById("ambient-audio");
  if (audio && c.musicUrl) audio.src = c.musicUrl;

  const visit = c.visit;
  if (visit) {
    const eyebrow = document.getElementById("visit-eyebrow");
    const title = document.getElementById("visit-title");
    const intro = document.getElementById("visit-intro");
    const note = document.getElementById("visit-note");
    if (eyebrow && visit.eyebrow) eyebrow.textContent = visit.eyebrow;
    if (title && visit.title) title.textContent = visit.title;
    if (intro && visit.intro) intro.textContent = visit.intro;
    if (note && visit.note) note.textContent = visit.note;
  }
}

/* ─── Reveal animations (Intersection Observer) ─── */
let revealObserver;

function setupReveals(root = document) {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const els = root.querySelectorAll(".reveal:not([data-reveal-bound])");

  els.forEach((el) => {
    el.dataset.revealBound = "1";
    if (prefersReduced) {
      el.classList.add("is-visible");
      return;
    }
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) {
      el.classList.add("is-visible");
      return;
    }
    revealObserver?.observe(el);
  });
}

function initScrollAnimations() {
  if (window.__scrollReady) return;
  window.__scrollReady = true;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!prefersReduced) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { root: null, rootMargin: "0px 0px -6% 0px", threshold: 0.1 }
    );
  }

  setupReveals();

  if (prefersReduced || !window.gsap || !window.ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger);
  const heroImg = document.querySelector(".hero__img");
  if (heroImg) {
    gsap.fromTo(heroImg,
      { scale: 1 },
      {
        scale: 1.06,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: 0.5
        }
      }
    );
  }
}

/* ─── Particles ─── */
function initParticles() {
  const canvas = document.getElementById("particles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let w, h, pts = [];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  function seed() {
    pts = Array.from({ length: Math.min(50, Math.floor(w * h / 18000)) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 2 + 0.5,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -Math.random() * 0.35 - 0.1,
      a: Math.random() * 0.35 + 0.1
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    pts.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(201, 168, 108, ${p.a})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  resize();
  seed();
  draw();
  window.addEventListener("resize", () => { resize(); seed(); });
}

/* ─── Envelope float ─── */
function floatEnvelope() {
  const unit = document.getElementById("envelope-unit");
  if (!unit || !window.gsap) return;
  gsap.to(unit, {
    y: -8,
    duration: 2.8,
    ease: "sine.inOut",
    yoyo: true,
    repeat: -1
  });
}

/* ─── Open envelope (GSAP timeline) ─── */
let isAnimating = false;
let openTimeline = null;

function scrollToHero() {
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function finishOpen(onComplete) {
  const scene = document.getElementById("envelope-scene");
  const site = document.getElementById("site");
  const nav = document.getElementById("nav");
  const hero = document.getElementById("inicio");
  const heroImg = document.getElementById("hero-img");

  scrollToHero();
  isAnimating = false;
  openTimeline = null;
  sessionStorage.setItem(SESSION_KEY, "1");

  scene?.classList.remove("is-opening");
  scene?.classList.add("is-hidden");
  if (scene) scene.style.opacity = "";
  document.body.classList.remove("is-opening");
  document.body.classList.add("envelope-done");

  site?.classList.remove("is-revealing");
  site?.classList.add("is-visible");
  site?.removeAttribute("inert");
  site?.setAttribute("aria-hidden", "false");
  if (site) {
    site.style.opacity = "1";
    site.style.transform = "none";
    site.style.filter = "none";
  }

  hero?.classList.add("is-ready");

  if (nav) {
    nav.classList.add("is-visible");
    nav.style.transform = "";
  }

  if (window.gsap) {
    gsap.set([site, nav], { clearProps: "all" });
    if (heroImg) gsap.set(heroImg, { scale: 1, y: 0, clearProps: "transform" });
    gsap.fromTo(".hero__content",
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.8, ease: "power2.out", delay: 0.1 }
    );
  } else {
    const content = hero?.querySelector(".hero__content");
    if (content) content.style.opacity = "1";
    if (heroImg) heroImg.style.transform = "";
  }

  onComplete?.();
}

function resetEnvelopeVisuals() {
  ["envelope-unit", "envelope", "envelope-card", "envelope-seal",
    "envelope-flap-wrap", "envelope-hint", "envelope-scene"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.cssText = "";
  });
  document.querySelectorAll(".envelope__fold, .envelope__face").forEach((el) => {
    el.style.cssText = "";
  });
}

function playOpenFallback() {
  const scene = document.getElementById("envelope-scene");
  const card = document.getElementById("envelope-card");
  const seal = document.getElementById("envelope-seal");
  const flap = document.getElementById("envelope-flap-wrap");
  const face = document.querySelector(".envelope__face");
  const env = document.getElementById("envelope");
  const hint = document.getElementById("envelope-hint");

  document.body.classList.add("is-opening");
  scene?.classList.remove("is-hidden");
  scene?.classList.add("is-opening");
  if (hint) hint.style.opacity = "0";
  if (seal) { seal.style.opacity = "0"; seal.style.transform = "scale(0)"; }
  if (flap) flap.style.transform = "rotateX(180deg)";
  if (face) face.style.opacity = "0";
  if (card) {
    card.style.visibility = "visible";
    card.style.opacity = "1";
    card.style.transform = "translateY(-180px)";
  }
  if (env) { env.style.opacity = "0"; env.style.transform = "translateY(30px)"; }
  setTimeout(() => finishOpen(initScrollAnimations), 2200);
}

function openEnvelope() {
  if (isAnimating) return;
  scrollToHero();
  isAnimating = true;

  const scene = document.getElementById("envelope-scene");
  const unit = document.getElementById("envelope-unit");
  const hint = document.getElementById("envelope-hint");
  const seal = document.getElementById("envelope-seal");
  const flap = document.getElementById("envelope-flap-wrap");
  const face = document.querySelector(".envelope__face");
  const folds = document.querySelectorAll(".envelope__fold");
  const env = document.getElementById("envelope");
  const card = document.getElementById("envelope-card");
  const shadow = document.querySelector(".envelope__shadow");

  document.body.classList.add("is-opening");
  scene?.classList.remove("is-hidden");
  if (scene) {
    scene.style.visibility = "visible";
    scene.style.opacity = "1";
    scene.style.pointerEvents = "auto";
  }
  scene?.classList.add("is-opening");

  if (!window.gsap) {
    playOpenFallback();
    return;
  }

  const targets = [unit, env, seal, flap, face, card, scene, hint, shadow, ...folds];
  gsap.killTweensOf(targets);
  openTimeline?.kill();
  resetEnvelopeVisuals();

  gsap.set(unit, { y: 0, opacity: 1 });
  gsap.set(env, { opacity: 1, y: 0, scale: 1 });
  gsap.set(seal, { scale: 1, opacity: 1 });
  gsap.set(flap, { rotationX: 0, transformOrigin: "top center" });
  gsap.set(face, { opacity: 1 });
  gsap.set(folds, { opacity: 1 });
  gsap.set(shadow, { opacity: 1 });
  gsap.set(card, { visibility: "hidden", opacity: 0, y: 12, scale: 0.97, zIndex: 2 });
  gsap.set(scene, { opacity: 1 });
  gsap.set(hint, { opacity: 1 });

  const cardLift = unit && unit.offsetHeight < 230 ? -195 : -235;

  openTimeline = gsap.timeline({
    onComplete: () => finishOpen(initScrollAnimations)
  });

  /* 1. Sello se rompe */
  openTimeline.to(hint, { opacity: 0, duration: 0.22 }, 0);
  openTimeline.to(seal, {
    scale: 0, opacity: 0, duration: 0.4, ease: "back.in(2)"
  }, 0.08);

  /* 2. Solapa se abre hacia atrás (el sobre SE ABRE) */
  openTimeline.to(flap, {
    rotationX: 180,
    duration: 1,
    ease: "power2.inOut",
    transformOrigin: "top center"
  }, 0.2);

  /* 3. Tapa frontal se va — se ve el interior */
  openTimeline.to(face, { opacity: 0, duration: 0.35 }, 0.55);

  /* 4. Carta aparece DENTRO y sale hacia arriba */
  openTimeline.set(card, { visibility: "visible", zIndex: 8 }, 0.75);
  openTimeline.to(card, { opacity: 1, duration: 0.25 }, 0.75);
  openTimeline.to(card, {
    y: cardLift,
    scale: 1.04,
    duration: 1.15,
    ease: "power2.out"
  }, 0.8);

  /* 5. Sobre se desvanece recién cuando la carta ya salió */
  openTimeline.to(folds, { opacity: 0, duration: 0.4 }, 1.35);
  openTimeline.to([env, shadow], {
    y: 35, opacity: 0, duration: 0.55, ease: "power2.in"
  }, 1.45);
  openTimeline.to(card, {
    opacity: 0, y: cardLift - 50, scale: 1.08, duration: 0.35
  }, 1.75);
  openTimeline.to(scene, { opacity: 0, duration: 0.4 }, 1.85);
}

window.openInvitation = openEnvelope;

function skipToSite() {
  const scene = document.getElementById("envelope-scene");
  const site = document.getElementById("site");
  const nav = document.getElementById("nav");
  const hero = document.getElementById("inicio");

  scrollToHero();
  scene?.classList.add("is-hidden");
  site?.classList.add("is-visible");
  site?.removeAttribute("inert");
  site?.setAttribute("aria-hidden", "false");
  if (site) site.style.opacity = "1";
  hero?.classList.add("is-ready");
  nav?.classList.add("is-visible");
  document.body.classList.add("envelope-done");
  initScrollAnimations();
}

function replayInvitation() {
  sessionStorage.removeItem(SESSION_KEY);
  window.__scrollReady = false;
  if (window.ScrollTrigger) ScrollTrigger.getAll().forEach((t) => t.kill());
  openTimeline?.kill();
  isAnimating = false;
  document.body.classList.remove("envelope-done", "is-opening", "nav-menu-open");
  window.scrollTo(0, 0);
  location.reload();
}

function setupEnvelope() {
  const scene = document.getElementById("envelope-scene");
  const env = document.getElementById("envelope");
  const replayBtn = document.getElementById("replay-btn");

  replayBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    replayInvitation();
  });

  if (sessionStorage.getItem(SESSION_KEY) === "1" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sessionStorage.setItem(SESSION_KEY, "1");
    }
    skipToSite();
    return;
  }

  floatEnvelope();

  const trigger = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openEnvelope();
  };

  scene?.addEventListener("click", trigger);
  scene?.addEventListener("touchend", (e) => {
    if (isAnimating) return;
    e.preventDefault();
    openEnvelope();
  }, { passive: false });
  scene?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openEnvelope();
    }
  });
  env?.addEventListener("click", trigger);
}

/* ─── Visit highlights ─── */
const VISIT_ICONS = {
  mate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12v8a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V8z"/><path d="M18 10h1.5a2 2 0 0 1 0 4H18"/><path d="M7 4c0 2 1.5 3 3 3"/><path d="M11 4c0 2 1.5 3 3 3"/></svg>`,
  food: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11h16v2a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6v-2z"/><path d="M8 11V7a2 2 0 0 1 4 0v4"/><path d="M12 11V5"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"/></svg>`,
  toast: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10l1 14H6L7 4z"/><path d="M9 4V2h6v2"/></svg>`
};

function renderVisit() {
  const el = document.getElementById("visit-highlights");
  const items = window.CONFIG?.visit?.highlights;
  if (!el || !items?.length) return;

  el.innerHTML = items.map((item, i) => `
    <li class="visit-card" style="--delay: ${i * 0.08}s">
      <div class="visit-card__icon" aria-hidden="true">${VISIT_ICONS[item.icon] || VISIT_ICONS.mate}</div>
      <h3 class="visit-card__title">${esc(item.title)}</h3>
      <p class="visit-card__text">${esc(item.text)}</p>
    </li>
  `).join("");
}

/* ─── Nav ─── */
function setupNav() {
  const nav = document.getElementById("nav");
  const links = document.querySelectorAll("[data-nav]");

  const sectionIds = ["inicio", "invitacion", "hogar", "galeria", "regalos", "rsvp", "ubicacion"];

  const onScroll = () => {
    nav?.classList.toggle("nav--scrolled", window.scrollY > 20);

    let current = "inicio";
    const offset = 100;
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= offset) current = id;
    });

    links.forEach((a) => {
      const href = a.getAttribute("href")?.slice(1);
      a.classList.toggle("is-active", href === current);
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/* ─── Gallery ─── */
const GALLERY_MQ = "(max-width: 720px)";
let galleryIndex = 0;
let galleryAutoplayTimer = null;
let galleryAutoplayPaused = false;

function stopGalleryAutoplay() {
  if (galleryAutoplayTimer) {
    clearInterval(galleryAutoplayTimer);
    galleryAutoplayTimer = null;
  }
}

function startGalleryAutoplay() {
  stopGalleryAutoplay();

  const mobile = window.matchMedia(GALLERY_MQ).matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!mobile || reduced || galleryAutoplayPaused || document.hidden) return;

  const slides = getGallerySlides();
  if (slides.length < 2) return;

  const delay = window.CONFIG?.galleryAutoplayMs ?? 4500;
  galleryAutoplayTimer = setInterval(() => {
    if (!window.matchMedia(GALLERY_MQ).matches || document.hidden || galleryAutoplayPaused) return;
    const total = getGallerySlides().length;
    if (total < 2) return;
    scrollGalleryTo(galleryIndex + 1 >= total ? 0 : galleryIndex + 1);
  }, delay);
}

function pauseGalleryAutoplay(ms = 7000) {
  galleryAutoplayPaused = true;
  stopGalleryAutoplay();
  setTimeout(() => {
    galleryAutoplayPaused = false;
    startGalleryAutoplay();
  }, ms);
}

function renderGallery() {
  const el = document.getElementById("gallery");
  const photos = window.CONFIG?.gallery;
  if (!el || !photos?.length) return;
  el.innerHTML = photos.map((p, i) => {
    const img = p.srcMobile
      ? `<picture class="gallery__picture">
          <source media="(max-width: 720px)" srcset="${esc(p.srcMobile)}">
          <img src="${esc(p.src)}" alt="${esc(p.alt)}" loading="lazy" draggable="false">
        </picture>`
      : `<img src="${esc(p.src)}" alt="${esc(p.alt)}" loading="lazy" draggable="false">`;
    return `<figure class="gallery__item" data-index="${i}">${img}</figure>`;
  }).join("");
  setupGalleryCarousel();
}

function getGallerySlides() {
  return [...document.querySelectorAll("#gallery .gallery__item")];
}

function scrollGalleryTo(index, smooth = true) {
  const slides = getGallerySlides();
  const track = document.getElementById("gallery");
  if (!slides.length || !track) return;

  galleryIndex = Math.max(0, Math.min(index, slides.length - 1));
  const slide = slides[galleryIndex];
  const offset = slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2;

  track.scrollTo({ left: offset, behavior: smooth ? "smooth" : "auto" });
}

function syncGalleryIndexFromScroll() {
  const track = document.getElementById("gallery");
  const slides = getGallerySlides();
  if (!track || !slides.length) return;

  const center = track.scrollLeft + track.clientWidth / 2;
  let closest = 0;
  let minDist = Infinity;

  slides.forEach((slide, i) => {
    const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
    const dist = Math.abs(center - slideCenter);
    if (dist < minDist) {
      minDist = dist;
      closest = i;
    }
  });

  galleryIndex = closest;
}

function setupGalleryCarousel() {
  const track = document.getElementById("gallery");
  const slides = getGallerySlides();
  if (!track || !slides.length) return;

  const mq = window.matchMedia(GALLERY_MQ);

  const applyMode = () => {
    if (mq.matches) {
      requestAnimationFrame(() => {
        scrollGalleryTo(galleryIndex, false);
        startGalleryAutoplay();
      });
    } else {
      galleryIndex = 0;
      stopGalleryAutoplay();
    }
  };

  if (!track.dataset.carouselReady) {
    track.dataset.carouselReady = "1";

    let scrollTimer;
    track.addEventListener("scroll", () => {
      if (!mq.matches) return;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(syncGalleryIndexFromScroll, 60);
    }, { passive: true });

    track.addEventListener("touchstart", () => pauseGalleryAutoplay(), { passive: true });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopGalleryAutoplay();
      else startGalleryAutoplay();
    });

    mq.addEventListener("change", applyMode);
  }

  applyMode();
}

/* ─── Wishlist ─── */
function activeFilter() {
  return document.querySelector(".chip.is-active")?.dataset.filter || "all";
}

function renderWishlist(filter = "all") {
  const grid = document.getElementById("wishlist-grid");
  const items = window.CONFIG?.wishlist;
  if (!grid || !items) return;

  const res = getReservations();
  const list = items.filter((i) => filter === "all" || i.category === filter);

  if (!list.length) {
    grid.innerHTML = '<p class="wish-empty">No hay ítems en esta categoría.</p>';
    return;
  }

  grid.innerHTML = list.map((item) => {
    const r = res[item.id];
    return `
      <article class="wish-card card reveal">
        <div class="wish-card__img">
          <img src="${item.image}" alt="${esc(item.name)}" loading="lazy">
          ${r ? '<span class="wish-card__badge">Reservado</span>' : ""}
        </div>
        <div class="wish-card__body">
          <span class="wish-card__cat">${item.category}</span>
          <h3>${esc(item.name)}</h3>
          <p class="wish-card__price">${item.price}</p>
          ${r ? `<p class="wish-card__reserved">Reservado por ${esc(r.name)}</p>` : ""}
          <div class="wish-card__acts">
            <a class="btn btn--sm btn--gold" href="${item.url}" target="_blank" rel="noopener">Ver en ML</a>
            ${r
              ? `<button class="btn btn--sm btn--ghost" data-action="unreserve" data-id="${item.id}">Liberar</button>`
              : `<button class="btn btn--sm btn--gold" data-action="reserve" data-id="${item.id}">Lo regalo yo</button>`
            }
          </div>
        </div>
      </article>`;
  }).join("");

  if (window.__scrollReady) setupReveals(grid);
}

/* ─── Reserve modal ─── */
let reserveModalState = { id: null, action: null };

function getWishlistItem(id) {
  return window.CONFIG?.wishlist?.find((item) => item.id === id);
}

function setupReserveModal() {
  const modal = document.getElementById("reserve-modal");
  const form = document.getElementById("reserve-modal-form");
  const input = document.getElementById("reserve-modal-input");
  if (!modal || !form || !input) return;

  modal.querySelectorAll("[data-modal-close]").forEach((el) => {
    el.addEventListener("click", closeReserveModal);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) return;

    const { id, action } = reserveModalState;
    if (!id || !action) return;

    if (action === "reserve") {
      saveReservation(id, name);
      toast("¡Gracias! Quedó reservado.");
      renderWishlist(activeFilter());
      closeReserveModal();
      return;
    }

    if (action === "unreserve") {
      const cur = getReservations()[id];
      if (name !== cur?.name) {
        toast("El nombre no coincide.");
        input.focus();
        return;
      }
      clearReservation(id);
      toast("Regalo liberado.");
      renderWishlist(activeFilter());
      closeReserveModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) closeReserveModal();
  });
}

function openReserveModal({ action, id }) {
  const modal = document.getElementById("reserve-modal");
  const eyebrow = document.getElementById("reserve-modal-eyebrow");
  const title = document.getElementById("reserve-modal-title");
  const sub = document.getElementById("reserve-modal-sub");
  const label = document.getElementById("reserve-modal-label");
  const input = document.getElementById("reserve-modal-input");
  const submit = document.getElementById("reserve-modal-submit");
  if (!modal || !input) return;

  const item = getWishlistItem(id);
  reserveModalState = { id, action };

  if (action === "reserve") {
    eyebrow.textContent = "Reservar regalo";
    title.textContent = "Lo regalo yo";
    sub.innerHTML = item
      ? `Estás reservando <strong>${esc(item.name)}</strong>. Así evitamos que otro invitado elija lo mismo.`
      : "Dejanos tu nombre para marcar este regalo como reservado.";
    label.textContent = "¿Cómo te llamás?";
    input.placeholder = "Tu nombre";
    submit.textContent = "Reservar";
  } else {
    eyebrow.textContent = "Liberar regalo";
    title.textContent = "¿Ya no lo regalás?";
    sub.innerHTML = item
      ? `Para liberar <strong>${esc(item.name)}</strong>, confirmá tu nombre.`
      : "Confirmá tu nombre para liberar este regalo.";
    label.textContent = "Confirmá tu nombre";
    input.placeholder = "Como lo escribiste antes";
    submit.textContent = "Liberar";
  }

  input.value = "";
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  modal.classList.add("is-open");
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => modal.classList.add("is-visible"));
  setTimeout(() => input.focus(), 80);
}

function closeReserveModal() {
  const modal = document.getElementById("reserve-modal");
  if (!modal?.classList.contains("is-open")) return;

  modal.classList.remove("is-visible");
  reserveModalState = { id: null, action: null };

  const finish = () => {
    modal.classList.remove("is-open");
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  };

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) finish();
  else setTimeout(finish, 320);
}

function onWishlistClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const { id, action } = btn.dataset;

  if (action === "reserve" || action === "unreserve") {
    openReserveModal({ action, id });
  }
}

/* ─── Contribuciones ─── */
function renderContrib() {
  const grid = document.getElementById("contrib-grid");
  const items = window.CONFIG?.contribuciones;
  if (!grid || !items) return;

  grid.innerHTML = items.map((item) => `
    <div class="contrib-item card reveal">
      <button type="button" class="contrib-item__head" aria-expanded="false">
        <span class="contrib-item__icon">${item.icon}</span>
        <span class="contrib-item__title">${esc(item.name)}</span>
        <span class="contrib-item__meta">${item.meta}</span>
        <span class="contrib-item__arrow">▼</span>
      </button>
      <div class="contrib-item__body" hidden>
        <p class="contrib-item__desc">${esc(item.description)}</p>
      </div>
    </div>
  `).join("");
}

function setupContrib() {
  document.getElementById("contrib-grid")?.addEventListener("click", (e) => {
    const head = e.target.closest(".contrib-item__head");
    if (!head) return;
    const item = head.closest(".contrib-item");
    const body = item.querySelector(".contrib-item__body");
    const open = item.classList.contains("is-open");

    document.querySelectorAll(".contrib-item.is-open").forEach((c) => {
      if (c === item) return;
      c.classList.remove("is-open");
      c.querySelector(".contrib-item__body").hidden = true;
    });

    item.classList.toggle("is-open", !open);
    body.hidden = open;
    head.setAttribute("aria-expanded", String(!open));
  });
}

/* ─── Tabs ─── */
function setupTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => {
        t.classList.toggle("is-active", t === tab);
        t.setAttribute("aria-selected", String(t === tab));
      });
      document.querySelectorAll(".panel").forEach((p) => {
        const show = p.id === `panel-${tab.dataset.tab}`;
        p.classList.toggle("is-active", show);
        p.hidden = !show;
      });
    });
  });

  document.querySelectorAll(".chip[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".chip[data-filter]").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      renderWishlist(btn.dataset.filter);
    });
  });
}

/* ─── RSVP ─── */
function setupRsvp() {
  document.getElementById("rsvp-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const c = window.CONFIG;
    const d = new FormData(e.target);
    const att = { yes: "Sí", maybe: "Tal vez", no: "No puedo" };
    const guests = { "1": "Solo yo", "2": "2", "3": "3", "4": "4 o más" };
    const text = [
      "¡Hola! Confirmo para el House Shower:",
      `Nombre: ${d.get("name")}`,
      `Contacto: ${d.get("contact")}`,
      `Asistencia: ${att[d.get("attending")]}`,
      `Personas: ${guests[d.get("guests")]}`,
      d.get("message") ? `Mensaje: ${d.get("message")}` : "",
      `📍 ${c?.address}`,
      `📅 ${c?.eventDate} · ${c?.eventTime}`
    ].filter(Boolean).join("\n");

    window.open(`https://wa.me/${c?.whatsappNumber}?text=${encodeURIComponent(text)}`, "_blank");
  });
}

/* ─── Countdown ─── */
function setupCountdown() {
  const target = new Date(window.CONFIG?.eventISO || "2026-07-25T16:00:00-03:00").getTime();
  const els = ["cd-days", "cd-hours", "cd-minutes", "cd-seconds"].map((id) => document.getElementById(id));
  if (!els[0]) return;

  const tick = () => {
    const diff = Math.max(0, target - Date.now());
    const vals = [
      Math.floor(diff / 86400000),
      Math.floor((diff % 86400000) / 3600000),
      Math.floor((diff % 3600000) / 60000),
      Math.floor((diff % 60000) / 1000)
    ].map((n) => String(n).padStart(2, "0"));

    els.forEach((el, i) => {
      if (el.textContent !== vals[i]) {
        el.textContent = vals[i];
        el.classList.add("tick");
        setTimeout(() => el.classList.remove("tick"), 250);
      }
    });
  };
  tick();
  setInterval(tick, 1000);
}

/* ─── Music toggle ─── */
function setupMusic() {
  const btn = document.getElementById("music-toggle");
  const audio = document.getElementById("ambient-audio");
  if (!btn) return;
  if (!audio?.src) {
    btn.style.display = "none";
    return;
  }

  btn.addEventListener("click", async () => {
    try {
      if (audio.paused) {
        await audio.play();
        btn.classList.add("is-playing");
        btn.setAttribute("aria-label", "Pausar música");
      } else {
        audio.pause();
        btn.classList.remove("is-playing");
        btn.setAttribute("aria-label", "Activar música");
      }
    } catch {
      toast("No se pudo reproducir la música.");
    }
  });
}

/* ─── Init ─── */
document.addEventListener("DOMContentLoaded", () => {
  applyConfig();
  initParticles();
  renderGallery();
  renderVisit();
  renderWishlist();
  renderContrib();
  setupTabs();
  setupContrib();
  setupRsvp();
  setupCountdown();
  setupMusic();
  setupNav();
  setupEnvelope();
  setupReserveModal();

  document.getElementById("wishlist-grid")?.addEventListener("click", onWishlistClick);

  if (sessionStorage.getItem(SESSION_KEY) === "1") {
    initScrollAnimations();
  }
});
