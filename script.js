const INVITATION_VARIANT =
  new URLSearchParams(window.location.search).get("grupo") || "familia";
const SESSION_KEY = `house-shower-opened-${INVITATION_VARIANT}`;
const RESERVATIONS_TABLE = "house_shower_reservations";

/* ─── Utils ─── */
const esc = (t) => { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; };

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3200);
}

/* ─── Shared reservations (Supabase) ─── */
let reservationsCache = {};
let supabaseClient = null;
let reservationsChannel = null;
let reservationsReady = false;

function initSupabase() {
  const url = window.CONFIG?.supabaseUrl;
  const key = window.CONFIG?.supabaseAnonKey;
  if (!url || !key || !window.supabase?.createClient) return null;
  supabaseClient = window.supabase.createClient(url, key);
  return supabaseClient;
}

function getReservations() {
  return reservationsCache;
}

function setReservationsFromRows(rows = []) {
  const next = {};
  rows.forEach((row) => {
    if (!row?.item_id) return;
    next[row.item_id] = {
      name: row.reserved_by,
      date: row.reserved_at
    };
  });
  reservationsCache = next;
}

async function loadReservations() {
  if (!supabaseClient) return false;
  const { data, error } = await supabaseClient
    .from(RESERVATIONS_TABLE)
    .select("item_id, reserved_by, reserved_at");

  if (error) {
    console.error("No se pudieron cargar las reservas", error);
    toast("No se pudieron cargar las reservas. Recargá en un momento.");
    return false;
  }

  setReservationsFromRows(data || []);
  reservationsReady = true;
  return true;
}

function subscribeReservations() {
  if (!supabaseClient || reservationsChannel) return;

  reservationsChannel = supabaseClient
    .channel("house-shower-reservations")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: RESERVATIONS_TABLE },
      (payload) => {
        if (payload.eventType === "INSERT" && payload.new) {
          reservationsCache[payload.new.item_id] = {
            name: payload.new.reserved_by,
            date: payload.new.reserved_at
          };
        } else if (payload.eventType === "DELETE" && payload.old) {
          delete reservationsCache[payload.old.item_id];
        } else if (payload.eventType === "UPDATE" && payload.new) {
          reservationsCache[payload.new.item_id] = {
            name: payload.new.reserved_by,
            date: payload.new.reserved_at
          };
        }
        renderWishlist(activeFilter(), { keepExpanded: true });
      }
    )
    .subscribe();
}

async function saveReservation(id, name) {
  if (!supabaseClient) throw new Error("Supabase no disponible");

  const { data, error } = await supabaseClient
    .from(RESERVATIONS_TABLE)
    .insert({
      item_id: id,
      reserved_by: name.trim()
    })
    .select("item_id, reserved_by, reserved_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      await loadReservations();
      throw new Error("ALREADY_RESERVED");
    }
    throw error;
  }

  reservationsCache[id] = {
    name: data.reserved_by,
    date: data.reserved_at
  };
}

async function clearReservation(id, name) {
  if (!supabaseClient) throw new Error("Supabase no disponible");

  const { data, error } = await supabaseClient.rpc("release_house_shower_reservation", {
    p_item_id: id,
    p_name: name.trim()
  });

  if (error) throw error;
  if (!data) throw new Error("NAME_MISMATCH");

  delete reservationsCache[id];
}

/* ─── Config ─── */
function applyInvitationVariant() {
  const base = window.CONFIG;
  const variant = base?.variants?.[INVITATION_VARIANT];
  if (!base || !variant) return;

  window.CONFIG = {
    ...base,
    ...variant,
    visit: {
      ...base.visit,
      ...variant.visit
    },
    invitation: {
      ...base.invitation,
      ...variant.invitation
    }
  };
  document.documentElement.dataset.group = INVITATION_VARIANT;
}

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

  const invitation = c.invitation;
  const salute = document.getElementById("letter-salute");
  const letterBody = document.getElementById("letter-body");
  const letterPlan = document.getElementById("letter-plan");
  const countdownLabel = document.getElementById("countdown-label");
  if (salute && invitation?.salute) salute.textContent = invitation.salute;
  if (letterBody && invitation?.body) letterBody.innerHTML = invitation.body;
  if (letterPlan && invitation?.plan) letterPlan.innerHTML = invitation.plan;
  if (countdownLabel && invitation?.countdownLabel) {
    countdownLabel.textContent = invitation.countdownLabel;
  }

  document.title = `${c.hosts} | House Shower`;

  const maps = document.getElementById("maps-link");
  if (maps && c.mapsUrl) maps.href = c.mapsUrl;

  const embed = document.getElementById("map-embed");
  if (embed) {
    const q = encodeURIComponent(`${c.address}, ${c.neighborhood}`);
    embed.src = c.mapsEmbed || `https://maps.google.com/maps?q=${q}&output=embed`;
  }

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
      ctx.fillStyle = `rgba(143, 157, 104, ${p.a})`;
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
let envelopeFloatTween = null;

function floatEnvelope() {
  const env = document.getElementById("envelope");
  if (!env || !window.gsap) return;
  envelopeFloatTween?.kill();
  envelopeFloatTween = gsap.to(env, {
    y: -6,
    duration: 3.2,
    ease: "sine.inOut",
    yoyo: true,
    repeat: -1
  });
}

function stopEnvelopeFloat() {
  envelopeFloatTween?.kill();
  envelopeFloatTween = null;
  const env = document.getElementById("envelope");
  if (env && window.gsap) gsap.set(env, { y: 0 });
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
    "envelope-flap-wrap", "envelope-hint", "envelope-scene", "envelope-pocket"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.cssText = "";
  });
  document.getElementById("envelope-pocket")?.classList.remove("is-open");
  document.querySelectorAll(".envelope__fold").forEach((el) => {
    el.style.cssText = "";
  });
}

function playOpenFallback() {
  const scene = document.getElementById("envelope-scene");
  const card = document.getElementById("envelope-card");
  const seal = document.getElementById("envelope-seal");
  const flap = document.getElementById("envelope-flap-wrap");
  const env = document.getElementById("envelope");
  const hint = document.getElementById("envelope-hint");
  const pocket = document.getElementById("envelope-pocket");

  document.body.classList.add("is-opening");
  scene?.classList.remove("is-hidden");
  scene?.classList.add("is-opening");
  if (hint) hint.style.opacity = "0";
  if (seal) { seal.style.opacity = "0"; seal.style.transform = "translateY(36px) scale(0.55)"; }
  if (flap) flap.style.transform = "rotateX(-178deg)";
  if (pocket) pocket.classList.add("is-open");
  if (card) card.style.transform = "translateY(-118%)";
  if (env) { env.style.opacity = "0"; env.style.transform = "translateY(24px)"; }
  setTimeout(() => finishOpen(initScrollAnimations), 2800);
}

function openEnvelope() {
  if (isAnimating) return;
  scrollToHero();
  isAnimating = true;
  stopEnvelopeFloat();

  const scene = document.getElementById("envelope-scene");
  const unit = document.getElementById("envelope-unit");
  const hint = document.getElementById("envelope-hint");
  const seal = document.getElementById("envelope-seal");
  const flap = document.getElementById("envelope-flap-wrap");
  const folds = document.querySelectorAll(".envelope__fold");
  const env = document.getElementById("envelope");
  const card = document.getElementById("envelope-card");
  const pocket = document.getElementById("envelope-pocket");
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

  const targets = [unit, env, seal, flap, card, pocket, scene, hint, shadow, ...folds];
  gsap.killTweensOf(targets);
  openTimeline?.kill();
  resetEnvelopeVisuals();

  gsap.set(unit, { y: 0, opacity: 1, scale: 1 });
  gsap.set(env, { opacity: 1, y: 0, scale: 1, transformStyle: "preserve-3d" });
  gsap.set(seal, { scale: 1, opacity: 1, rotation: 0, y: 0, x: 0 });
  gsap.set(flap, {
    rotationX: 0,
    transformOrigin: "50% 0%",
    force3D: true
  });
  gsap.set(folds, { opacity: 1 });
  gsap.set(shadow, { opacity: 1, scale: 1 });
  gsap.set(pocket, { zIndex: 2 });
  gsap.set(card, { y: "8%", scale: 1, opacity: 1 });
  gsap.set(scene, { opacity: 1 });
  gsap.set(hint, { opacity: 1 });
  pocket?.classList.remove("is-open");

  openTimeline = gsap.timeline({
    onComplete: () => finishOpen(initScrollAnimations)
  });

  /* Toque del sobre */
  openTimeline.to(env, {
    scale: 0.982,
    duration: 0.16,
    ease: "power1.out"
  }, 0);
  openTimeline.to(hint, { opacity: 0, duration: 0.28, ease: "power1.out" }, 0);
  openTimeline.to(env, {
    scale: 1,
    duration: 0.32,
    ease: "power2.out"
  }, 0.16);

  /* El sello cae */
  openTimeline.to(seal, {
    y: 42,
    x: 14,
    rotation: 26,
    scale: 0.62,
    opacity: 0,
    duration: 0.7,
    ease: "power3.in"
  }, 0.2);

  /* La solapa se abre hacia atrás */
  openTimeline.to(flap, {
    rotationX: -178,
    duration: 1.15,
    ease: "power2.inOut",
    force3D: true
  }, 0.55);

  /* La carta asoma por arriba (sigue detrás de los pliegues) */
  openTimeline.to(card, {
    y: "-22%",
    duration: 0.85,
    ease: "power1.inOut"
  }, 1.35);

  /* Sale del bolsillo por encima del sobre */
  openTimeline.call(() => pocket?.classList.add("is-open"), null, 2.05);
  openTimeline.set(pocket, { zIndex: 7 }, 2.05);
  openTimeline.to(card, {
    y: "-118%",
    scale: 1.04,
    duration: 1.05,
    ease: "power2.out"
  }, 2.05);

  openTimeline.to(folds, {
    opacity: 0,
    duration: 0.45,
    ease: "power1.out"
  }, 2.35);

  openTimeline.to([env, shadow, flap], {
    y: 28,
    opacity: 0,
    duration: 0.7,
    ease: "power2.in"
  }, 2.55);

  openTimeline.to(card, {
    opacity: 0,
    y: "-132%",
    duration: 0.45,
    ease: "power1.in"
  }, 2.85);

  openTimeline.to(unit, {
    opacity: 0,
    y: -6,
    duration: 0.4,
    ease: "power2.in"
  }, 3.0);

  openTimeline.to(scene, {
    opacity: 0,
    duration: 0.35,
    ease: "power1.in"
  }, 3.15);
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
    replayBtn.classList.add("is-spinning");
    window.setTimeout(() => replayInvitation(), 280);
  });
  replayBtn?.addEventListener("animationend", (e) => {
    if (e.target === replayBtn.querySelector(".btn--replay__icon")) {
      replayBtn.classList.remove("is-spinning");
    }
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

  const sectionIds = ["inicio", "invitacion", "hogar", "galeria", "regalos", "ubicacion", "rsvp"];
  let lastScrollY = window.scrollY;
  let scrollTicking = false;

  const syncNavVisibility = () => {
    if (!nav?.classList.contains("is-visible")) return;

    const y = window.scrollY;
    const delta = y - lastScrollY;

    if (y <= 48) {
      nav.classList.remove("nav--hidden");
    } else if (delta > 6) {
      nav.classList.add("nav--hidden");
    } else if (delta < -6) {
      nav.classList.remove("nav--hidden");
    }

    lastScrollY = y;
  };

  const onScroll = () => {
    const y = window.scrollY;
    nav?.classList.toggle("nav--scrolled", y > 20);

    if (!scrollTicking) {
      scrollTicking = true;
      requestAnimationFrame(() => {
        syncNavVisibility();
        scrollTicking = false;
      });
    }

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

  links.forEach((a) => {
    a.addEventListener("click", () => {
      nav?.classList.remove("nav--hidden");
    });
  });

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
const WISH_MOBILE_LIMIT = 4;
const WISH_MOBILE_MQ = "(max-width: 720px)";
let wishlistExpanded = false;

function activeFilter() {
  return document.querySelector(".chip.is-active")?.dataset.filter || "all";
}

function isWishMobile() {
  return window.matchMedia(WISH_MOBILE_MQ).matches;
}

function updateWishMoreButton(total) {
  const grid = document.getElementById("wishlist-grid");
  const btn = document.getElementById("wishlist-more");
  if (!grid || !btn) return;

  const mobile = isWishMobile();
  const needsClamp = mobile && total > WISH_MOBILE_LIMIT;

  grid.classList.toggle("is-expanded", !needsClamp || wishlistExpanded);

  if (!needsClamp) {
    wishlistExpanded = false;
    btn.hidden = true;
    btn.setAttribute("aria-hidden", "true");
    btn.removeAttribute("aria-expanded");
    return;
  }

  btn.hidden = false;
  btn.setAttribute("aria-hidden", "false");
  const hiddenCount = total - WISH_MOBILE_LIMIT;
  btn.setAttribute("aria-expanded", wishlistExpanded ? "true" : "false");
  btn.textContent = wishlistExpanded ? "Ver menos" : `Ver más (${hiddenCount})`;
}

function renderWishlist(filter = "all", { keepExpanded = false } = {}) {
  const grid = document.getElementById("wishlist-grid");
  const items = window.CONFIG?.wishlist;
  if (!grid || !items) return;

  if (!keepExpanded) wishlistExpanded = false;

  const res = getReservations();
  const list = items.filter((i) => filter === "all" || i.category === filter);

  if (!list.length) {
    grid.innerHTML = '<p class="wish-empty">No hay ítems en esta categoría.</p>';
    grid.classList.add("is-expanded");
    const moreBtn = document.getElementById("wishlist-more");
    if (moreBtn) moreBtn.hidden = true;
    return;
  }

  grid.innerHTML = list.map((item) => {
    const r = res[item.id];
    return `
      <article class="wish-card card reveal">
        <button type="button" class="wish-card__img" data-action="photo" data-id="${item.id}" aria-label="Ver foto de ${esc(item.name)}">
          <img src="${item.image}" alt="${esc(item.name)}" loading="lazy">
          ${r ? '<span class="wish-card__badge">Reservado</span>' : ""}
          <span class="wish-card__zoom" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4" stroke-linecap="round"/></svg>
          </span>
        </button>
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

  updateWishMoreButton(list.length);

  if (window.__scrollReady) setupReveals(grid);
}

function setupWishlistMore() {
  const btn = document.getElementById("wishlist-more");
  if (!btn) return;

  btn.addEventListener("click", () => {
    wishlistExpanded = !wishlistExpanded;
    updateWishMoreButton(
      document.querySelectorAll("#wishlist-grid .wish-card").length
    );
    if (!wishlistExpanded) {
      document.getElementById("regalos")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (window.__scrollReady) {
      setupReveals(document.getElementById("wishlist-grid"));
    }
  });

  window.matchMedia(WISH_MOBILE_MQ).addEventListener("change", () => {
    updateWishMoreButton(
      document.querySelectorAll("#wishlist-grid .wish-card").length
    );
  });
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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) return;

    const { id, action } = reserveModalState;
    if (!id || !action) return;

    const submit = document.getElementById("reserve-modal-submit");
    if (submit) {
      submit.disabled = true;
      submit.textContent = "Guardando...";
    }

    try {
      if (action === "reserve") {
        await saveReservation(id, name);
        toast("¡Gracias! Quedó reservado para todos.");
        renderWishlist(activeFilter(), { keepExpanded: true });
        closeReserveModal();
        return;
      }

      if (action === "unreserve") {
        await clearReservation(id, name);
        toast("Regalo liberado.");
        renderWishlist(activeFilter(), { keepExpanded: true });
        closeReserveModal();
      }
    } catch (err) {
      if (err?.message === "ALREADY_RESERVED") {
        toast("Uy, alguien ya lo reservó.");
        renderWishlist(activeFilter(), { keepExpanded: true });
        closeReserveModal();
      } else if (err?.message === "NAME_MISMATCH") {
        toast("El nombre no coincide con quien lo reservó.");
        input.focus();
      } else {
        console.error(err);
        toast("No se pudo guardar. Probá de nuevo.");
      }
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = "Confirmar";
      }
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
    if (!document.getElementById("photo-modal")?.classList.contains("is-open")) {
      document.body.classList.remove("modal-open");
    }
  };

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) finish();
  else setTimeout(finish, 320);
}

function onWishlistClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const { id, action } = btn.dataset;

  if (action === "photo") {
    openPhotoModal(id);
    return;
  }

  if (action === "reserve" || action === "unreserve") {
    openReserveModal({ action, id });
  }
}

function openPhotoModal(id) {
  const item = getWishlistItem(id);
  const modal = document.getElementById("photo-modal");
  const img = document.getElementById("photo-modal-img");
  const title = document.getElementById("photo-modal-title");
  const link = document.getElementById("photo-modal-link");
  if (!item || !modal || !img) return;

  img.src = item.image;
  img.alt = item.name;
  if (title) title.textContent = item.name;
  if (link) {
    link.href = item.url;
    link.hidden = !item.url;
  }

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  modal.classList.add("is-open");
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => modal.classList.add("is-visible"));
}

function closePhotoModal() {
  const modal = document.getElementById("photo-modal");
  if (!modal?.classList.contains("is-open")) return;

  modal.classList.remove("is-visible");
  const finish = () => {
    modal.classList.remove("is-open");
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    if (!document.getElementById("reserve-modal")?.classList.contains("is-open")) {
      document.body.classList.remove("modal-open");
    }
    const img = document.getElementById("photo-modal-img");
    if (img) img.removeAttribute("src");
  };

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) finish();
  else setTimeout(finish, 280);
}

function setupPhotoModal() {
  const modal = document.getElementById("photo-modal");
  if (!modal) return;

  modal.querySelectorAll("[data-photo-close]").forEach((el) => {
    el.addEventListener("click", closePhotoModal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) closePhotoModal();
  });
}

function formatTransferData(t) {
  const lines = [
    t.titular && `Titular: ${t.titular}`,
    t.cuil && `CUIT/CUIL: ${t.cuil}`,
    t.cvu && `CVU: ${t.cvu}`,
    t.alias && `Alias: ${t.alias}`
  ].filter(Boolean);
  return lines.join("\n");
}

function copyText(text) {
  if (!text) return;
  navigator.clipboard.writeText(text)
    .then(() => toast("Copiado al portapapeles"))
    .catch(() => toast("No se pudo copiar"));
}

function showContribCard() {
  const card = document.querySelector("#contrib-grid .contrib-feature");
  if (card) card.classList.add("is-visible");
  setupReveals(document.getElementById("contrib-grid"));
}

/* ─── Contribuciones ─── */
function renderTransferRow(label, value, copyable = false) {
  if (!value) return "";
  return `
    <div class="contrib-transfer__row">
      <dt>${esc(label)}</dt>
      <dd>
        <span class="contrib-transfer__value">${esc(value)}</span>
        ${copyable ? `<button type="button" class="contrib-copy" data-copy="${esc(value)}" aria-label="Copiar ${esc(label)}">Copiar</button>` : ""}
      </dd>
    </div>`;
}

function renderContrib() {
  const shell = document.getElementById("contrib-grid");
  const item = window.CONFIG?.contribuciones?.[0];
  const t = window.CONFIG?.transferencia;
  if (!shell || (!item && !t)) return;

  const title = item?.name || "Un aporte para el hogar";
  const meta = item?.meta || "Aporte libre";
  const desc = item?.description
    || "Si preferís no elegir algo de la wishlist, podés sumarte con un monto libre. Lo usamos para seguir armando la casa.";

  shell.innerHTML = `
    <article class="contrib-feature card reveal">
      <div class="contrib-feature__body">
        <p class="contrib-feature__meta">${esc(meta)}</p>
        <h3 class="contrib-feature__title">${esc(title)}</h3>
        <p class="contrib-feature__desc">${esc(desc)}</p>
        ${t ? `
          <div class="contrib-transfer">
            <h4 class="contrib-transfer__heading">Datos para transferir</h4>
            <dl class="contrib-transfer__list">
              ${renderTransferRow("Titular", t.titular)}
              ${renderTransferRow("Banco", t.banco)}
              ${renderTransferRow("CUIT/CUIL", t.cuil, true)}
              ${renderTransferRow("CVU", t.cvu, true)}
              ${renderTransferRow("Alias", t.alias, true)}
            </dl>
            <button type="button" class="btn btn--sm btn--ghost contrib-transfer__all" data-copy-all>Copiar todos los datos</button>
            ${t.nota ? `<p class="contrib-transfer__note">${esc(t.nota)}</p>` : ""}
          </div>
        ` : ""}
      </div>
    </article>`;

  if (window.__scrollReady) showContribCard();
}

function setupContrib() {
  const shell = document.getElementById("contrib-grid");
  if (!shell) return;

  shell.addEventListener("click", (e) => {
    const allBtn = e.target.closest("[data-copy-all]");
    if (allBtn) {
      copyText(formatTransferData(window.CONFIG?.transferencia || {}));
      return;
    }

    const btn = e.target.closest("[data-copy]");
    if (!btn) return;
    copyText(btn.dataset.copy);
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

      if (tab.dataset.tab === "contribuir") {
        requestAnimationFrame(showContribCard);
      }
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
      `📅 ${c?.eventDate}, ${c?.eventTime}`
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
document.addEventListener("DOMContentLoaded", async () => {
  applyInvitationVariant();
  applyConfig();
  initSupabase();
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
  setupPhotoModal();
  setupWishlistMore();

  document.getElementById("wishlist-grid")?.addEventListener("click", onWishlistClick);

  if (supabaseClient) {
    const ok = await loadReservations();
    if (ok) {
      renderWishlist(activeFilter(), { keepExpanded: true });
      subscribeReservations();
    }
  } else {
    toast("Las reservas compartidas no están disponibles en este momento.");
  }

  if (sessionStorage.getItem(SESSION_KEY) === "1") {
    initScrollAnimations();
  }
});
