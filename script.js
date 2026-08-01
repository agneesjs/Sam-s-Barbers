/* ==========================================================
   Sam's Barbers — interactions
   Vanilla JS: live rating sync, sticky header, mobile menu,
   scroll reveal, active nav highlighting, gallery lightbox
   ========================================================== */

(function () {
  "use strict";

  /* ---------- Live rating ----------
     The HTML ships with static fallback values (5.0 / 117), so the
     page always renders. When hosted over HTTP it also fetches
     rating.json (maintained by update-rating.py — e.g. via cron or
     CI) and refreshes every rating / review counter on the page. */
  (function loadLiveRating() {
    const applyRating = (rating, reviews) => {
      const reviewsText = Number(reviews).toLocaleString("en-GB");
      document.querySelectorAll("[data-rating]").forEach((el) => {
        el.textContent = rating;
      });
      document.querySelectorAll("[data-reviews]").forEach((el) => {
        el.textContent = reviewsText;
      });
      document.querySelectorAll("[data-reviews-plus]").forEach((el) => {
        el.textContent = reviewsText + "+";
      });
    };

    fetch("rating.json?cb=" + Date.now())
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("HTTP " + res.status))
      )
      .then((data) => {
        const rating = String(data.rating);
        const reviews = Number(data.reviews);
        if (rating && reviews > 0) applyRating(rating, reviews);
      })
      .catch(() => {
        /* no rating.json — keep the fallback values hard-coded in HTML */
      });
  })();

  /* ---------- Sticky header shadow ---------- */
  const header = document.querySelector(".site-header");

  const onScroll = () => {
    header.classList.toggle("scrolled", window.scrollY > 10);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Mobile navigation ---------- */
  const navToggle = document.getElementById("nav-toggle");
  const mainNav = document.getElementById("main-nav");
  const navLinks = mainNav.querySelectorAll(".nav-link, .nav-cta");

  const closeMenu = () => {
    mainNav.classList.remove("open");
    navToggle.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Open menu");
    document.body.style.overflow = "";
  };

  navToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("open");
    navToggle.classList.toggle("open", isOpen);
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
    document.body.style.overflow = isOpen ? "hidden" : "";
  });

  navLinks.forEach((link) => link.addEventListener("click", closeMenu));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mainNav.classList.contains("open")) closeMenu();
  });

  /* ---------- Scroll reveal (IntersectionObserver) ---------- */
  const revealEls = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach((el) => revealObserver.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("visible"));
  }

  /* ---------- Active nav link based on section in view ---------- */
  const sections = document.querySelectorAll("main section[id]");
  const navAnchors = [...document.querySelectorAll(".nav-link")];

  if ("IntersectionObserver" in window && sections.length) {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            navAnchors.forEach((a) =>
              a.classList.toggle(
                "active",
                a.getAttribute("href") === `#${entry.target.id}`
              )
            );
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach((section) => sectionObserver.observe(section));
  }

  /* ---------- Gallery lightbox ---------- */
  const galleryItems = [...document.querySelectorAll(".gallery-item")];
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxClose = document.getElementById("lightbox-close");
  const lightboxPrev = document.getElementById("lightbox-prev");
  const lightboxNext = document.getElementById("lightbox-next");
  let currentIndex = 0;

  const slides = galleryItems.map((item) => {
    const img = item.querySelector("img");
    return { src: img.getAttribute("src"), alt: img.getAttribute("alt") || "" };
  });

  const showSlide = (index) => {
    currentIndex = (index + slides.length) % slides.length;
    lightboxImg.src = slides[currentIndex].src;
    lightboxImg.alt = slides[currentIndex].alt;
  };

  const openLightbox = (index) => {
    showSlide(index);
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    lightboxClose.focus();
  };

  const closeLightbox = () => {
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  galleryItems.forEach((item, index) =>
    item.addEventListener("click", () => openLightbox(index))
  );

  lightboxClose.addEventListener("click", closeLightbox);
  lightboxPrev.addEventListener("click", () => showSlide(currentIndex - 1));
  lightboxNext.addEventListener("click", () => showSlide(currentIndex + 1));

  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") showSlide(currentIndex - 1);
    if (e.key === "ArrowRight") showSlide(currentIndex + 1);
  });

  /* ---------- Opening hours: today highlight + open/closed status ---------- */
  (function hoursStatus() {
    const rows = document.querySelectorAll("[data-hours]");
    const statusEl = document.getElementById("hours-status");
    if (!rows.length || !statusEl) return;

    const toMinutes = (t) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    const schedule = {};
    rows.forEach((row) => {
      const day = Number(row.dataset.day);
      const { open, close } = row.dataset;
      schedule[day] =
        open && close
          ? { open: toMinutes(open), close: toMinutes(close), openText: open, closeText: close }
          : null;
    });

    // Shop's local time (Europe/London)
    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Europe/London" })
    );
    const today = now.getDay();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    rows.forEach((row) =>
      row.classList.toggle("today", Number(row.dataset.day) === today)
    );

    const setStatus = (text, isOpen) => {
      statusEl.textContent = text;
      statusEl.classList.toggle("is-open", isOpen);
      statusEl.classList.toggle("is-closed", !isOpen);
    };

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const todayHours = schedule[today];

    if (todayHours && nowMinutes >= todayHours.open && nowMinutes < todayHours.close) {
      setStatus("Open now · closes " + todayHours.closeText, true);
      return;
    }
    if (todayHours && nowMinutes < todayHours.open) {
      setStatus("Closed · opens today at " + todayHours.openText, false);
      return;
    }
    for (let i = 1; i <= 7; i++) {
      const d = (today + i) % 7;
      if (schedule[d]) {
        const when = i === 1 ? "tomorrow" : dayNames[d];
        setStatus(`Closed · opens ${when} at ${schedule[d].openText}`, false);
        return;
      }
    }
    setStatus("See Booksy for availability", false);
  })();

  /* ---------- Footer year ---------- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
