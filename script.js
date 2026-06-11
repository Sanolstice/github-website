const nav = document.querySelector("[data-nav]");
const navToggle = document.querySelector("[data-nav-toggle]");
const navLinks = [...document.querySelectorAll(".site-nav a")];
const sections = [...document.querySelectorAll("main section[id]")];
const notesGrid = document.querySelector("[data-notes-grid]");
const paginationControls = [...document.querySelectorAll("[data-pagination]")];

const dataDirectory = "data/field-notes";
const generatedImagesDirectory = "/generated-images";
const dataRequestVersion = Date.now().toString();
const withDataCacheBuster = (path) => {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${dataRequestVersion}`;
};
const dataIndexPath = withDataCacheBuster(`${dataDirectory}/index.json`);
const notesPerPage = 9;
let allFieldNotes = [];
let currentPage = 0;

const createTextElement = (tagName, className, text) => {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text || "未提供";
  return element;
};

const normalizeText = (value, fallback = "未提供") => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
};

const normalizePublicText = (value, fallback = "未提供") =>
  normalizeText(value, fallback)
    .replace(/[（(]\s*ABB\s*[）)]/gi, "")
    .replace(/\bABB\b\s*/gi, "")
    .trim();

const normalizeTags = (value) => {
  const isPublicTag = (tag) => !/(ABB|路線\s*A|巡熱詞|温若喬|社群來源|Threads|收詞)/i.test(tag);

  if (Array.isArray(value)) {
    const tags = value.map((tag) => normalizeText(tag, "")).filter(Boolean).filter(isPublicTag);
    return tags.length ? tags : ["未分類"];
  }

  if (typeof value === "string" && value.trim()) {
    const tags = value
      .split(/[,，、/]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .filter(isPublicTag);
    return tags.length ? tags : ["未分類"];
  }

  return ["未分類"];
};

const normalizeSourceUrl = (note) => {
  const sourceValue = getNoteValue(note, ["sourceUrl", "sourceURL", "url", "link"]);
  if (sourceValue) return normalizeText(sourceValue, "");

  const source = note?.source;
  if (typeof source === "string" && /^(https?:)?\/\//.test(source)) return source;
  if (source?.url) return normalizeText(source.url, "");
  if (source?.href) return normalizeText(source.href, "");

  const dictionaryLinks = note?.字典連結;
  if (dictionaryLinks?.教育部臺灣台語常用詞辭典) {
    return normalizeText(dictionaryLinks.教育部臺灣台語常用詞辭典, "");
  }
  if (dictionaryLinks?.教育部) return normalizeText(dictionaryLinks.教育部, "");

  return "";
};

const normalizeFieldNote = (note) => {
  const fieldNote = getNoteValue(note, ["fieldNote", "field_note", "note", "memo", "observation", "description", "田調筆記"]);
  return normalizeText(fieldNote, "還沒有田調筆記，先把這個詞留在口袋裡。");
};

const normalizeSourceMetadata = (note) => {
  const source = note?.社群來源;
  if (!source || typeof source !== "object") return "";

  return normalizeText(source.可公開 || source.public || source.label, "");
};

const normalizeImageUrl = (note) => {
  const explicitImage = normalizeText(
    getNoteValue(note, ["image", "imageUrl", "image_url", "圖片", "圖片路徑"]),
    ""
  );

  if (explicitImage) {
    if (/^(https?:)?\/\//.test(explicitImage) || explicitImage.startsWith("data:")) {
      return explicitImage;
    }

    const localImage = explicitImage.replace(/^\.?\//, "").replace(/^public\//, "");
    const imagePath = localImage.startsWith("generated-images/")
      ? `/${localImage}`
      : explicitImage;
    return withDataCacheBuster(imagePath);
  }

  const id = normalizeText(getNoteValue(note, ["id", "slug"]), "");
  return id
    ? withDataCacheBuster(`${generatedImagesDirectory}/${encodeURIComponent(id)}.png`)
    : "";
};

const normalizeImageAlt = (note) =>
  normalizeText(
    getNoteValue(note, ["alt", "imageAlt", "image_alt", "title", "description", "詞目"]),
    "田調插圖"
  );

const normalizeNote = (note = {}) => ({
  id: normalizeText(getNoteValue(note, ["id", "slug"]), ""),
  term: normalizeText(getNoteValue(note, ["term", "word", "title", "name", "詞", "詞目"])),
  pronunciation: normalizeText(getNoteValue(note, ["pronunciation", "reading", "romanization", "pinyin", "音讀", "台羅"]), "音讀未提供"),
  definition: normalizePublicText(getNoteValue(note, ["definition", "meaning", "description", "explanation", "釋義"])?.本義 || getNoteValue(note, ["definition", "meaning", "description", "explanation", "釋義"]), "釋義未提供"),
  fieldNote: normalizeFieldNote(note),
  sensoryTags: normalizeTags(note?.sensoryTags || getNoteValue(note, ["tags", "sensoryCategory", "category", "分類"])),
  sourceMetadata: normalizeSourceMetadata(note),
  sourceUrl: normalizeSourceUrl(note),
  imageUrl: normalizeImageUrl(note),
  imageAlt: normalizeImageAlt(note),
});

const getNotesFromPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.entries)) return payload.entries;
  if (Array.isArray(payload?.notes)) return payload.notes;
  if (Array.isArray(payload?.fieldNotes)) return payload.fieldNotes;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.records)) return payload.records;
  return [];
};

const normalizeNotes = (payload) => getNotesFromPayload(payload).map(normalizeNote);

const getNoteValue = (note, keys) => {
  for (const key of keys) {
    if (note?.[key]) return note[key];
  }
  return "";
};

const getTotalPages = () => Math.max(1, Math.ceil(allFieldNotes.length / notesPerPage));

const getPageNotes = (page) => {
  const startIndex = page * notesPerPage;
  return allFieldNotes.slice(startIndex, startIndex + notesPerPage);
};

const getVisiblePageItems = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index);

  const visible = new Set([0, total - 1, current - 1, current, current + 1]);

  if (current <= 2) {
    [1, 2, 3].forEach((page) => visible.add(page));
  }

  if (current >= total - 3) {
    [total - 4, total - 3, total - 2].forEach((page) => visible.add(page));
  }

  const pages = [...visible].filter((page) => page >= 0 && page < total).sort((a, b) => a - b);
  const items = [];

  pages.forEach((page, index) => {
    if (index > 0 && page - pages[index - 1] > 1) {
      items.push("ellipsis");
    }

    items.push(page);
  });

  return items;
};

const renderPageList = (container, totalPages) => {
  container.textContent = "";

  getVisiblePageItems(currentPage, totalPages).forEach((item) => {
    if (item === "ellipsis") {
      const ellipsis = document.createElement("span");
      ellipsis.className = "page-ellipsis";
      ellipsis.textContent = "…";
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
  if (!paginationControls.length) return;

  const totalPages = getTotalPages();

  paginationControls.forEach((pagination) => {
    pagination.hidden = !allFieldNotes.length;

    const pageStatus = pagination.querySelector("[data-page-status]");
    const prevPageButton = pagination.querySelector("[data-page-prev]");
    const nextPageButton = pagination.querySelector("[data-page-next]");
    const pageList = pagination.querySelector("[data-page-list]");

    if (pageStatus) {
      pageStatus.textContent = `第 ${currentPage + 1} / ${totalPages} 頁`;
    }

    if (prevPageButton) {
      prevPageButton.disabled = currentPage === 0;
    }

    if (nextPageButton) {
      nextPageButton.disabled = currentPage >= totalPages - 1;
    }

    if (pageList) {
      renderPageList(pageList, totalPages);
    }
  });
};

const renderCurrentPage = () => {
  const totalPages = getTotalPages();
  currentPage = Math.min(Math.max(currentPage, 0), totalPages - 1);
  renderFieldNotes(getPageNotes(currentPage), currentPage * notesPerPage);
  updatePaginationControls();
};

const goToPage = (page, shouldScroll = false) => {
  currentPage = page;
  renderCurrentPage();

  if (shouldScroll) {
    notesGrid?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

const createField = (label, value, extraClass = "") => {
  const field = document.createElement("div");
  field.className = "note-field";

  const labelElement = createTextElement("span", "note-label", label);
  const valueElement = createTextElement("p", `note-value ${extraClass}`.trim(), value);

  field.append(labelElement, valueElement);
  return field;
};

const createTags = (values) => {
  const tags = Array.isArray(values) ? values : values ? [values] : ["未提供"];
  const tagWrap = document.createElement("div");
  tagWrap.className = "note-tags";

  tags.forEach((tag) => {
    tagWrap.append(createTextElement("span", "note-tag", tag));
  });

  return tagWrap;
};

const createSourceLink = (sourceUrl) => {
  const source = document.createElement("div");
  source.className = "note-source";

  const labelElement = createTextElement("span", "note-label", "source");
  const valueElement = sourceUrl ? document.createElement("a") : document.createElement("p");
  valueElement.className = sourceUrl ? "source-link" : "note-value";
  valueElement.textContent = sourceUrl ? "教育部辭典" : "未提供";

  if (sourceUrl) {
    valueElement.href = sourceUrl;
    valueElement.target = "_blank";
    valueElement.rel = "noreferrer";
  }

  source.append(labelElement, valueElement);
  return source;
};

const createNoteImage = (note) => {
  const illustration = document.createElement("div");
  illustration.className = "note-illustration";

  const placeholder = createTextElement("span", "note-image-placeholder", "尚未加入圖片");
  illustration.append(placeholder);

  if (!note?.imageUrl) {
    illustration.classList.add("is-placeholder");
    return illustration;
  }

  const image = document.createElement("img");
  image.className = "note-image";
  image.src = note.imageUrl;
  image.alt = note.imageAlt || `${note.term}田調插圖`;
  image.loading = "lazy";
  image.decoding = "async";

  image.addEventListener("load", () => {
    illustration.classList.add("is-loaded");
  });

  image.addEventListener("error", () => {
    image.remove();
    illustration.classList.add("is-placeholder");
  });

  illustration.prepend(image);
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
    const term = getNoteValue(note, ["term"]);
    const pronunciation = getNoteValue(note, ["pronunciation"]);
    const definition = getNoteValue(note, ["definition"]);
    const fieldNote = getNoteValue(note, ["fieldNote"]);
    const sensoryTags = note?.sensoryTags || getNoteValue(note, ["sensoryCategory", "category"]);
    const sourceUrl = getNoteValue(note, ["sourceUrl"]);

    const card = document.createElement("article");
    card.className = "note-card";

    const cardTop = document.createElement("div");
    cardTop.className = "note-card-top";
    cardTop.append(
      createTextElement("p", "note-index", `specimen ${String(startIndex + index + 1).padStart(2, "0")}`),
      createTags(sensoryTags)
    );

    const termBlock = document.createElement("header");
    termBlock.className = "note-term-block";
    termBlock.append(
      createTextElement("h3", "note-term", term),
      createTextElement("p", "note-pronunciation", pronunciation)
    );

    const body = document.createElement("div");
    body.className = "note-body";
    body.append(
      createField("釋義", definition),
      createField("田調筆記", fieldNote, "field-note-text")
    );

    card.append(
      createNoteImage(note),
      cardTop,
      termBlock,
      body,
      createSourceLink(sourceUrl)
    );

    notesGrid.append(card);
  });
};


const normalizeDataPaths = (payload) => {
  const files = Array.isArray(payload) ? payload : payload?.files;
  if (!Array.isArray(files)) return [];

  return files
    .map((file) => {
      const path = typeof file === "string" ? file : file?.path || file?.file || file?.url;
      if (!path) return "";
      if (/^(https?:)?\/\//.test(path) || path.startsWith("/")) {
        return withDataCacheBuster(path);
      }
      return withDataCacheBuster(`${dataDirectory}/${path}`);
    })
    .filter(Boolean);
};

const loadDataIndex = async () => {
  const response = await fetch(dataIndexPath, { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load ${dataIndexPath}`);

  const payload = await response.json();
  return normalizeDataPaths(payload);
};

const loadJsonFile = async (path) => {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    return normalizeNotes(payload);
  } catch (error) {
    console.warn(`無法讀取資料檔：${path}`, error);
    return [];
  }
};

const loadFieldNotes = async () => {
  renderEmptyState("正在讀取田調素材。");

  try {
    const dataPaths = await loadDataIndex();
    if (!dataPaths.length) throw new Error(`No JSON files listed in ${dataIndexPath}`);

    const loadedNotes = [];
    for (const path of dataPaths) {
      const notes = await loadJsonFile(path);
      loadedNotes.push(...notes);
    }

    allFieldNotes = loadedNotes.reverse();
    currentPage = 0;
    renderCurrentPage();
  } catch (error) {
    console.warn("田調素材清單讀取失敗。", error);
    renderEmptyState("尚未讀取到 data/field-notes/index.json。請用 localhost 預覽，或確認資料檔已放在 data/field-notes 資料夾。");
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

    const totalPages = getTotalPages();

    if (target.matches("[data-page-prev]")) {
      goToPage(Math.max(0, currentPage - 1), true);
      return;
    }

    if (target.matches("[data-page-next]")) {
      goToPage(Math.min(totalPages - 1, currentPage + 1), true);
      return;
    }

    const pageIndex = target.dataset.pageIndex;
    if (pageIndex) {
      goToPage(Number(pageIndex), true);
    }
  });
});

navLinks.forEach((link) => {
  link.addEventListener("click", closeMenu);
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      navLinks.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`);
      });
    });
  },
  {
    rootMargin: "-48% 0px -48% 0px",
    threshold: 0,
  }
);

sections.forEach((section) => observer.observe(section));
loadFieldNotes();
