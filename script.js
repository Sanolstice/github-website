const nav = document.querySelector("[data-nav]");
const navToggle = document.querySelector("[data-nav-toggle]");
const navLinks = [...document.querySelectorAll(".site-nav a")];
const sections = [...document.querySelectorAll("main section[id]")];
const notesGrid = document.querySelector("[data-notes-grid]");
const pagination = document.querySelector("[data-pagination]");
const prevPageButton = document.querySelector("[data-page-prev]");
const nextPageButton = document.querySelector("[data-page-next]");
const pageStatus = document.querySelector("[data-page-status]");

const dataDirectory = "data/field-notes";
const dataRequestVersion = Date.now().toString();
const withDataCacheBuster = (path) => {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${dataRequestVersion}`;
};
const dataIndexPath = withDataCacheBuster(`${dataDirectory}/index.json`);
const notesPerPage = 6;
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

const normalizeNote = (note = {}) => ({
  term: normalizeText(getNoteValue(note, ["term", "word", "title", "name", "詞", "詞目"])),
  pronunciation: normalizeText(getNoteValue(note, ["pronunciation", "reading", "romanization", "pinyin", "音讀", "台羅"]), "音讀未提供"),
  definition: normalizePublicText(getNoteValue(note, ["definition", "meaning", "description", "explanation", "釋義"])?.本義 || getNoteValue(note, ["definition", "meaning", "description", "explanation", "釋義"]), "釋義未提供"),
  fieldNote: normalizeFieldNote(note),
  sensoryTags: normalizeTags(note?.sensoryTags || getNoteValue(note, ["tags", "sensoryCategory", "category", "分類"])),
  sourceMetadata: normalizeSourceMetadata(note),
  sourceUrl: normalizeSourceUrl(note),
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

const updatePaginationControls = () => {
  if (!pagination) return;

  const totalPages = getTotalPages();
  pagination.hidden = !allFieldNotes.length;

  if (pageStatus) {
    pageStatus.textContent = `第 ${currentPage + 1} / ${totalPages} 頁`;
  }

  if (prevPageButton) {
    prevPageButton.disabled = currentPage === 0;
  }

  if (nextPageButton) {
    nextPageButton.disabled = currentPage >= totalPages - 1;
  }
};

const renderCurrentPage = () => {
  const totalPages = getTotalPages();
  currentPage = Math.min(Math.max(currentPage, 0), totalPages - 1);
  renderFieldNotes(getPageNotes(currentPage), currentPage * notesPerPage);
  updatePaginationControls();
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
  日花: svgShell("窗邊碎光與竹椅插圖", `
    <rect class="window" x="43" y="35" width="70" height="76"></rect>
    <path class="window-line" d="M78 35v76M43 73h70"></path>
    <path class="lamp-glow" d="M55 120c18-18 43-28 75-32M84 133c21-17 50-27 88-31"></path>
    <rect class="chair" x="139" y="79" width="56" height="48"></rect>
    <path class="wood-line" d="M148 90h39M147 104h42M151 118h33"></path>
    <path class="crumbs" d="M122 112h2M133 103h2M157 94h2M176 111h2M194 99h2M108 130h2M151 133h2"></path>
  `),
  凊彩: svgShell("鍋子醬油蒜頭與鹽插圖", `
    <ellipse class="shadow" cx="132" cy="137" rx="78" ry="10"></ellipse>
    <path class="bowl" d="M60 84h96c-6 34-24 52-49 52-27 0-43-18-47-52z"></path>
    <path class="bowl-rim" d="M55 83c10-13 95-13 107 0-15 13-91 13-107 0z"></path>
    <path class="steam" d="M83 61c-6-8 7-12 2-22M111 58c-6-8 8-13 2-23M137 62c-6-8 7-12 2-21"></path>
    <rect class="bucket red" x="176" y="46" width="20" height="58" rx="4"></rect>
    <path class="dust" d="M186 104c-12 10-28 15-48 16"></path>
    <path class="root root-a" d="M174 122c8-10 23-8 29 2-7 12-25 12-29-2z"></path>
    <path class="crumbs" d="M61 127h2M70 133h2M203 118h2M213 125h2M219 132h2"></path>
  `),
  軟晡: svgShell("傍晚門口木椅與斜光插圖", `
    <ellipse class="shadow" cx="132" cy="139" rx="82" ry="10"></ellipse>
    <rect class="room" x="44" y="41" width="70" height="86"></rect>
    <path class="lamp-glow" d="M111 57c35 18 66 37 94 66M102 79c31 14 58 31 81 52"></path>
    <rect class="chair" x="74" y="86" width="57" height="43"></rect>
    <path class="wood-line" d="M84 96h38M83 110h40M91 128v18M119 128v18"></path>
    <circle class="person c" cx="185" cy="105" r="17"></circle>
    <path class="shoulders" d="M166 130c8-21 38-21 47 0"></path>
  `),
  "日頭赤焱焱，隨人顧性命": svgShell("正午公車站與電扇插圖", `
    <circle class="lamp" cx="70" cy="55" r="22"></circle>
    <path class="hit-lines" d="M70 20v16M70 74v16M35 55h16M89 55h16M47 32l11 12M93 32L82 44"></path>
    <rect class="stall" x="42" y="91" width="64" height="39"></rect>
    <path class="sign-line" d="M58 80h33M74 91v39"></path>
    <circle class="lamp" cx="175" cy="92" r="28"></circle>
    <path class="wind" d="M175 64v56M147 92h56M156 73l39 39M195 73l-39 39"></path>
    <path class="plate" d="M142 132h66"></path>
    <path class="lamp-glow" d="M43 140c51-9 107-9 169 0"></path>
  `),
  "日頭赤焱焱": svgShell("正午公車站與電扇插圖", `
    <circle class="lamp" cx="70" cy="55" r="22"></circle>
    <path class="hit-lines" d="M70 20v16M70 74v16M35 55h16M89 55h16M47 32l11 12M93 32L82 44"></path>
    <rect class="stall" x="42" y="91" width="64" height="39"></rect>
    <path class="sign-line" d="M58 80h33M74 91v39"></path>
    <circle class="lamp" cx="175" cy="92" r="28"></circle>
    <path class="wind" d="M175 64v56M147 92h56M156 73l39 39M195 73l-39 39"></path>
    <path class="plate" d="M142 132h66"></path>
    <path class="lamp-glow" d="M43 140c51-9 107-9 169 0"></path>
  `),
  四序: svgShell("傍晚整理棉被與木櫃插圖", `
    <ellipse class="shadow" cx="132" cy="140" rx="82" ry="10"></ellipse>
    <rect class="room" x="42" y="38" width="176" height="100"></rect>
    <path class="lamp-glow" d="M148 52c23 14 42 30 58 52M137 73c24 13 43 28 59 47"></path>
    <rect class="stall" x="54" y="65" width="63" height="72"></rect>
    <path class="shelf" d="M63 84h45M63 103h45M63 122h45"></path>
    <path class="bowl-rim" d="M138 88h56v35h-56zM146 97h40M146 111h40"></path>
    <path class="hand" d="M122 54c20 6 35 6 49 0 8-3 14 8 7 14-20 16-45 15-62 4-7-5-2-21 6-18z"></path>
    <path class="dust" d="M183 62c9-8 18-9 28-4M184 73c8-4 17-4 25 1"></path>
    <path class="wood-line" d="M64 85c11 8 30 8 43 0M64 104c12 7 29 7 43 0M64 123c12 7 29 7 43 0"></path>
  `),
  白鑠鑠: svgShell("晨光裡的新白襯衫與書包插圖", `
    <ellipse class="shadow" cx="132" cy="140" rx="82" ry="10"></ellipse>
    <rect class="window" x="158" y="38" width="54" height="72"></rect>
    <path class="window-line" d="M185 38v72M158 74h54"></path>
    <path class="lamp-glow" d="M155 60c-31 13-58 30-80 52M165 85c-27 11-50 24-69 41"></path>
    <rect class="chair" x="48" y="86" width="58" height="42"></rect>
    <path class="bag" d="M60 57c13 10 34 10 47 0 8 28 6 49-8 65-10 5-28 5-39 0-12-18-14-39 0-65z"></path>
    <path class="bag-line" d="M70 69c7 6 20 6 27 0M68 89c9 6 23 6 32 0"></path>
    <path class="sofa" d="M128 104h44c9 0 14 7 14 17h-72c0-10 5-17 14-17z"></path>
    <rect class="hammer" x="134" y="80" width="47" height="21" rx="4"></rect>
    <path class="wind" d="M181 91c14 7 22 16 25 28"></path>
    <path class="bowl-rim" d="M174 51c16 11 24 31 18 58-8 5-22 5-30 0 9-23 10-43 12-58z"></path>
  `),
  相借問: svgShell("清晨市場相借問插圖", `
    <ellipse class="shadow" cx="132" cy="141" rx="84" ry="10"></ellipse>
    <path class="awning" d="M43 45h78l-8 24H52z"></path>
    <rect class="stall" x="49" y="80" width="72" height="36"></rect>
    <path class="sign-line" d="M69 70h32M85 80v36"></path>
    <path class="bag" d="M148 54c10 11 36 11 47 0 12 25 8 47-7 62-10 5-27 5-37 0-13-15-17-37-3-62z"></path>
    <path class="bag-line" d="M158 67c7 7 20 7 27 0M155 86c10 8 25 8 35 0"></path>
    <path class="leaf" d="M155 100c17-11 30-8 39 7-16 6-29 4-39-7zM146 90c16-8 27-4 35 9-15 4-27 1-35-9z"></path>
    <path class="hand" d="M55 123c13-9 30-9 42 2 8 7 1 18-9 12-12-7-25-7-38 0-8 5-15-7-5-14z"></path>
    <path class="hand" d="M109 126c16 8 31 8 47-2 8-5 16 7 7 14-18 14-41 15-62 3-9-5-3-20 8-15z"></path>
    <path class="crumbs" d="M177 127h2M188 132h2M201 124h2M210 136h2M60 134h2M72 128h2"></path>
  `),
  月眉: svgShell("山稜線上的月眉插圖", `
    <ellipse class="shadow" cx="132" cy="142" rx="82" ry="10"></ellipse>
    <path class="room" d="M40 105c20-28 36-42 59-32 18 8 28 30 50 23 17-5 28-27 49-24 14 2 22 17 27 33v34H40z"></path>
    <path class="plant-leaf" d="M42 111c22-25 39-35 61-25 17 8 29 27 47 20 17-6 29-25 49-22 13 2 22 14 26 27v28H42z"></path>
    <path class="bowl-rim" d="M71 42c16-16 38-18 55-5-17-1-32 9-39 25-8 18-4 35 10 49-27-11-38-46-26-69z"></path>
    <path class="plate" d="M61 132h91M71 119h79M84 106h69M96 94h59"></path>
    <path class="stem" d="M57 129c-8-15-8-29 0-42M197 128c7-18 5-34-6-49"></path>
    <path class="leaf" d="M48 104c16-8 27-5 34 9-15 4-27 1-34-9zM189 96c16-8 29-5 38 10-16 5-29 2-38-10z"></path>
    <path class="hand" d="M159 128c18-11 29-28 35-55 2-9 17-7 16 3-3 31-18 56-43 69-9 5-17-10-8-17z"></path>
    <path class="hit-lines" d="M196 60l16-18M201 66l22-7"></path>
  `),
  數念: svgShell("剛掛電話後的安靜客廳插圖", `
    <ellipse class="shadow" cx="132" cy="141" rx="82" ry="10"></ellipse>
    <rect class="room" x="41" y="42" width="177" height="94"></rect>
    <rect class="dark-window" x="157" y="50" width="50" height="57"></rect>
    <path class="window-line" d="M182 50v57M157 78h50"></path>
    <path class="lamp-glow" d="M151 111c18-12 36-19 55-22"></path>
    <rect class="stall" x="57" y="81" width="48" height="29"></rect>
    <path class="sign-line" d="M66 75h30M81 81v29"></path>
    <circle class="lamp" cx="81" cy="62" r="13"></circle>
    <path class="wind" d="M92 68c17 8 24 20 20 36"></path>
    <rect class="dark-window" x="125" y="60" width="35" height="28"></rect>
    <path class="sofa" d="M78 122h85c10 0 17 7 17 17H62c0-10 6-17 16-17z"></path>
    <circle class="person b" cx="121" cy="102" r="15"></circle>
    <path class="shoulders" d="M97 129c10-23 40-23 50 0"></path>
  `),
  好玄: svgShell("停電夜晚燭光與手影插圖", `
    <ellipse class="shadow" cx="132" cy="141" rx="82" ry="10"></ellipse>
    <rect class="room" x="42" y="39" width="176" height="98"></rect>
    <rect class="dark-window" x="165" y="52" width="43" height="62"></rect>
    <path class="window-line" d="M186 52v62M165 83h43"></path>
    <path class="rain" d="M174 61l-8 15M196 63l-8 15M205 88l-8 15"></path>
    <path class="lamp-glow" d="M74 68c27 15 58 28 94 39M71 86c28 10 61 20 99 29"></path>
    <rect class="table" x="54" y="111" width="76" height="18"></rect>
    <path class="bowl-rim" d="M72 105h30"></path>
    <path class="lamp" d="M83 99c-5-18 13-18 8 0z"></path>
    <path class="steam" d="M86 78c-8-11 10-12 1-25"></path>
    <path class="hand" d="M132 60c15 4 28 16 39 35 5 9-7 17-14 9-9-11-19-18-32-22-9-3-4-25 7-22z"></path>
    <circle class="person c" cx="86" cy="101" r="14"></circle>
    <path class="shoulders" d="M63 126c9-22 37-22 47 0"></path>
    <path class="wood-line" d="M51 93h29M53 103h24"></path>
  `),
  拍損: svgShell("廚房門框邊探頭的阿嬤插圖", `
    <ellipse class="shadow" cx="132" cy="141" rx="82" ry="10"></ellipse>
    <rect class="room" x="40" y="42" width="180" height="96"></rect>
    <rect class="stall" x="52" y="60" width="46" height="72"></rect>
    <path class="window-line" d="M98 46v88M52 92h44"></path>
    <path class="sofa" d="M99 71c18-18 47-14 58 7 9 17 3 39-14 51-16 11-41 8-52-8-12-17-9-34 8-50z"></path>
    <circle class="person b" cx="124" cy="83" r="18"></circle>
    <path class="shoulders" d="M96 129c11-28 48-28 61 0"></path>
    <path class="root-line" d="M116 85c6 5 15 5 22 0M117 96c8 6 19 6 27 0"></path>
    <path class="dust" d="M113 77c7-6 21-6 29 0"></path>
    <rect class="table" x="164" y="93" width="39" height="20"></rect>
    <path class="steam" d="M175 82c-6-8 8-10 2-20M194 84c-6-8 7-11 2-21"></path>
    <path class="lamp-glow" d="M58 136c39-8 82-9 130-2"></path>
  `),
  毋甘: svgShell("梳妝台上的香水瓶與指尖插圖", `
    <ellipse class="shadow" cx="132" cy="141" rx="82" ry="10"></ellipse>
    <rect class="table" x="49" y="115" width="162" height="19"></rect>
    <rect class="bowl-rim" x="102" y="58" width="48" height="58" rx="7"></rect>
    <path class="lamp" d="M113 43h26l5 17h-36z"></path>
    <path class="window-line" d="M113 76h26M113 93h26"></path>
    <path class="lamp-glow" d="M97 62c-20 8-36 20-49 36M154 62c22 8 40 20 55 36"></path>
    <path class="hand" d="M167 88c-14 4-26 12-36 24-7 8 4 19 13 13 11-8 22-13 35-16 10-2 2-25-12-21z"></path>
    <path class="stem" d="M83 123c-8-16-8-31 0-46"></path>
    <path class="leaf" d="M73 91c15-9 28-6 37 8-15 5-28 2-37-8z"></path>
    <path class="crumbs" d="M64 124h2M74 129h2M188 122h2M199 128h2"></path>
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
  紅絳絳: svgShell("臉頰泛紅的側臉插圖", `
    <ellipse class="shadow" cx="132" cy="141" rx="72" ry="10"></ellipse>
    <path class="hair" d="M87 70c10-27 48-35 72-16 23 18 25 53 8 75-13 17-41 19-59 8-21-13-31-42-21-67z"></path>
    <path class="face" d="M117 58c31 4 50 29 44 61-5 28-29 40-53 28-22-12-33-40-23-63 5-13 17-23 32-26z"></path>
    <path class="neck" d="M126 133c3 12 2 20-4 28M151 128c8 10 12 20 12 31"></path>
    <path class="shoulders" d="M83 164c17-27 67-30 92-4"></path>
    <circle class="cheek" cx="145" cy="105" r="17"></circle>
    <path class="root-line" d="M135 82c7-4 16-3 24 2M153 123c-6 5-13 6-21 2"></path>
    <path class="ear" d="M164 93c13 2 15 24 2 31"></path>
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
  菁仔欉: svgShell("路旁檳榔樹與背影插圖", `
    <ellipse class="shadow" cx="132" cy="143" rx="93" ry="8"></ellipse>
    <path class="wood-line" d="M62 137L67 54M93 137L97 43M125 137L128 50"></path>
    <path class="plant-leaf" d="M67 55c-24-12-32-24-31-34 16 1 29 10 37 28M67 55c5-24 14-37 27-41 2 14-5 28-22 42M96 45c-21-14-29-27-25-38 15 3 26 14 31 33M96 45c10-22 21-34 35-34-1 15-11 27-29 38M128 51c-16-17-21-31-15-41 15 6 23 18 22 36M128 51c14-18 27-26 41-23-4 14-16 23-36 29"></path>
    <circle class="person b" cx="182" cy="94" r="15"></circle>
    <path class="shoulders" d="M160 137c5-25 38-25 46 0"></path>
    <path class="bag-line" d="M179 110v27M57 137h157"></path>
  `),
  拍殕仔光: svgShell("破曉山路與路燈插圖", `
    <rect class="dark-window" x="38" y="34" width="184" height="97"></rect>
    <path class="room" d="M38 89c30-16 48-17 76 0 25-27 56-30 108-4v46H38z"></path>
    <path class="window-line" d="M39 69h182"></path>
    <path class="wood-line" d="M138 132c-5-21-13-35-25-44M138 132c4-24 16-39 31-52"></path>
    <path class="lamp-glow" d="M66 51v70M57 52h19M61 52c1-11 11-11 12 0"></path>
    <circle class="lamp" cx="67" cy="58" r="10"></circle>
    <circle class="person c" cx="143" cy="102" r="10"></circle>
    <path class="shoulders" d="M127 126c5-17 28-17 34 0"></path>
  `),
  眠夢: svgShell("窗邊神遊的側影插圖", `
    <rect class="window" x="111" y="38" width="99" height="76"></rect>
    <path class="window-line" d="M160 38v76M111 76h99"></path>
    <path class="lamp-glow" d="M111 45L66 116M129 38L82 126"></path>
    <ellipse class="shadow" cx="107" cy="141" rx="64" ry="8"></ellipse>
    <circle class="person a" cx="87" cy="83" r="21"></circle>
    <path class="shoulders" d="M50 132c8-34 55-35 70 0"></path>
    <path class="root-line" d="M90 84c9 1 16 4 21 9M103 91l11-1"></path>
    <path class="plant-leaf" d="M175 104c13-15 27-16 39-4-13 13-26 14-39 4z"></path>
    <path class="stem" d="M177 118v-24"></path>
  `),
  雲尪: svgShell("仰望巨大雲團的祖孫插圖", `
    <rect class="window" x="33" y="34" width="194" height="91"></rect>
    <path class="bowl-rim" d="M46 77c-1-17 15-27 30-22 6-23 39-29 54-9 17-23 54-16 58 12 22-4 33 12 28 27H46z"></path>
    <path class="dust" d="M55 76c18-6 33-5 48 3M85 61c18-12 39-10 52 3M130 60c16-12 34-10 48 6M163 80c17-8 30-7 43 1"></path>
    <path class="room" d="M34 125c37-22 68-22 94-7 29-20 60-19 98 7"></path>
    <circle class="person b" cx="103" cy="118" r="9"></circle>
    <path class="shoulders" d="M90 142c4-16 22-16 27 0"></path>
    <circle class="person c" cx="128" cy="124" r="7"></circle>
    <path class="shoulders" d="M117 143c3-13 18-13 22 0"></path>
  `),
  燒燙燙: svgShell("端著熱碗的兩雙手插圖", `
    <ellipse class="shadow" cx="132" cy="141" rx="78" ry="9"></ellipse>
    <path class="bowl" d="M90 83h76c-5 29-18 44-38 44-21 0-34-15-38-44z"></path>
    <path class="bowl-rim" d="M86 83c9-12 77-12 84 0-10 12-74 12-84 0z"></path>
    <path class="steam" d="M106 61c-8-12 8-15 2-29M128 59c-8-12 9-16 2-31M151 61c-8-12 8-16 2-29"></path>
    <path class="hand" d="M92 95c-16-5-33 0-43 12-6 7 0 16 8 13l42-13M164 96c17-5 33 1 44 13 6 7 0 16-9 13l-42-14"></path>
    <path class="person a" d="M42 91c12-11 27-16 42-14M215 88c-12-11-26-15-40-13"></path>
    <path class="lamp-glow" d="M57 125c11 7 23 9 35 7M171 132c13 1 24-2 34-8"></path>
  `),
  無聲無說: svgShell("暗夜階梯上的安靜背影插圖", `
    <rect class="dark-window" x="37" y="31" width="188" height="107"></rect>
    <circle class="lamp" cx="188" cy="53" r="12"></circle>
    <path class="room" d="M48 112h164v26H48z"></path>
    <path class="window-line" d="M48 112h164M55 123h150M62 134h137"></path>
    <circle class="person c" cx="119" cy="88" r="15"></circle>
    <path class="sofa" d="M94 123c6-24 43-26 54 0"></path>
    <path class="wood-line" d="M107 103l-15 17M132 104l17 17M143 101l21 2"></path>
    <circle class="bucket red" cx="165" cy="103" r="3"></circle>
    <path class="steam" d="M165 98c-7-9 7-11 1-19"></path>
  `),
  燈仔花: svgShell("山路邊的燈仔花插圖", `
    <path class="room" d="M36 119c42-27 79-28 110-12 24-13 49-14 79-4v32H36z"></path>
    <path class="wood-line" d="M42 133c47-8 103-7 175 0"></path>
    <path class="stem" d="M66 123V73M100 125V59M139 126V77M178 124V64"></path>
    <path class="plant-leaf" d="M66 91c-16-14-29-14-38-1 14 11 26 12 38 1zM70 102c17-14 30-14 38 1-14 10-26 10-38-1zM100 76c-16-14-30-14-40 0 13 11 26 11 40 0zM103 94c18-14 31-13 40 2-14 9-27 9-40-2zM139 94c-14-15-27-16-38-4 12 12 25 13 38 4zM179 82c-15-15-29-15-39-2 13 11 26 12 39 2z"></path>
    <circle class="bucket red" cx="64" cy="76" r="13"></circle>
    <circle class="bucket red" cx="99" cy="59" r="14"></circle>
    <circle class="bucket red" cx="138" cy="79" r="12"></circle>
    <circle class="bucket red" cx="179" cy="64" r="14"></circle>
    <path class="leaf" d="M75 135c12-12 25-12 37 0-13 7-25 7-37 0zM148 138c11-12 24-12 35 0-12 7-24 7-35 0z"></path>
  `),
  四秀仔: svgShell("四格旋轉點心盒插圖", `
    <ellipse class="shadow" cx="130" cy="140" rx="91" ry="8"></ellipse>
    <circle class="table" cx="117" cy="87" r="55"></circle>
    <circle class="bowl-rim" cx="117" cy="87" r="50"></circle>
    <path class="window-line" d="M117 38v98M68 87h98"></path>
    <circle class="soft-a" cx="117" cy="87" r="8"></circle>
    <path class="food soft-b" d="M79 61l15-9 11 14-16 10zM131 55l17 3-3 18-17-3zM76 103l20-4 3 16-20 4zM132 105l16-9 9 15-16 9z"></path>
    <path class="plate" d="M178 96c15-9 30-7 42 4-10 17-29 22-46 12z"></path>
    <circle class="bucket yellow" cx="191" cy="103" r="6"></circle>
    <circle class="bucket yellow" cx="205" cy="104" r="6"></circle>
    <path class="hand" d="M191 123c-16 2-29 8-40 18-7 6-16-4-9-11 13-14 28-23 45-26 9-2 14 17 4 19z"></path>
  `),
  失禮: svgShell("小燈旁剝菜的阿嬤插圖", `
    <rect class="dark-window" x="39" y="37" width="183" height="99"></rect>
    <circle class="lamp" cx="162" cy="64" r="18"></circle>
    <path class="lamp-glow" d="M143 86c17 12 35 12 53 0M162 83v35"></path>
    <rect class="table" x="118" y="112" width="83" height="20"></rect>
    <circle class="person b" cx="91" cy="88" r="17"></circle>
    <path class="sofa" d="M66 128c5-29 43-30 55 0"></path>
    <path class="hand" d="M103 101c16 2 27 8 36 17M103 109c13 3 21 9 27 17"></path>
    <path class="plant-leaf" d="M134 113c10-10 21-10 29 2-11 6-21 5-29-2zM143 122c10-8 20-7 28 4-11 4-20 3-28-4z"></path>
    <path class="shoulders" d="M47 142v-29M53 113h16"></path>
  `),
  幽幽仔疼: svgShell("雜草空地與記憶藤椅插圖", `
    <ellipse class="shadow" cx="132" cy="143" rx="86" ry="8"></ellipse>
    <path class="room" d="M34 114c29-16 55-17 83-5 28-12 62-14 109 4v25H34z"></path>
    <path class="stem" d="M45 136V102M59 138V95M75 137v-28M91 140v-36M111 139v-30M203 138v-31M218 137v-22"></path>
    <path class="plant-leaf" d="M45 115c-9-9-18-9-25-1 8 7 17 8 25 1zM60 108c10-9 20-8 28 2-10 6-20 6-28-2zM91 118c-11-10-21-10-30 0 10 8 20 8 30 0zM204 117c13-9 24-8 32 4-12 6-23 5-32-4z"></path>
    <path class="crumbs" d="M42 130h2M54 124h2M69 134h2M87 127h2M103 132h2M198 128h2M214 132h2M226 125h2"></path>
    <circle class="person c" cx="47" cy="80" r="17"></circle>
    <path class="sofa" d="M20 131c5-34 46-36 58 0"></path>
    <rect class="chair" x="129" y="76" width="53" height="42"></rect>
    <path class="bowl-rim" d="M135 84h39M136 98h37M142 118v24M172 118v24"></path>
    <path class="wind" d="M126 73c17-13 45-13 62 1M126 122c18 8 42 8 60 0"></path>
  `),
  西北雨: svgShell("鐵皮屋簷下搶收衣服插圖", `
    <rect class="dark-window" x="37" y="36" width="186" height="74"></rect>
    <path class="awning" d="M34 47h191l-16 29H48z"></path>
    <path class="awning-line" d="M64 48l-9 27M96 48l-6 28M130 48l-3 28M164 48l4 28M198 48l7 27"></path>
    <path class="rain" d="M55 91l-13 24M80 85l-14 28M108 92l-14 26M138 84l-15 30M169 91l-14 27M197 84l-15 30M218 92l-13 24"></path>
    <path class="lamp-glow" d="M57 79c43 7 91 7 145 0"></path>
    <path class="bowl-rim" d="M75 75c16 12 29 12 40 0 2 26-3 43-17 51-12-7-20-25-23-51z"></path>
    <path class="bag" d="M128 76c14 10 27 10 40 0 0 22-8 39-23 50-13-10-18-27-17-50z"></path>
    <path class="plate" d="M181 76c12 9 24 9 36 0"></path>
    <path class="hand" d="M113 127c16-10 32-17 50-20 10-2 17 14 6 20-17 9-34 16-53 21-10 2-12-15-3-21z"></path>
    <path class="wind" d="M61 64c23-7 46-7 69 0M145 65c22-8 41-8 59 0"></path>
  `),
  鬥跤手: svgShell("埕裡蒜頭與紅豆湯插圖", `
    <ellipse class="shadow" cx="132" cy="143" rx="92" ry="8"></ellipse>
    <path class="plate" d="M39 130c38-19 87-20 147-6"></path>
    <path class="root" d="M52 114c8-10 22-8 27 2-7 11-22 11-27-2zM82 130c7-10 21-9 28 1-7 11-23 11-28-1zM112 113c9-11 23-8 28 3-8 11-23 10-28-3zM143 131c8-10 22-8 27 2-7 10-22 10-27-2z"></path>
    <path class="root-line" d="M61 113c6 5 9 10 11 17M93 128c5 5 8 10 9 17M122 112c6 5 9 11 11 18M152 130c5 5 8 10 10 17"></path>
    <path class="crumbs" d="M48 132h2M68 126h2M91 116h2M108 135h2M129 126h2M153 116h2M174 132h2"></path>
    <path class="hand" d="M45 87c18 4 31 13 39 28 5 9-6 18-14 11-10-8-22-14-36-17-10-2-2-25 11-22z"></path>
    <path class="hand" d="M120 84c-17 7-30 19-37 36-4 10 9 17 16 8 8-11 19-19 33-25 10-4 0-24-12-19z"></path>
    <path class="bowl" d="M174 70h48c-4 28-13 42-25 42-14 0-21-14-23-42z"></path>
    <path class="bowl-rim" d="M169 70c8-10 51-10 58 0-8 10-50 10-58 0z"></path>
    <circle class="soft-a" cx="195" cy="68" r="13"></circle>
    <path class="seed" d="M181 82h2M191 91h2M205 84h2M214 94h2"></path>
    <path class="steam" d="M188 56c-7-9 8-11 2-22M208 57c-7-9 8-11 2-22"></path>
  `),
  踅夜市: svgShell("夜市攤前木瓜牛奶與鹽酥雞插圖", `
    <rect class="dark-window" x="38" y="38" width="184" height="87"></rect>
    <path class="awning" d="M43 42h176l-12 29H55z"></path>
    <path class="lamp-glow" d="M63 75c38 10 84 10 139 0"></path>
    <circle class="lamp" cx="75" cy="58" r="9"></circle>
    <circle class="lamp" cx="130" cy="57" r="9"></circle>
    <circle class="lamp" cx="186" cy="58" r="9"></circle>
    <path class="hand" d="M68 105c-15 3-27 10-36 22-6 8 5 18 13 11 10-8 21-13 34-16 10-2 1-25-11-22zM166 110c16 1 30 7 41 18 7 7-2 19-11 13-12-7-25-11-39-12-10-1-7-21 9-19z"></path>
    <rect class="bowl-rim" x="74" y="78" width="38" height="54" rx="5"></rect>
    <path class="stem" d="M91 79L83 48"></path>
    <path class="bag" d="M147 77c12 12 39 12 51 0 8 28 4 50-12 67-12 6-29 5-39-2-10-18-11-39 0-65z"></path>
    <path class="crumbs" d="M156 101h2M166 111h2M180 101h2M188 118h2"></path>
    <circle class="person a" cx="114" cy="102" r="10"></circle>
    <circle class="person b" cx="129" cy="98" r="11"></circle>
    <circle class="person c" cx="211" cy="99" r="9"></circle>
  `),
  燒烘烘: svgShell("半夜床邊摸額頭插圖", `
    <ellipse class="shadow" cx="132" cy="143" rx="84" ry="8"></ellipse>
    <rect class="room" x="49" y="76" width="162" height="62"></rect>
    <path class="sofa" d="M54 118c30-28 91-31 150-2v23H54z"></path>
    <circle class="person b" cx="117" cy="72" r="16"></circle>
    <path class="shoulders" d="M84 117c9-31 50-33 66 0"></path>
    <circle class="person a" cx="82" cy="105" r="12"></circle>
    <circle class="person c" cx="162" cy="104" r="12"></circle>
    <path class="hand" d="M132 82c17 7 27 16 32 29 3 9-9 15-15 8-6-8-14-14-25-19-9-4-5-22 8-18z"></path>
    <path class="lamp-glow" d="M144 106c11 9 24 11 38 5"></path>
    <rect class="bucket red" x="190" y="89" width="14" height="26" rx="3"></rect>
    <path class="plate" d="M184 118h27M194 85h10"></path>
  `),
  厝邊: svgShell("樓梯間端菜的厝邊插圖", `
    <rect class="room" x="44" y="35" width="171" height="102"></rect>
    <path class="window-line" d="M58 126h154M72 111h141M89 96h123M105 81h107"></path>
    <path class="wood-line" d="M52 132L210 58M64 58h151"></path>
    <ellipse class="shadow" cx="132" cy="142" rx="76" ry="8"></ellipse>
    <path class="hand" d="M73 94c24 3 43 12 56 27 7 8-3 20-12 14-16-10-33-16-52-18-11-1-7-24 8-23zM188 94c-25 3-43 12-57 27-7 8 3 20 13 14 16-10 33-16 52-18 11-1 6-24-8-23z"></path>
    <path class="bowl" d="M94 92h70c-5 28-17 43-35 43-19 0-30-15-35-43z"></path>
    <path class="bowl-rim" d="M89 92c9-12 72-12 80 0-10 12-70 12-80 0z"></path>
    <path class="plate" d="M96 86c14-9 45-10 65 0"></path>
    <path class="plant-leaf" d="M116 102c11-8 22-7 31 3-12 5-22 4-31-3z"></path>
  `),
  死殗殗: svgShell("客廳沙發與未動的飯碗插圖", `
    <rect class="room" x="42" y="38" width="175" height="98"></rect>
    <rect class="dark-window" x="58" y="54" width="52" height="42"></rect>
    <path class="window-line" d="M84 54v42M58 75h52"></path>
    <rect class="sofa" x="90" y="101" width="76" height="37" rx="5"></rect>
    <circle class="person c" cx="126" cy="77" r="17"></circle>
    <path class="shoulders" d="M97 118c7-30 48-31 60 0"></path>
    <path class="root-line" d="M113 91c11 7 24 7 36 0"></path>
    <rect class="table" x="165" y="120" width="50" height="16"></rect>
    <path class="bowl-rim" d="M177 111c7-8 28-8 35 0-7 8-28 8-35 0z"></path>
    <path class="bowl" d="M180 111h29c-3 13-8 20-15 20-8 0-12-7-14-20z"></path>
    <path class="lamp-glow" d="M57 120c29-9 54-9 75 0"></path>
  `),
  食人夠夠: svgShell("飯桌前看新聞的阿公插圖", `
    <rect class="room" x="39" y="36" width="184" height="101"></rect>
    <rect class="dark-window" x="145" y="53" width="58" height="43"></rect>
    <path class="window-line" d="M174 53v43M145 75h58"></path>
    <rect class="table" x="49" y="116" width="104" height="20"></rect>
    <circle class="person b" cx="91" cy="83" r="17"></circle>
    <path class="shoulders" d="M62 125c7-31 49-32 61 0"></path>
    <path class="root-line" d="M82 84c10 6 22 6 33 0M102 93l13 7"></path>
    <path class="hand" d="M116 99c13 2 23 8 31 17 6 7-2 17-10 12-9-6-18-10-29-11-9-1-5-20 8-18z"></path>
    <path class="bowl-rim" d="M64 107c8-9 31-9 39 0-8 9-31 9-39 0z"></path>
    <path class="stem" d="M130 103l22-23"></path>
    <circle class="person c" cx="45" cy="131" r="10"></circle>
    <rect class="bucket blue" x="167" y="103" width="31" height="10" rx="3"></rect>
  `),
  膨疱: svgShell("紅白機手把與拇指水泡插圖", `
    <ellipse class="shadow" cx="132" cy="143" rx="82" ry="8"></ellipse>
    <rect class="room" x="62" y="67" width="136" height="60" rx="5"></rect>
    <path class="window-line" d="M90 82h31M90 101h31M106 72v48"></path>
    <circle class="bucket red" cx="156" cy="94" r="10"></circle>
    <circle class="bucket red" cx="179" cy="94" r="10"></circle>
    <path class="hand" d="M73 105c-20 3-33 13-40 29-4 9 10 16 16 7 7-10 16-16 29-19 10-2 7-19-5-17zM191 106c20 3 33 13 40 29 4 9-10 16-16 7-7-10-16-16-29-19-10-2-7-19 5-17z"></path>
    <circle class="cheek" cx="181" cy="87" r="8"></circle>
    <path class="wind" d="M62 70c-17-13-28-25-31-36M198 70c17-13 28-25 31-36"></path>
    <path class="root-line" d="M151 94h10M174 94h10"></path>
  `),
  甜粅粅: svgShell("雜貨店玻璃罐糖果插圖", `
    <ellipse class="shadow" cx="132" cy="143" rx="88" ry="8"></ellipse>
    <rect class="table" x="42" y="120" width="176" height="18"></rect>
    <rect class="bowl-rim" x="53" y="57" width="36" height="65" rx="5"></rect>
    <rect class="bowl-rim" x="98" y="51" width="39" height="71" rx="5"></rect>
    <rect class="bowl-rim" x="146" y="57" width="39" height="65" rx="5"></rect>
    <path class="plate" d="M55 57h32M100 51h35M148 57h35"></path>
    <circle class="bucket red" cx="70" cy="89" r="6"></circle>
    <circle class="bucket yellow" cx="116" cy="81" r="6"></circle>
    <circle class="bucket blue" cx="126" cy="98" r="5"></circle>
    <circle class="bucket green" cx="163" cy="83" r="5"></circle>
    <circle class="bucket yellow" cx="174" cy="100" r="5"></circle>
    <path class="stem" d="M69 89l-13 21M116 81l-11 22M163 83l-9 20"></path>
    <path class="hand" d="M198 92c-18 5-31 16-39 31-5 9 7 17 15 10 9-8 19-14 31-18 10-3 4-27-7-23z"></path>
    <path class="crumbs" d="M64 104h2M76 98h2M106 107h2M131 89h2M156 103h2M178 90h2"></path>
  `),
  芳貢貢: svgShell("巷子裡作客的飯菜香插圖", `
    <rect class="room" x="37" y="48" width="184" height="83"></rect>
    <path class="window-line" d="M54 75h33M106 72h34M160 70h38M54 103h33M106 101h34M160 99h38"></path>
    <path class="lamp-glow" d="M158 82c16 11 33 11 50 0M162 112c15 8 30 8 45 0"></path>
    <path class="steam" d="M73 59c-7-9 8-11 2-23M124 57c-7-9 8-11 2-23M184 55c-7-9 8-11 2-23"></path>
    <ellipse class="shadow" cx="132" cy="143" rx="82" ry="8"></ellipse>
    <circle class="person b" cx="104" cy="103" r="13"></circle>
    <path class="shoulders" d="M83 137c5-24 36-24 44 0"></path>
    <circle class="person c" cx="132" cy="114" r="10"></circle>
    <path class="shoulders" d="M116 139c4-18 27-18 33 0"></path>
    <rect class="bucket yellow" x="75" y="111" width="20" height="15" rx="2"></rect>
    <path class="wind" d="M55 135c43-10 95-10 156 0"></path>
  `),
  油肭肭: svgShell("辦桌雞湯油亮亮插圖", `
    <ellipse class="shadow" cx="132" cy="143" rx="91" ry="8"></ellipse>
    <circle class="table" cx="127" cy="91" r="62"></circle>
    <circle class="bowl-rim" cx="127" cy="91" r="49"></circle>
    <path class="bowl" d="M86 88c15-28 69-28 84 0-8 34-75 34-84 0z"></path>
    <path class="lamp-glow" d="M88 94c24 10 52 11 84 1M96 78c21-8 43-8 66 0"></path>
    <path class="food soft-b" d="M106 78c10-17 34-19 48-3 12 15 5 36-16 42-25 7-45-16-32-39z"></path>
    <path class="root-line" d="M123 73c5 15 15 25 31 31M111 93c14 4 28 4 43 0"></path>
    <path class="plate" d="M174 120c20-13 41-11 58 4-17 18-39 22-62 10z"></path>
    <path class="watermelon" d="M184 119c12-6 25-5 37 3-11 9-24 11-37 3z"></path>
    <circle class="lamp" cx="103" cy="92" r="6"></circle>
    <circle class="lamp" cx="151" cy="89" r="6"></circle>
  `),
  滑溜溜: svgShell("剛拖過的反光地板插圖", `
    <rect class="room" x="39" y="42" width="184" height="97"></rect>
    <path class="window-line" d="M57 124h147M62 104h136M69 84h122M78 64h104"></path>
    <path class="lamp-glow" d="M71 118c33-9 72-10 116-3M88 96c25-7 54-7 88-2"></path>
    <path class="wood-line" d="M47 42v97M59 42v97"></path>
    <ellipse class="shadow" cx="132" cy="144" rx="83" ry="7"></ellipse>
    <circle class="person b" cx="171" cy="74" r="13"></circle>
    <path class="shoulders" d="M150 114c5-24 35-24 43 0"></path>
    <path class="hand" d="M158 104c-18 7-30 17-38 31-5 8 7 16 15 9 9-8 19-14 31-18 9-3 3-26-8-22z"></path>
    <path class="plate" d="M111 134c14-9 35-9 49 0"></path>
    <path class="person c" d="M75 132c9-10 22-10 30 0M92 132c9-10 22-10 30 0"></path>
  `),
  雜插: svgShell("黃昏巷子裡揹小孩的婦人插圖", `
    <rect class="room" x="38" y="39" width="184" height="97"></rect>
    <rect class="dark-window" x="51" y="55" width="37" height="31"></rect>
    <rect class="dark-window" x="174" y="50" width="34" height="29"></rect>
    <path class="window-line" d="M69 55v31M51 70h37M191 50v29M174 64h34"></path>
    <path class="lamp-glow" d="M53 83c10 7 23 7 34 0M176 77c9 7 20 7 30 0"></path>
    <ellipse class="shadow" cx="132" cy="143" rx="79" ry="8"></ellipse>
    <circle class="person b" cx="119" cy="76" r="15"></circle>
    <path class="hair" d="M105 73c2-17 22-25 35-13 7 7 8 17 3 26-8-8-20-12-38-13z"></path>
    <path class="shoulders" d="M91 134c4-38 45-51 65-18 4 7 6 14 7 22"></path>
    <circle class="person c" cx="151" cy="88" r="11"></circle>
    <path class="sofa" d="M139 101c16-7 31 3 35 19M138 101l21 37"></path>
    <path class="hand" d="M101 105c-8 13-12 25-12 36M150 105c7 13 10 25 9 37"></path>
    <path class="root-line" d="M128 79c8 2 14 7 18 13M136 89l8 1"></path>
    <path class="wind" d="M45 119c28-8 49-8 65 0M168 112c18-7 35-6 50 2"></path>
  `),
  澹漉漉: svgShell("騎樓下淋濕大笑的學生插圖", `
    <rect class="dark-window" x="37" y="36" width="186" height="99"></rect>
    <path class="awning" d="M35 42h190l-14 27H49z"></path>
    <path class="rain" d="M52 75l-16 31M76 72l-17 34M101 76l-15 30M177 74l-16 33M202 72l-17 35M220 83l-12 24"></path>
    <path class="window-line" d="M39 114h181M48 125h164"></path>
    <circle class="person a" cx="104" cy="84" r="18"></circle>
    <circle class="person b" cx="153" cy="86" r="18"></circle>
    <path class="hair" d="M85 82c2-23 31-29 39-7-15-2-27 1-39 7zM135 83c4-22 31-26 38-5-15-2-27 0-38 5z"></path>
    <path class="shoulders" d="M72 137c8-32 49-34 62-2M124 136c7-30 47-31 59 1"></path>
    <path class="root-line" d="M99 91c7 6 14 6 21 0M147 94c7 6 15 6 22 0"></path>
    <path class="rain" d="M93 61l-5 14M112 60l-4 15M143 63l-5 14M163 61l-4 15"></path>
    <path class="lamp-glow" d="M47 131c32-7 61-7 88 0M145 129c23-6 45-6 67 0"></path>
  `),
  勻勻仔: svgShell("扶牆慢慢走向沙發的老人插圖", `
    <rect class="room" x="39" y="38" width="184" height="99"></rect>
    <rect class="window" x="48" y="48" width="47" height="53"></rect>
    <path class="window-line" d="M71 48v53M48 74h47"></path>
    <path class="lamp-glow" d="M94 58c30 16 55 36 76 61M94 78c25 12 46 27 64 45"></path>
    <rect class="sofa" x="166" y="100" width="49" height="35" rx="5"></rect>
    <path class="wood-line" d="M39 38v99M45 38v99"></path>
    <circle class="person b" cx="111" cy="75" r="14"></circle>
    <path class="shoulders" d="M91 126c3-27 9-39 20-40 14-1 23 14 28 43"></path>
    <path class="hand" d="M99 93c-16 4-28 12-37 24-6 8 4 17 12 12 10-7 20-12 31-15"></path>
    <path class="stem" d="M132 105l-7 37M103 115l-4 27"></path>
    <path class="plate" d="M93 142h13M119 142h14"></path>
    <path class="wind" d="M142 125c8-3 15-3 22 0"></path>
    <ellipse class="shadow" cx="132" cy="144" rx="83" ry="6"></ellipse>
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
      createIllustration(note, index),
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

prevPageButton?.addEventListener("click", () => {
  currentPage -= 1;
  renderCurrentPage();
});

nextPageButton?.addEventListener("click", () => {
  currentPage += 1;
  renderCurrentPage();
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
