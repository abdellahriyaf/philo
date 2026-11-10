/* © 2026 الفلسفة — مساحة المراجعة. All rights reserved. Unauthorized copying, republishing or modification is prohibited. Origin ID: PHL-C88920325B7DD9DB */
(() => {
  "use strict";

  const root = document.querySelector("#units");
  const site = window.SITE;
  const safeHref = (value) => typeof value === "string"
    && /^content\/[A-Za-z0-9._/-]+\.html$/.test(value)
    && !value.includes("..");

  if (root && site && Array.isArray(site.units)) {
    const fragment = document.createDocumentFragment();
    try {
      for (const unit of site.units) {
        if (!unit || !Array.isArray(unit.subunits)) throw new Error("Invalid unit configuration");

        const section = document.createElement("section");
        section.className = unit.id === 5 ? "unit unit-support" : "unit";
        section.id = `unit-${String(unit.id ?? "")}`;

        const heading = document.createElement("div");
        heading.className = "unit-head";
        const number = document.createElement("span");
        number.className = "unit-no";
        number.textContent = unit.id === 5 ? "+" : String(unit.id ?? "").padStart(2, "0");

        const copy = document.createElement("div");
        copy.className = "unit-copy";
        const kicker = document.createElement("p");
        kicker.className = "unit-kicker";
        kicker.textContent = unit.id === 5 ? "مرجع إضافي" : `المجزوءة ${["الأولى", "الثانية", "الثالثة", "الرابعة"][Number(unit.id) - 1] || String(unit.id)}`;
        const title = document.createElement("h3");
        title.textContent = String(unit.title ?? "");
        const description = document.createElement("p");
        description.textContent = String(unit.desc ?? "");
        copy.append(kicker, title, description);
        heading.append(number, copy);

        const list = document.createElement("ul");
        list.className = "unit-lessons";
        for (const lesson of unit.subunits) {
          if (!lesson || !safeHref(lesson.file)) throw new Error("Invalid lesson link in site config");
          const item = document.createElement("li");
          const anchor = document.createElement("a");
          anchor.href = lesson.file;
          const label = document.createElement("span");
          label.textContent = String(lesson.title ?? "");
          const arrow = document.createElement("span");
          arrow.textContent = "←";
          arrow.setAttribute("aria-hidden", "true");
          anchor.append(label, arrow);
          item.append(anchor);
          list.append(item);
        }
        section.append(heading, list);
        fragment.append(section);
      }
      root.replaceChildren(fragment);
    } catch (error) {
      console.error("Could not render the configured lesson list; keeping static links.", error);
    }
  }

  // Search only the visible unit and lesson titles; lesson body text is not indexed.
  const search = document.querySelector("#lesson-search");
  const countLabel = document.querySelector("#search-count");
  const emptyState = document.querySelector("#empty-search");
  if (root && search) {
    const normalize = (value) => String(value ?? "")
      .toLocaleLowerCase("ar")
      .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
      .trim();
    const cards = [...root.querySelectorAll(".unit")];
    const updateResults = () => {
      const query = normalize(search.value);
      let visibleUnits = 0;
      let visibleLessons = 0;
      for (const card of cards) {
        const text = normalize(card.textContent);
        const visible = !query || text.includes(query);
        card.hidden = !visible;
        if (visible) {
          visibleUnits += 1;
          visibleLessons += card.querySelectorAll(".unit-lessons a").length;
        }
      }
      if (countLabel) {
        countLabel.textContent = query
          ? `${visibleLessons} درسًا ضمن ${visibleUnits} مجزوءة`
          : `جميع الدروس · ${visibleLessons} دروس`;
      }
      if (emptyState) emptyState.hidden = visibleUnits !== 0;
    };
    search.addEventListener("input", updateResults);
    updateResults();
  }
})();
