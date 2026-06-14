const nav = document.querySelector("[data-nav]");
const navToggle = document.querySelector("[data-nav-toggle]");
const navLinks = [...document.querySelectorAll(".site-nav a")];
const sections = [...document.querySelectorAll("main section[id]")];
const notesGrid = document.querySelector("[data-notes-grid]");
const paginationControls = [...document.querySelectorAll("[data-pagination]")];

const publicBase = document.querySelector('meta[name="data-base"]')?.content || "";
const resolvePublicPath = (assetPath) => {
  if (!assetPath || /^(?:[a-z]+:)?\/\//i.test(assetPath) || assetPath.startsWith("data:")) {
    return assetPath;
  }
  return `${publicBase}${assetPath.replace(/^\/+/, "")}`;
};
const resolvePublicSrcset = (srcset) =>
  srcset
    .split(",")
    .map((candidate) => {
      const [assetPath, descriptor] = candidate.trim().split(/\s+/, 2);
      return `${resolvePublicPath(assetPath)}${descriptor ? ` ${descriptor}` : ""}`;
    })
    .join(", ");
const dataManifestPath = resolvePublicPath("data/manifest.json");
const pageCache = new Map();
let dataManifest = { pages: [], pageSize: 9, totalItems: 0 };
let currentPage = 0;
let activeRenderRequest = 0;

const createTextElement = (tagName, className, text) => {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text || "未提供";
  return element;
};

const getTotalPages = () => Math.max(1, dataManifest.pages.length);

const getVisiblePageItems = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index);

  const visible = new Set([0, total - 1, current - 1, current, current + 1]);
  if (current <= 2) [1, 2, 3].forEach((page) => visible.add(page));
  if (current >= total - 3) {
    [total - 4, total - 3, total - 2].forEach((page) => visible.add(page));
  }

  const pages = [...visible].filter((page) => page >= 0 && page < total).sort((a, b) => a - b);
  const items = [];

  pages.forEach((page, index) => {
    if (index > 0 && page - pages[index - 1] > 1) items.push("ellipsis");
    items.push(page);
  });
  return items;
};

const renderPageList = (container, totalPages) => {
  container.textContent = "";

  getVisiblePageItems(currentPage, totalPages).forEach((item) => {
    if (item === "ellipsis") {
      const ellipsis = createTextElement("span", "page-ellipsis", "…");
      container.append(ellipsis);
      return;
    }

    const pageButton = document.createElement("button");
    pageButton.className = "page-number";
    pageButton.type = "button";
    pageButton.textContent = String(item + 1);
    pageButton.dataset.pageIndex = String(item);
    pageButton.setAttribute("aria-label", `前往第 ${item + 1} 頁`);

    if (item === currentPage) {
      pageButton.disabled = true;
      pageButton.setAttribute("aria-current", "page");
    }
    container.append(pageButton);
  });
};

const updatePaginationControls = () => {
  const totalPages = getTotalPages();

  paginationControls.forEach((pagination) => {
    pagination.hidden = !dataManifest.totalItems;
    const pageStatus = pagination.querySelector("[data-page-status]");
    const prevPageButton = pagination.querySelector("[data-page-prev]");
    const nextPageButton = pagination.querySelector("[data-page-next]");
    const pageList = pagination.querySelector("[data-page-list]");

    if (pageStatus) pageStatus.textContent = `第 ${currentPage + 1} / ${totalPages} 頁`;
    if (prevPageButton) prevPageButton.disabled = currentPage === 0;
    if (nextPageButton) nextPageButton.disabled = currentPage >= totalPages - 1;
    if (pageList) renderPageList(pageList, totalPages);
  });
};

const createField = (label, value, extraClass = "") => {
  const field = document.createElement("div");
  field.className = "note-field";
  field.append(
    createTextElement("span", "note-label", label),
    createTextElement("p", `note-value ${extraClass}`.trim(), value)
  );
  return field;
};

const createTags = (values) => {
  const tagWrap = document.createElement("div");
  tagWrap.className = "note-tags";
  (Array.isArray(values) && values.length ? values : ["未分類"]).forEach((tag) => {
    tagWrap.append(createTextElement("span", "note-tag", tag));
  });
  return tagWrap;
};

const createSourceLink = (sourceUrl) => {
  const source = document.createElement("div");
  source.className = "note-source";
  const valueElement = sourceUrl ? document.createElement("a") : document.createElement("p");
  valueElement.className = sourceUrl ? "source-link" : "note-value";
  valueElement.textContent = sourceUrl ? "教育部辭典" : "未提供";

  if (sourceUrl) {
    valueElement.href = sourceUrl;
    valueElement.target = "_blank";
    valueElement.rel = "noopener noreferrer";
  }
  source.append(createTextElement("span", "note-label", "source"), valueElement);
  return source;
};

const createNoteImage = (note) => {
  const illustration = document.createElement("div");
  illustration.className = "note-illustration";
  const placeholder = createTextElement("span", "note-image-placeholder", "尚未加入圖片");
  illustration.append(placeholder);

  if (!note?.image?.fallback || !note.image.srcset) {
    illustration.classList.add("is-placeholder");
    return illustration;
  }

  const picture = document.createElement("picture");
  const source = document.createElement("source");
  source.type = "image/webp";
  source.srcset = resolvePublicSrcset(note.image.srcset);
  source.sizes =
    "(max-width: 720px) calc(100vw - 70px), " +
    "(max-width: 980px) calc(50vw - 54px), 370px";

  const image = document.createElement("img");
  image.className = "note-image";
  image.src = resolvePublicPath(note.image.fallback);
  image.alt = note.imageAlt || `${note.term}田調插圖`;
  image.width = note.image.width;
  image.height = note.image.height;
  image.loading = "lazy";
  image.decoding = "async";
  image.fetchPriority = "low";

  image.addEventListener("load", () => illustration.classList.add("is-loaded"));
  image.addEventListener("error", () => {
    picture.remove();
    illustration.classList.add("is-placeholder");
  });

  picture.append(source, image);
  illustration.prepend(picture);
  return illustration;
};

const renderEmptyState = (message) => {
  if (!notesGrid) return;
  notesGrid.textContent = "";
  notesGrid.append(createTextElement("p", "empty-note", message));
};

const renderFieldNotes = (fieldNotes, startIndex = 0) => {
  if (!notesGrid) return;
  if (!fieldNotes.length) {
    renderEmptyState("目前還沒有可顯示的田調素材。");
    return;
  }

  notesGrid.textContent = "";
  fieldNotes.forEach((note, index) => {
    const card = document.createElement("article");
    card.className = "note-card";

    const cardTop = document.createElement("div");
    cardTop.className = "note-card-top";
    cardTop.append(
      createTextElement(
        "p",
        "note-index",
        `specimen ${String(startIndex + index + 1).padStart(2, "0")}`
      ),
      createTags(note.sensoryTags)
    );

    const termBlock = document.createElement("header");
    termBlock.className = "note-term-block";
    termBlock.append(
      createTextElement("h3", "note-term", note.term),
      createTextElement("p", "note-pronunciation", note.pronunciation)
    );

    const body = document.createElement("div");
    body.className = "note-body";
    body.append(
      createField("釋義", note.definition),
      createField("田調筆記", note.fieldNote, "field-note-text")
    );

    card.append(
      createNoteImage(note),
      cardTop,
      termBlock,
      body,
      createSourceLink(note.sourceUrl)
    );
    notesGrid.append(card);
  });
};

const loadPage = async (pageIndex) => {
  if (pageCache.has(pageIndex)) return pageCache.get(pageIndex);
  const pagePath = dataManifest.pages[pageIndex];
  if (!pagePath) return [];

  const resolvedPagePath = resolvePublicPath(pagePath);
  const response = await fetch(resolvedPagePath, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Unable to load ${pagePath}`);
  const payload = await response.json();
  const items = Array.isArray(payload?.items) ? payload.items : [];
  pageCache.set(pageIndex, items);
  return items;
};

const renderCurrentPage = async () => {
  const requestId = ++activeRenderRequest;
  currentPage = Math.min(Math.max(currentPage, 0), getTotalPages() - 1);
  renderEmptyState("正在讀取田調素材。");
  updatePaginationControls();

  try {
    const notes = await loadPage(currentPage);
    if (requestId !== activeRenderRequest) return;
    renderFieldNotes(notes, currentPage * dataManifest.pageSize);
  } catch (error) {
    console.warn("田調素材讀取失敗。", error);
    renderEmptyState("田調素材暫時無法讀取。");
  }
};

const goToPage = async (page, shouldScroll = false) => {
  currentPage = page;
  await renderCurrentPage();
  if (shouldScroll) notesGrid?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const loadFieldNotes = async () => {
  renderEmptyState("正在讀取田調素材。");
  try {
    const response = await fetch(dataManifestPath, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Unable to load ${dataManifestPath}`);
    const payload = await response.json();
    if (!Array.isArray(payload?.pages)) throw new Error("Invalid public data manifest");
    dataManifest = payload;
    await goToPage(0);
  } catch (error) {
    console.warn("田調素材清單讀取失敗。", error);
    renderEmptyState("田調素材暫時無法讀取。");
  }
};

const closeMenu = () => {
  document.body.classList.remove("nav-open");
  nav?.classList.remove("is-open");
  navToggle?.setAttribute("aria-expanded", "false");
};

navToggle?.addEventListener("click", () => {
  const isOpen = navToggle.getAttribute("aria-expanded") === "true";
  document.body.classList.toggle("nav-open", !isOpen);
  nav?.classList.toggle("is-open", !isOpen);
  navToggle.setAttribute("aria-expanded", String(!isOpen));
});

paginationControls.forEach((pagination) => {
  pagination.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.matches("[data-page-prev]")) {
      void goToPage(Math.max(0, currentPage - 1), true);
      return;
    }
    if (target.matches("[data-page-next]")) {
      void goToPage(Math.min(getTotalPages() - 1, currentPage + 1), true);
      return;
    }
    if (target.dataset.pageIndex) {
      void goToPage(Number(target.dataset.pageIndex), true);
    }
  });
});

navLinks.forEach((link) => link.addEventListener("click", closeMenu));

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`);
      });
    });
  },
  { rootMargin: "-48% 0px -48% 0px", threshold: 0 }
);

sections.forEach((section) => observer.observe(section));
void loadFieldNotes();
