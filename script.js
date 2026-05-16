const nav = document.querySelector("[data-nav]");
const navToggle = document.querySelector("[data-nav-toggle]");
const navLinks = [...document.querySelectorAll(".site-nav a")];
const sections = [...document.querySelectorAll("main section[id]")];
const notesGrid = document.querySelector("[data-notes-grid]");
const shuffleButton = document.querySelector("[data-shuffle-notes]");

const dataPath = "data/field-notes.json";
const notesPerDraw = 5;
let allFieldNotes = [];
let drawPool = [];

const createTextElement = (tagName, className, text) => {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text || "未提供";
  return element;
};

const normalizeNotes = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.notes)) return payload.notes;
  if (Array.isArray(payload?.fieldNotes)) return payload.fieldNotes;
  return [];
};

const getNoteValue = (note, keys) => {
  for (const key of keys) {
    if (note?.[key]) return note[key];
  }
  return "";
};

const shuffle = (items) => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
};

const drawRandomNotes = () => {
  if (drawPool.length < notesPerDraw) {
    drawPool = shuffle(allFieldNotes);
  }

  return drawPool.splice(0, Math.min(notesPerDraw, drawPool.length));
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

const svgShell = (title, content) => `
  <svg class="spot-svg" viewBox="0 0 260 170" role="img" aria-label="${title}" focusable="false">
    <rect class="paper-base" x="12" y="12" width="236" height="146" rx="4"></rect>
    ${content}
  </svg>
`;

const illustrationTemplates = {
  澩澩: svgShell("芋頭與蘿蔔切面插圖", `
    <ellipse class="shadow" cx="132" cy="132" rx="72" ry="12"></ellipse>
    <path class="root root-a" d="M70 73c9-26 42-37 62-17 16 16 15 43-5 59-22 18-62 4-57-42z"></path>
    <path class="root-line" d="M86 72c12 9 26 15 45 16M82 92c16 5 30 7 47 4"></path>
    <path class="radish" d="M158 56c33 15 43 50 18 66-24 15-58-12-49-43 4-15 14-24 31-23z"></path>
    <path class="leaf" d="M158 54c-1-19 10-28 26-31-4 17-12 27-26 31zM166 57c12-16 26-19 41-13-11 12-24 17-41 13z"></path>
    <path class="cut-line" d="M145 79c13 8 29 11 45 9M141 99c17 7 34 7 47 2"></path>
  `),
  "𩚨嗲嗲": svgShell("碗盤裡有彈性的食物插圖", `
    <ellipse class="shadow" cx="132" cy="136" rx="78" ry="10"></ellipse>
    <path class="bowl" d="M58 82h144c-5 42-31 65-72 65-39 0-66-23-72-65z"></path>
    <path class="bowl-rim" d="M52 82c14-18 142-18 156 0-17 17-139 17-156 0z"></path>
    <circle class="food soft-a" cx="101" cy="74" r="17"></circle>
    <circle class="food soft-b" cx="132" cy="68" r="20"></circle>
    <circle class="food soft-c" cx="165" cy="75" r="16"></circle>
    <path class="steam" d="M96 45c-8-10 9-15 1-26M134 42c-7-10 10-17 2-29M171 46c-7-10 8-15 1-25"></path>
  `),
  沙沙: svgShell("窗台灰塵與餅乾碎屑插圖", `
    <rect class="window" x="45" y="35" width="68" height="72"></rect>
    <path class="window-line" d="M79 35v72M45 70h68"></path>
    <rect class="sill" x="35" y="107" width="188" height="18"></rect>
    <path class="hand" d="M145 94c20 8 42 11 62 4 6-2 11 9 4 14-24 16-54 15-83 5-9-3-3-29 17-23z"></path>
    <path class="crumbs" d="M66 134h2M78 130h2M96 137h2M119 130h2M154 133h2M180 129h2M198 136h2"></path>
    <path class="dust" d="M128 53c23-9 43-8 62 2M133 66c17-5 34-4 51 1"></path>
  `),
  "𠕇硞硞": svgShell("曬乾木板與敲擊插圖", `
    <ellipse class="shadow" cx="132" cy="135" rx="82" ry="10"></ellipse>
    <rect class="wood" x="53" y="70" width="151" height="54" rx="3"></rect>
    <path class="wood-line" d="M64 83h128M63 99h132M72 115h104"></path>
    <path class="hammer" d="M145 43l45 24-11 20-45-25zM126 61l20 11-41 70-20-11z"></path>
    <path class="hit-lines" d="M67 52l17 16M82 41l10 22M48 68l23 8"></path>
  `),
  密喌喌: svgShell("市場人群與棚架插圖", `
    <path class="awning" d="M39 50h180l-12 30H51z"></path>
    <path class="awning-line" d="M72 50l-8 30M105 50l-4 30M139 50v30M173 50l5 30"></path>
    <rect class="stall" x="52" y="92" width="154" height="43"></rect>
    <circle class="person a" cx="77" cy="94" r="17"></circle>
    <circle class="person b" cx="110" cy="90" r="19"></circle>
    <circle class="person c" cx="146" cy="94" r="17"></circle>
    <circle class="person d" cx="180" cy="91" r="18"></circle>
    <path class="shoulders" d="M55 130c7-21 36-21 45 0M87 131c8-25 41-25 51 0M126 130c8-21 38-21 47 0M159 131c7-23 38-23 45 0"></path>
  `),
  薄縭絲: svgShell("薄塑膠袋與風插圖", `
    <path class="bag" d="M93 49c12 16 51 16 64 0 12 32 11 62-5 89-15 8-43 8-56 0-17-29-16-58-3-89z"></path>
    <path class="bag-line" d="M105 58c6 9 34 9 40 0M105 82c16 10 31 10 47 0M99 114c17 8 38 8 57 0"></path>
    <path class="wind" d="M43 73c21-10 39-8 55 3M37 103c30-12 54-9 72 6M157 67c23-13 42-12 57 2"></path>
  `),
  暗摸摸: svgShell("暗客廳與窗外路燈插圖", `
    <rect class="room" x="45" y="34" width="168" height="102"></rect>
    <rect class="dark-window" x="71" y="49" width="58" height="61"></rect>
    <path class="window-line" d="M100 49v61M71 79h58"></path>
    <circle class="lamp" cx="168" cy="69" r="18"></circle>
    <path class="lamp-glow" d="M150 89c14 11 29 11 43 0"></path>
    <path class="sofa" d="M70 119h106c9 0 15 6 15 15H56c0-9 6-15 14-15z"></path>
  `),
  紅記記: svgShell("切開的西瓜插圖", `
    <ellipse class="shadow" cx="132" cy="136" rx="76" ry="10"></ellipse>
    <path class="watermelon" d="M55 113c18-48 136-48 154 0-25 31-129 31-154 0z"></path>
    <path class="watermelon-rind" d="M55 113c25 31 129 31 154 0"></path>
    <path class="seed" d="M92 100c-3-8 5-8 2 0M122 90c-3-8 5-8 2 0M151 101c-3-8 5-8 2 0M176 91c-3-8 5-8 2 0"></path>
    <path class="plate" d="M62 129c36 17 105 17 141 0"></path>
  `),
  花彔彔: svgShell("雜貨店門口色塊與塑膠桶插圖", `
    <rect class="shop" x="45" y="35" width="170" height="101"></rect>
    <path class="shelf" d="M56 65h146M56 96h146"></path>
    <rect class="bucket red" x="64" y="72" width="22" height="20"></rect>
    <rect class="bucket green" x="95" y="70" width="24" height="22"></rect>
    <rect class="bucket blue" x="131" y="72" width="23" height="20"></rect>
    <rect class="bucket yellow" x="165" y="70" width="24" height="22"></rect>
    <path class="hanger" d="M79 106c12 17 26 17 38 0M139 106c12 17 26 17 38 0"></path>
    <path class="sign-line" d="M68 51h51M135 51h42"></path>
  `),
  青蘢蘢: svgShell("雨後植物插圖", `
    <ellipse class="shadow" cx="132" cy="139" rx="72" ry="10"></ellipse>
    <rect class="pot" x="101" y="112" width="64" height="30"></rect>
    <path class="stem" d="M133 113V55M132 91c-19-20-34-26-53-23M134 83c20-21 39-27 57-22M132 70c-12-17-23-25-38-25M137 67c13-18 28-25 44-22"></path>
    <path class="plant-leaf" d="M79 68c24-15 43-9 53 23-26 6-44-1-53-23zM191 61c-24-13-43-5-57 22 23 8 43 1 57-22zM94 45c18-7 31 0 38 25-18 3-31-5-38-25zM181 45c-19-6-33 1-44 22 18 5 33-2 44-22z"></path>
    <path class="rain" d="M69 39l-8 12M198 38l-8 12M211 73l-8 12"></path>
  `),
};

const genericIllustration = svgShell("生活物件插圖", `
  <rect class="table" x="49" y="102" width="162" height="24"></rect>
  <rect class="chair" x="78" y="67" width="54" height="58"></rect>
  <path class="plant-leaf" d="M154 66c23-17 43-10 52 19-24 7-42 1-52-19zM157 78c-17-16-33-16-49 1 17 11 34 11 49-1z"></path>
  <path class="stem" d="M156 103V56"></path>
`);

const createIllustration = (note, index) => {
  const illustration = document.createElement("div");
  illustration.className = "note-illustration";
  illustration.setAttribute("aria-label", "感官插圖");
  illustration.innerHTML = illustrationTemplates[note?.term] || genericIllustration;
  return illustration;
};

const renderEmptyState = (message) => {
  if (!notesGrid) return;
  notesGrid.textContent = "";
  notesGrid.append(createTextElement("p", "empty-note", message));
};

const renderFieldNotes = (fieldNotes) => {
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
      createTextElement("p", "note-index", `specimen ${String(index + 1).padStart(2, "0")}`),
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
      createIllustration(note, index),
      cardTop,
      termBlock,
      body,
      createSourceLink(sourceUrl)
    );

    notesGrid.append(card);
  });
};

const renderRandomNotes = () => {
  renderFieldNotes(drawRandomNotes());
};

const loadFieldNotes = async () => {
  renderEmptyState("正在讀取田調素材。");

  try {
    const response = await fetch(dataPath, { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load ${dataPath}`);

    const payload = await response.json();
    allFieldNotes = normalizeNotes(payload);
    drawPool = shuffle(allFieldNotes);
    renderRandomNotes();
  } catch (error) {
    renderEmptyState("尚未讀取到 data/field-notes.json。請用 localhost 預覽，或確認資料檔已放在 data 資料夾。");
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

shuffleButton?.addEventListener("click", renderRandomNotes);

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
