(() => {
  "use strict";

  const STORAGE_KEY = "packliste-jugendfreizeit-v1";
  const THEME_KEY = "packliste-theme";
  const DATE_KEY = "packliste-trip-date";

  const uid = () => Math.random().toString(36).slice(2, 10);

  // Extracts a packable quantity from labels like "Unterhosen (9 Stück)" or "Socken (9 Paar)"
  // so items with more than one unit get one checkbox per unit instead of a single checkbox.
  function parseQty(text) {
    const m = text.match(/\((\d+)(?:\s*-\s*(\d+))?\s*(?:Stück|Paar)\)/i);
    if (!m) return 1;
    const n = parseInt(m[2] || m[1], 10);
    return n > 1 ? n : 1;
  }

  function makeItem(text, custom) {
    const qty = parseQty(text);
    return qty > 1
      ? { id: uid(), text, qty, units: Array(qty).fill(false), custom: !!custom }
      : { id: uid(), text, checked: false, custom: !!custom };
  }

  function itemQty(item) {
    return item.qty || 1;
  }
  function itemPacked(item) {
    return item.qty ? item.units.filter(Boolean).length : item.checked ? 1 : 0;
  }
  function itemDone(item) {
    return itemPacked(item) === itemQty(item);
  }

  const DEFAULT_CATEGORIES = [
    {
      id: "hygiene",
      icon: "🧴",
      title: "Hygiene",
      items: ["Haargel/Puder/Spray", "Zahnbürste", "Zahnpasta", "Haarkamm", "Rasierer", "Duschgel / Duschseife", "Parfum", "Kontaktlinsen"],
    },
    {
      id: "kleidung",
      icon: "👕",
      title: "Kleidung",
      items: [
        "Freizeit-T-Shirts (6 Stück)",
        "Freizeithosen (Jeans, Cargohose)",
        "Sport-T-Shirt (5 Stück)",
        "Sporthose (3 Stück)",
        "Leichte Jacke (1 Stück)",
        "Schicke Hosen Gottesdienst (3 Stück)",
        "Schicke T-Shirts/ Polos (4-5 Stück)",
        "Hemden (3 Stück)",
        "Hausschuhe",
        "Socken (9 Paar)",
        "Unterhosen (9 Stück)",
      ],
    },
    {
      id: "snacks",
      icon: "🍪",
      title: "Snacks",
      items: ["Sonnenblumenkerne", "Studentenfutter", "Kekse", "(Spezi)", "Früchte (getrocknete und frisch)"],
    },
    {
      id: "schuhe",
      icon: "👟",
      title: "Schuhe",
      items: ["Fußballschuhe", "Hallenschuhe", "Sneaker", "Sportschuhe", "Hausschuhe"],
    },
    {
      id: "elektronik",
      icon: "💻",
      title: "Elektronik",
      items: ["Surface", "Ladekabel Surface / Handy", "Kopfhörer", "Drohne"],
    },
    {
      id: "unterlagen",
      icon: "📚",
      title: "Unterlagen",
      items: ["Bibel", "Collegeblock", "Stifte"],
    },
    {
      id: "sonstiges",
      icon: "🎒",
      title: "Sonstiges",
      items: [
        "Sonnenbrille", "Rucksack", "Handtücher", "Bettzeug",
        "Decke/Kissen (für die Fahrt)", "Taschenlampe", "Kopflampe", "Cap",
        "Portemonnaie", "Ausweis/Führerschein", "Schlüssel", "Trinkflasche", "Medikamente",
      ],
    },
  ].map((cat) => ({
    ...cat,
    items: cat.items.map((text) => makeItem(text, false)),
  }));

  // Upgrades items saved before quantities got individual checkboxes: a previously
  // fully-checked item stays fully packed, everything else starts unpacked.
  function migrateState(categories) {
    categories.forEach((cat) => {
      cat.items.forEach((item) => {
        const qty = parseQty(item.text);
        if (qty > 1 && !item.qty) {
          const wasChecked = !!item.checked;
          item.qty = qty;
          item.units = Array(qty).fill(wasChecked);
          delete item.checked;
        }
      });
    });
    return categories;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migrateState(JSON.parse(raw));
    } catch (e) {
      console.warn("Konnte gespeicherten Zustand nicht laden", e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.categories));
  }

  const state = {
    categories: loadState(),
    filter: "all",
    query: "",
    collapsed: new Set(),
  };

  // ---------- DOM refs ----------
  const categoriesContainer = document.getElementById("categoriesContainer");
  const itemTemplate = document.getElementById("itemTemplate");
  const multiItemTemplate = document.getElementById("multiItemTemplate");
  const categoryTemplate = document.getElementById("categoryTemplate");
  const overallPercent = document.getElementById("overallPercent");
  const overallCount = document.getElementById("overallCount");
  const hypeText = document.getElementById("hypeText");
  const ringFg = document.getElementById("ringFg");
  const searchInput = document.getElementById("searchInput");
  const filterPills = document.getElementById("filterPills");
  const themeToggle = document.getElementById("themeToggle");
  const tripDateInput = document.getElementById("tripDate");
  const countdownDays = document.getElementById("countdownDays");
  const countdownLabel = document.getElementById("countdownLabel");
  const toast = document.getElementById("toast");

  const RING_CIRC = 2 * Math.PI * 52;
  ringFg.style.strokeDasharray = `${RING_CIRC}`;

  const HYPE_MESSAGES = [
    [0, "Los geht's, pack deinen Koffer! 🧳"],
    [1, "Guter Anfang! Weiter so 💪"],
    [25, "Ein Viertel geschafft! 🔥"],
    [50, "Die Hälfte ist gepackt! 🚀"],
    [75, "Fast fertig – super! ✨"],
    [99, "Nur noch ein paar Sachen! 👀"],
    [100, "Alles gepackt – bereit für die Freizeit! 🎉"],
  ];

  function hypeFor(pct) {
    let msg = HYPE_MESSAGES[0][1];
    for (const [threshold, text] of HYPE_MESSAGES) {
      if (pct >= threshold) msg = text;
    }
    return msg;
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  // ---------- Rendering ----------
  function matchesFilter(item) {
    const done = itemDone(item);
    if (state.filter === "open" && done) return false;
    if (state.filter === "done" && !done) return false;
    if (state.query && !item.text.toLowerCase().includes(state.query.toLowerCase())) return false;
    return true;
  }

  function buildSimpleItemNode(cat, item) {
    const itemNode = itemTemplate.content.firstElementChild.cloneNode(true);
    itemNode.dataset.itemId = item.id;
    const checkbox = itemNode.querySelector(".item-checkbox");
    checkbox.checked = item.checked;
    checkbox.id = "chk-" + item.id;
    itemNode.querySelector(".item-text").textContent = item.text;

    checkbox.addEventListener("change", () => {
      item.checked = checkbox.checked;
      saveState();
      renderProgressOnly();
      checkAllDoneAndCelebrate();
      if (state.filter !== "all") render();
    });

    itemNode.querySelector(".item-delete").addEventListener("click", () => {
      cat.items = cat.items.filter((i) => i.id !== item.id);
      saveState();
      render();
    });

    return itemNode;
  }

  function buildMultiItemNode(cat, item) {
    const node = multiItemTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.itemId = item.id;
    node.querySelector(".item-text").textContent = item.text;
    const countEl = node.querySelector(".item-multi-count");
    const unitsEl = node.querySelector(".item-units");

    function refreshCount() {
      const packed = item.units.filter(Boolean).length;
      countEl.textContent = `${packed}/${item.qty}`;
      node.classList.toggle("all-packed", packed === item.qty);
    }
    refreshCount();

    item.units.forEach((packed, idx) => {
      const box = document.createElement("button");
      box.type = "button";
      box.className = "unit-box" + (packed ? " packed" : "");
      box.title = `${item.text.replace(/\s*\(.*?\)\s*$/, "")} ${idx + 1} von ${item.qty}`;
      box.addEventListener("click", () => {
        item.units[idx] = !item.units[idx];
        box.classList.toggle("packed", item.units[idx]);
        refreshCount();
        saveState();
        renderProgressOnly();
        checkAllDoneAndCelebrate();
        if (state.filter !== "all") render();
      });
      unitsEl.appendChild(box);
    });

    node.querySelector(".item-delete").addEventListener("click", () => {
      cat.items = cat.items.filter((i) => i.id !== item.id);
      saveState();
      render();
    });

    return node;
  }

  function render() {
    categoriesContainer.innerHTML = "";
    let totalItems = 0;
    let totalChecked = 0;

    state.categories.forEach((cat) => {
      const catQty = cat.items.reduce((s, i) => s + itemQty(i), 0);
      const catPacked = cat.items.reduce((s, i) => s + itemPacked(i), 0);
      totalItems += catQty;
      totalChecked += catPacked;

      const visibleItems = cat.items.filter(matchesFilter);
      if ((state.query || state.filter !== "all") && visibleItems.length === 0) return;

      const node = categoryTemplate.content.firstElementChild.cloneNode(true);
      node.dataset.categoryId = cat.id;
      if (state.collapsed.has(cat.id)) node.classList.add("collapsed");

      node.querySelector(".category-icon").textContent = cat.icon;
      node.querySelector(".category-title").textContent = cat.title;

      const catChecked = catPacked;
      const catTotal = catQty;
      const catPct = catTotal ? Math.round((catChecked / catTotal) * 100) : 0;
      node.querySelector(".category-progress-fill").style.width = catPct + "%";
      node.querySelector(".category-progress-text").textContent = `${catChecked}/${catTotal}`;

      node.querySelector(".category-collapse-btn").addEventListener("click", () => {
        if (state.collapsed.has(cat.id)) state.collapsed.delete(cat.id);
        else state.collapsed.add(cat.id);
        render();
      });

      const list = node.querySelector(".item-list");
      visibleItems.forEach((item) => {
        const itemNode = itemQty(item) > 1 ? buildMultiItemNode(cat, item) : buildSimpleItemNode(cat, item);
        list.appendChild(itemNode);
      });

      const form = node.querySelector(".add-item-form");
      const input = node.querySelector(".add-item-input");
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        cat.items.push(makeItem(text, true));
        input.value = "";
        saveState();
        render();
      });

      categoriesContainer.appendChild(node);
    });

    overallCount.textContent = `${totalChecked} von ${totalItems} Sachen gepackt`;
    const pct = totalItems ? Math.round((totalChecked / totalItems) * 100) : 0;
    overallPercent.textContent = pct + "%";
    hypeText.textContent = hypeFor(pct);
    const offset = RING_CIRC - (RING_CIRC * pct) / 100;
    ringFg.style.strokeDashoffset = offset;
    ringFg.style.stroke = pct === 100 ? "#2ecc71" : "";
  }

  // cheaper update used on every checkbox toggle to avoid full re-render/collapse jank
  function renderProgressOnly() {
    let totalItems = 0;
    let totalChecked = 0;
    state.categories.forEach((cat) => {
      const catQty = cat.items.reduce((s, i) => s + itemQty(i), 0);
      const catPacked = cat.items.reduce((s, i) => s + itemPacked(i), 0);
      totalItems += catQty;
      totalChecked += catPacked;

      const node = categoriesContainer.querySelector(`[data-category-id="${cat.id}"]`);
      if (node) {
        const catChecked = catPacked;
        const catTotal = catQty;
        const catPct = catTotal ? Math.round((catChecked / catTotal) * 100) : 0;
        node.querySelector(".category-progress-fill").style.width = catPct + "%";
        node.querySelector(".category-progress-text").textContent = `${catChecked}/${catTotal}`;
      }
    });
    overallCount.textContent = `${totalChecked} von ${totalItems} Sachen gepackt`;
    const pct = totalItems ? Math.round((totalChecked / totalItems) * 100) : 0;
    overallPercent.textContent = pct + "%";
    hypeText.textContent = hypeFor(pct);
    const offset = RING_CIRC - (RING_CIRC * pct) / 100;
    ringFg.style.strokeDashoffset = offset;
    ringFg.style.stroke = pct === 100 ? "#2ecc71" : "";
  }

  function checkAllDoneAndCelebrate() {
    const totalItems = state.categories.reduce((s, c) => s + c.items.reduce((s2, i) => s2 + itemQty(i), 0), 0);
    const totalChecked = state.categories.reduce((s, c) => s + c.items.reduce((s2, i) => s2 + itemPacked(i), 0), 0);
    if (totalItems > 0 && totalItems === totalChecked && !checkAllDoneAndCelebrate._fired) {
      checkAllDoneAndCelebrate._fired = true;
      fireConfetti();
      showToast("Alles gepackt! Bereit für die Freizeit 🎉");
    } else if (totalChecked < totalItems) {
      checkAllDoneAndCelebrate._fired = false;
    }
  }

  // ---------- Search / filter ----------
  searchInput.addEventListener("input", () => {
    state.query = searchInput.value;
    render();
  });

  filterPills.addEventListener("click", (e) => {
    const btn = e.target.closest(".pill");
    if (!btn) return;
    filterPills.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    state.filter = btn.dataset.filter;
    render();
  });

  // ---------- New category ----------
  document.getElementById("addCategoryBtn").addEventListener("click", () => {
    const title = prompt("Name der neuen Kategorie:");
    if (!title || !title.trim()) return;
    const icon = prompt("Ein Emoji als Icon (optional):", "📦") || "📦";
    state.categories.push({ id: uid(), icon: icon.trim() || "📦", title: title.trim(), items: [] });
    saveState();
    render();
  });

  // ---------- Tips panel ----------
  const tipsToggle = document.getElementById("tipsToggle");
  const tipsContent = document.getElementById("tipsContent");
  tipsToggle.addEventListener("click", () => {
    const expanded = tipsToggle.getAttribute("aria-expanded") === "true";
    tipsToggle.setAttribute("aria-expanded", String(!expanded));
    tipsContent.hidden = expanded;
  });

  // ---------- Theme ----------
  function applyTheme(theme) {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      themeToggle.textContent = "☀️";
    } else if (theme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
      themeToggle.textContent = "🌙";
    } else {
      document.documentElement.removeAttribute("data-theme");
      themeToggle.textContent = "🌓";
    }
  }
  let currentTheme = localStorage.getItem(THEME_KEY) || "auto";
  applyTheme(currentTheme);
  themeToggle.addEventListener("click", () => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const order = prefersDark ? ["auto", "light", "dark"] : ["auto", "dark", "light"];
    const idx = order.indexOf(currentTheme);
    currentTheme = order[(idx + 1) % order.length];
    localStorage.setItem(THEME_KEY, currentTheme);
    applyTheme(currentTheme);
  });

  // ---------- Countdown ----------
  function updateCountdown() {
    const val = tripDateInput.value;
    if (!val) {
      countdownDays.textContent = "–";
      countdownLabel.textContent = "kein Datum";
      return;
    }
    const target = new Date(val + "T00:00:00");
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target - now) / (1000 * 60 * 60 * 24));
    if (diffDays > 1) {
      countdownDays.textContent = diffDays;
      countdownLabel.textContent = "Tage bis los geht's";
    } else if (diffDays === 1) {
      countdownDays.textContent = "1";
      countdownLabel.textContent = "Tag bis los geht's";
    } else if (diffDays === 0) {
      countdownDays.textContent = "🎉";
      countdownLabel.textContent = "Heute geht's los!";
    } else {
      countdownDays.textContent = "✓";
      countdownLabel.textContent = "unterwegs / vorbei";
    }
  }
  const savedDate = localStorage.getItem(DATE_KEY);
  if (savedDate) tripDateInput.value = savedDate;
  updateCountdown();
  tripDateInput.addEventListener("change", () => {
    localStorage.setItem(DATE_KEY, tripDateInput.value);
    updateCountdown();
  });

  // ---------- Footer actions ----------
  document.getElementById("printBtn").addEventListener("click", () => window.print());

  document.getElementById("shareBtn").addEventListener("click", async () => {
    const lines = ["Packliste – Jugendfreizeit"];
    state.categories.forEach((cat) => {
      lines.push(`\n${cat.icon} ${cat.title}`);
      cat.items.forEach((i) => {
        if (i.qty) lines.push(`[${itemPacked(i)}/${i.qty}] ${i.text}`);
        else lines.push(`${i.checked ? "[x]" : "[ ]"} ${i.text}`);
      });
    });
    const text = lines.join("\n");
    if (navigator.share) {
      try {
        await navigator.share({ title: "Packliste – Jugendfreizeit", text });
        return;
      } catch (e) {
        /* user cancelled or unsupported, fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast("Packliste in Zwischenablage kopiert 📋");
    } catch (e) {
      showToast("Teilen wird hier nicht unterstützt");
    }
  });

  document.getElementById("resetChecksBtn").addEventListener("click", () => {
    if (!confirm("Alle Häkchen zurücksetzen?")) return;
    state.categories.forEach((cat) =>
      cat.items.forEach((i) => {
        if (i.qty) i.units = Array(i.qty).fill(false);
        else i.checked = false;
      })
    );
    checkAllDoneAndCelebrate._fired = false;
    saveState();
    render();
  });

  document.getElementById("resetAllBtn").addEventListener("click", () => {
    if (!confirm("Wirklich ALLES zurücksetzen? Eigene Kategorien/Gegenstände gehen verloren.")) return;
    state.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    checkAllDoneAndCelebrate._fired = false;
    saveState();
    render();
  });

  // ---------- Confetti ----------
  const confettiCanvas = document.getElementById("confettiCanvas");
  const ctx = confettiCanvas.getContext("2d");
  function resizeCanvas() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  function fireConfetti() {
    const colors = ["#6d5dfc", "#ff6f91", "#35d0ba", "#ffd166", "#4dabf7"];
    const particles = Array.from({ length: 140 }, () => ({
      x: Math.random() * confettiCanvas.width,
      y: -20 - Math.random() * confettiCanvas.height * 0.3,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: -2 + Math.random() * 4,
      vy: 2 + Math.random() * 3,
      rot: Math.random() * Math.PI,
      vr: -0.2 + Math.random() * 0.4,
    }));
    let frame = 0;
    const maxFrames = 220;
    function tick() {
      frame++;
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.02;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (frame < maxFrames) {
        requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      }
    }
    requestAnimationFrame(tick);
  }

  // ---------- Service worker (offline / installable) ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  // ---------- Init ----------
  checkAllDoneAndCelebrate._fired = false;
  render();
})();
