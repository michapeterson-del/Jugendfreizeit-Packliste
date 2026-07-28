(() => {
  "use strict";

  const STORAGE_KEY = "packliste-app-v2";
  const THEME_KEY = "packliste-theme";
  const TRIP_DATE_KEY = "packliste-trip-date";
  const DESTINATION_KEY = "packliste-destination";

  const DEFAULT_DATA = [
    {
      name: "Hygiene", emoji: "🧴",
      items: [
        "Haargel/Puder/Spray", "Zahnbürste", "Zahnpasta", "Haarkamm",
        "Duschgel / Duschseife", "Parfum",
      ],
    },
    {
      name: "Kleidung", emoji: "👕",
      items: [
        { name: "Freizeit-T-Shirts", qty: 6 },
        "Freizeithosen (Jeans, Cargohose)",
        { name: "Sport-T-Shirt", qty: 5 },
        { name: "Sporthose", qty: 3 },
        "Leichte Jacke",
        { name: "Schicke Hosen Gottesdienst", qty: 3 },
        { name: "Schicke T-Shirts/ Polos", qty: 5 },
        "Hausschuhe",
        { name: "Socken (Paar)", qty: 9 },
        { name: "Unterhosen", qty: 9 },
        "Wanderhose",
        { name: "Wandersocken", qty: 3 },
      ],
    },
    {
      name: "Schuhe", emoji: "👟",
      items: ["Fußballschuhe", "Hallenschuhe", "Sneaker", "Sportschuhe", "Hausschuhe", "Wanderschuhe"],
    },
    {
      name: "Elektronik", emoji: "💻",
      items: ["Surface", "Ladekabel Surface / Handy", "Kopfhörer", "Drohne"],
    },
    {
      name: "Unterlagen", emoji: "📚",
      items: ["Bibel", "Stifte"],
    },
    {
      name: "Sonstiges", emoji: "🎒",
      items: [
        "Sonnenbrille", "Rucksack", "Handtücher", "Bettzeug",
        "Decke/Kissen (für die Fahrt)", "Cap",
        "Portemonnaie", "Ausweis/Führerschein", "Trinkflasche",
        "Medikamente",
      ],
    },
  ];

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  function buildDefaultState() {
    return DEFAULT_DATA.map((cat) => ({
      id: uid(),
      name: cat.name,
      emoji: cat.emoji,
      items: cat.items.map((it) => {
        const obj = typeof it === "string" ? { name: it, qty: 1 } : it;
        return { id: uid(), name: obj.name, qty: obj.qty || 1, packed: 0 };
      }),
    }));
  }

  function sanitizeState(parsed) {
    if (!Array.isArray(parsed)) return null;
    const categories = parsed
      .filter((cat) => cat && typeof cat === "object")
      .map((cat) => {
        const items = Array.isArray(cat.items)
          ? cat.items
              .filter((it) => it && typeof it === "object" && typeof it.name === "string" && it.name.trim())
              .map((it) => {
                const qty = Number.isFinite(it.qty) && it.qty > 0 ? Math.floor(it.qty) : 1;
                const packed = Number.isFinite(it.packed) ? Math.max(0, Math.min(qty, Math.floor(it.packed))) : 0;
                const result = { id: typeof it.id === "string" ? it.id : uid(), name: it.name, qty, packed };
                if (it.suggested) {
                  result.suggested = true;
                  if (typeof it.reason === "string") result.reason = it.reason;
                }
                return result;
              })
          : [];
        return {
          id: typeof cat.id === "string" ? cat.id : uid(),
          name: typeof cat.name === "string" && cat.name.trim() ? cat.name : "Kategorie",
          emoji: typeof cat.emoji === "string" && cat.emoji ? cat.emoji : "📦",
          ...(cat.isWeather ? { isWeather: true } : {}),
          items,
        };
      });
    return categories.length ? categories : null;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return buildDefaultState();
      const sanitized = sanitizeState(JSON.parse(raw));
      return sanitized || buildDefaultState();
    } catch (e) {
      console.warn("Konnte gespeicherte Packliste nicht laden, starte mit Standardliste.", e);
      return buildDefaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  let state = loadState();

  // ---------- Theme ----------
  const themeToggleBtn = document.getElementById("themeToggle");
  function applyTheme(theme) {
    if (theme === "dark" || theme === "light") {
      document.documentElement.setAttribute("data-theme", theme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    const isDark = theme === "dark" ||
      (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    themeToggleBtn.textContent = isDark ? "☀️" : "🌙";
  }
  let savedTheme = localStorage.getItem(THEME_KEY);
  applyTheme(savedTheme);
  themeToggleBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });

  // ---------- Countdown ----------
  const tripDateInput = document.getElementById("tripDate");
  const countdownText = document.getElementById("countdownText");
  function updateCountdown() {
    const val = tripDateInput.value;
    if (!val) {
      countdownText.textContent = "📅 Reisedatum festlegen";
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const trip = new Date(val + "T00:00:00");
    const diffDays = Math.round((trip - today) / 86400000);
    if (diffDays > 1) countdownText.textContent = `🚌 Noch ${diffDays} Tage bis zur Reise!`;
    else if (diffDays === 1) countdownText.textContent = "🚌 Morgen geht's los!";
    else if (diffDays === 0) countdownText.textContent = "🎉 Heute geht's los – viel Spaß!";
    else countdownText.textContent = "✅ Die Reise hat schon begonnen";
  }
  const savedTripDate = localStorage.getItem(TRIP_DATE_KEY);
  if (savedTripDate) tripDateInput.value = savedTripDate;
  updateCountdown();
  tripDateInput.addEventListener("change", () => {
    localStorage.setItem(TRIP_DATE_KEY, tripDateInput.value);
    updateCountdown();
  });

  // ---------- Weather ----------
  const destinationInput = document.getElementById("destinationInput");
  const weatherBtn = document.getElementById("weatherBtn");
  const weatherResultEl = document.getElementById("weatherResult");

  const savedDestination = localStorage.getItem(DESTINATION_KEY);
  if (savedDestination) destinationInput.value = savedDestination;

  function showWeatherResult(text, isError) {
    weatherResultEl.textContent = text;
    weatherResultEl.classList.remove("hidden");
    weatherResultEl.classList.toggle("weather-result-error", !!isError);
  }

  function applyWeatherSuggestions({ tMax, tMin, rainProb, rainSum }) {
    const suggestions = [];
    if (rainProb >= 50 || rainSum > 0.5) {
      suggestions.push({ name: "Regenjacke", reason: "Regen erwartet" });
      suggestions.push({ name: "Wasserdichte Schuhe", reason: "Regen erwartet" });
    }
    if (tMin < 10) {
      suggestions.push({ name: "Warme Jacke", reason: `Kalt (${Math.round(tMin)}°C)` });
      suggestions.push({ name: "Mütze", reason: `Kalt (${Math.round(tMin)}°C)` });
      suggestions.push({ name: "Handschuhe", reason: `Kalt (${Math.round(tMin)}°C)` });
    }
    if (tMax > 25) {
      suggestions.push({ name: "Kurze Klamotten (Shorts/T-Shirts)", reason: `Warm (${Math.round(tMax)}°C)` });
      suggestions.push({ name: "Sonnenhut", reason: `Warm (${Math.round(tMax)}°C)` });
      suggestions.push({ name: "Sonnencreme", reason: `Warm (${Math.round(tMax)}°C)` });
    }

    let weatherCat = state.find((c) => c.isWeather);

    if (suggestions.length === 0) {
      if (weatherCat && weatherCat.items.length === 0) {
        state = state.filter((c) => c !== weatherCat);
      }
      saveState();
      render();
      return;
    }

    if (!weatherCat) {
      weatherCat = { id: uid(), name: "Wetter-Empfehlungen", emoji: "🌦️", isWeather: true, items: [] };
      state.unshift(weatherCat);
    }
    // Refresh pending (not-yet-decided) suggestions, keep ones already accepted.
    weatherCat.items = weatherCat.items.filter((it) => !it.suggested);
    suggestions.forEach((s) => {
      if (weatherCat.items.some((it) => it.name === s.name)) return;
      weatherCat.items.push({ id: uid(), name: s.name, qty: 1, packed: 0, suggested: true, reason: s.reason });
    });

    saveState();
    render();
  }

  async function fetchWeatherSuggestions() {
    const destination = destinationInput.value.trim();
    const date = tripDateInput.value;

    if (!destination) {
      showWeatherResult("Bitte einen Zielort eingeben.", true);
      return;
    }
    if (!date) {
      showWeatherResult("Bitte zuerst ein Reisedatum eingeben.", true);
      return;
    }

    localStorage.setItem(DESTINATION_KEY, destination);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date + "T00:00:00");
    const diffDays = Math.round((target - today) / 86400000);

    if (diffDays < 0) {
      showWeatherResult("Das Reisedatum liegt in der Vergangenheit.", true);
      return;
    }
    if (diffDays > 16) {
      showWeatherResult(
        `Die Wettervorhersage ist erst ca. 16 Tage vor der Reise verfügbar (noch ${diffDays} Tage). Bitte näher am Reisedatum nochmal abrufen.`,
        true
      );
      return;
    }

    weatherBtn.disabled = true;
    const originalLabel = weatherBtn.textContent;
    weatherBtn.textContent = "⏳ Lädt…";

    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=de&format=json`
      );
      if (!geoRes.ok) throw new Error("geo");
      const geoData = await geoRes.json();
      const place = geoData.results && geoData.results[0];
      if (!place) {
        showWeatherResult(`Ort "${destination}" wurde nicht gefunden.`, true);
        return;
      }

      const forecastRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum` +
          `&timezone=auto&start_date=${date}&end_date=${date}`
      );
      if (!forecastRes.ok) throw new Error("forecast");
      const forecastData = await forecastRes.json();
      const daily = forecastData.daily;
      if (!daily || !Array.isArray(daily.time) || daily.time.length === 0) {
        showWeatherResult("Für dieses Datum liegt noch keine Vorhersage vor.", true);
        return;
      }

      const tMax = daily.temperature_2m_max[0];
      const tMin = daily.temperature_2m_min[0];
      const rainProb = Array.isArray(daily.precipitation_probability_max) ? daily.precipitation_probability_max[0] || 0 : 0;
      const rainSum = Array.isArray(daily.precipitation_sum) ? daily.precipitation_sum[0] || 0 : 0;

      const placeLabel = [place.name, place.country].filter(Boolean).join(", ");
      showWeatherResult(
        `📍 ${placeLabel}: ${Math.round(tMin)}–${Math.round(tMax)}°C, Regenwahrscheinlichkeit ${Math.round(rainProb)}%`,
        false
      );

      applyWeatherSuggestions({ tMax, tMin, rainProb, rainSum });
    } catch (e) {
      showWeatherResult("Wetterdaten konnten nicht geladen werden. Bitte später erneut versuchen.", true);
    } finally {
      weatherBtn.disabled = false;
      weatherBtn.textContent = originalLabel;
    }
  }

  weatherBtn.addEventListener("click", fetchWeatherSuggestions);

  // ---------- Rendering ----------
  const categoriesEl = document.getElementById("categories");
  const categoryTemplate = document.getElementById("categoryTemplate");
  const itemTemplate = document.getElementById("itemTemplate");
  const progressFill = document.getElementById("progressFill");
  const progressText = document.getElementById("progressText");
  const progressPercent = document.getElementById("progressPercent");
  const searchInput = document.getElementById("searchInput");

  let celebrated = false;

  function itemTotals(item) {
    return { total: item.qty, packed: Math.min(item.packed, item.qty) };
  }

  function categoryTotals(cat) {
    return cat.items.reduce(
      (acc, it) => {
        if (it.suggested) return acc;
        const { total, packed } = itemTotals(it);
        acc.total += total;
        acc.packed += packed;
        return acc;
      },
      { total: 0, packed: 0 }
    );
  }

  function overallTotals() {
    return state.reduce(
      (acc, cat) => {
        const t = categoryTotals(cat);
        acc.total += t.total;
        acc.packed += t.packed;
        return acc;
      },
      { total: 0, packed: 0 }
    );
  }

  function render() {
    const query = searchInput.value.trim().toLowerCase();
    categoriesEl.innerHTML = "";

    if (state.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = "Noch keine Kategorien. Leg mit <strong>+ Kategorie</strong> los!";
      categoriesEl.appendChild(empty);
    }

    state.forEach((cat) => {
      const node = categoryTemplate.content.firstElementChild.cloneNode(true);
      node.dataset.catId = cat.id;
      node.querySelector(".category-emoji").textContent = cat.emoji || "📦";
      node.querySelector(".category-name").textContent = cat.name;

      const list = node.querySelector(".item-list");
      let visibleCount = 0;

      cat.items.forEach((item) => {
        const li = itemTemplate.content.firstElementChild.cloneNode(true);
        li.dataset.itemId = item.id;
        li.dataset.qty = item.qty;

        const { total, packed } = itemTotals(item);
        const isPacked = packed >= total;
        li.classList.toggle("packed", isPacked);

        const checkbox = li.querySelector(".item-checkbox");
        checkbox.checked = isPacked;
        li.querySelector(".item-name").textContent = item.name;
        li.querySelector(".qty-display").textContent = `${packed}/${total}`;
        if (item.reason) li.querySelector(".item-reason").textContent = `💡 ${item.reason}`;

        const matches = !query || item.name.toLowerCase().includes(query);
        if (!matches) li.classList.add("hidden-by-search");
        else visibleCount++;

        if (item.suggested) {
          li.classList.add("suggested");
          li.querySelector(".suggest-accept").addEventListener("click", () => {
            item.suggested = false;
            saveState();
            render();
          });
          li.querySelector(".suggest-decline").addEventListener("click", () => {
            cat.items = cat.items.filter((i) => i.id !== item.id);
            saveState();
            render();
          });
        }

        checkbox.addEventListener("change", () => {
          item.packed = checkbox.checked ? item.qty : 0;
          saveState();
          render();
          maybeCelebrate();
        });

        li.querySelector(".qty-minus").addEventListener("click", () => {
          item.packed = Math.max(0, item.packed - 1);
          saveState();
          render();
        });
        li.querySelector(".qty-plus").addEventListener("click", () => {
          item.packed = Math.min(item.qty, item.packed + 1);
          saveState();
          render();
          maybeCelebrate();
        });

        li.querySelector(".item-delete").addEventListener("click", () => {
          cat.items = cat.items.filter((i) => i.id !== item.id);
          saveState();
          render();
        });

        list.appendChild(li);
      });

      if (query && visibleCount === 0) {
        node.style.display = "none";
      }

      const totals = categoryTotals(cat);
      const pct = totals.total ? Math.round((totals.packed / totals.total) * 100) : 0;
      node.querySelector(".mini-progress-fill").style.width = `${pct}%`;
      node.querySelector(".mini-progress-text").textContent = `${pct}%`;

      node.querySelector(".cat-check-all").addEventListener("click", () => {
        cat.items.forEach((i) => { if (!i.suggested) i.packed = i.qty; });
        saveState();
        render();
        maybeCelebrate();
      });
      node.querySelector(".cat-uncheck-all").addEventListener("click", () => {
        cat.items.forEach((i) => { if (!i.suggested) i.packed = 0; });
        saveState();
        render();
      });
      node.querySelector(".cat-delete").addEventListener("click", () => {
        if (confirm(`Kategorie "${cat.name}" wirklich löschen?`)) {
          state = state.filter((c) => c.id !== cat.id);
          saveState();
          render();
        }
      });

      const form = node.querySelector(".add-item-form");
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = form.querySelector(".add-item-input");
        const qtyInput = form.querySelector(".add-item-qty");
        const name = input.value.trim();
        if (!name) return;
        const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
        cat.items.push({ id: uid(), name, qty, packed: 0 });
        input.value = "";
        qtyInput.value = "1";
        saveState();
        render();
      });

      categoriesEl.appendChild(node);
    });

    const totals = overallTotals();
    const pct = totals.total ? Math.round((totals.packed / totals.total) * 100) : 0;
    progressFill.style.width = `${pct}%`;
    progressText.textContent = `${totals.packed} / ${totals.total} gepackt`;
    progressPercent.textContent = `${pct}%`;
  }

  function maybeCelebrate() {
    const { total, packed } = overallTotals();
    if (total > 0 && packed >= total) {
      if (!celebrated) {
        celebrated = true;
        showCelebration();
      }
    } else {
      celebrated = false;
    }
  }

  // ---------- Add category ----------
  document.getElementById("addCategoryBtn").addEventListener("click", () => {
    const name = prompt("Name der neuen Kategorie:");
    if (!name || !name.trim()) return;
    const emoji = prompt("Emoji für die Kategorie (optional):", "📦") || "📦";
    state.push({ id: uid(), name: name.trim(), emoji: emoji.trim(), items: [] });
    saveState();
    render();
  });

  // ---------- Reset ----------
  document.getElementById("resetBtn").addEventListener("click", () => {
    if (confirm("Wirklich alle Haken zurücksetzen?")) {
      state.forEach((cat) => cat.items.forEach((i) => (i.packed = 0)));
      celebrated = false;
      saveState();
      render();
    }
  });

  // ---------- Search ----------
  searchInput.addEventListener("input", render);

  // ---------- Export / Import ----------
  document.getElementById("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `packliste-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const importFileInput = document.getElementById("importFile");
  document.getElementById("importBtn").addEventListener("click", () => importFileInput.click());
  importFileInput.addEventListener("change", () => {
    const file = importFileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const sanitized = sanitizeState(JSON.parse(reader.result));
        if (!sanitized) throw new Error("Ungültiges Format");
        state = sanitized;
        saveState();
        render();
      } catch (e) {
        alert("Die Datei konnte nicht gelesen werden. Ist es eine gültige Packlisten-Export-Datei?");
      }
    };
    reader.readAsText(file);
    importFileInput.value = "";
  });

  // ---------- Share as text ----------
  document.getElementById("shareBtn").addEventListener("click", async () => {
    let text = "🎒 Packliste\n\n";
    state.forEach((cat) => {
      const confirmedItems = cat.items.filter((item) => !item.suggested);
      if (!confirmedItems.length) return;
      text += `${cat.emoji || ""} ${cat.name}\n`;
      confirmedItems.forEach((item) => {
        const box = item.packed >= item.qty ? "☑" : "☐";
        const qtyLabel = item.qty > 1 ? ` (${item.packed}/${item.qty})` : "";
        text += `${box} ${item.name}${qtyLabel}\n`;
      });
      text += "\n";
    });
    if (navigator.share) {
      try {
        await navigator.share({ title: "Packliste", text });
        return;
      } catch (e) {
        /* user cancelled or share failed, fall back to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      alert("Packliste wurde in die Zwischenablage kopiert!");
    } catch (e) {
      alert("Teilen wird auf diesem Gerät nicht unterstützt.");
    }
  });

  // ---------- Celebration + confetti ----------
  const celebrationEl = document.getElementById("celebration");
  document.getElementById("celebrationClose").addEventListener("click", () => {
    celebrationEl.classList.add("hidden");
  });

  function showCelebration() {
    celebrationEl.classList.remove("hidden");
    launchConfetti();
  }

  function launchConfetti() {
    const layer = document.getElementById("confettiLayer");
    const colors = ["#5b6ee1", "#ff8a5b", "#33c481", "#ffce54", "#e5566f"];
    const count = 120;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      const size = 6 + Math.random() * 6;
      piece.style.width = `${size}px`;
      piece.style.height = `${size * 0.4}px`;
      piece.style.left = `${Math.random() * 100}vw`;
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      const duration = 2.5 + Math.random() * 2;
      const delay = Math.random() * 0.5;
      piece.style.animationDuration = `${duration}s`;
      piece.style.animationDelay = `${delay}s`;
      layer.appendChild(piece);
      setTimeout(() => piece.remove(), (duration + delay) * 1000 + 200);
    }
  }

  // ---------- Service worker (offline / installable) ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  render();
})();
