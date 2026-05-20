const nav = document.querySelector("[data-nav]");
const navToggle = document.querySelector("[data-nav-toggle]");
const navLinks = [...document.querySelectorAll(".site-nav a")];
const sections = [...document.querySelectorAll("main section[id]")];
const notesGrid = document.querySelector("[data-notes-grid]");
const shuffleButton = document.querySelector("[data-shuffle-notes]");

const dataDirectory = "data/field-notes";
const dataIndexPath = `${dataDirectory}/index.json`;
const notesPerDraw = 5;
let allFieldNotes = [];
let drawPool = [];

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
  definition: normalizeText(getNoteValue(note, ["definition", "meaning", "description", "explanation", "釋義"])?.本義 || getNoteValue(note, ["definition", "meaning", "description", "explanation", "釋義"]), "釋義未提供"),
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

const normalizeDataPaths = (payload) => {
  const files = Array.isArray(payload) ? payload : payload?.files;
  if (!Array.isArray(files)) return [];

  return files
    .map((file) => {
      const path = typeof file === "string" ? file : file?.path || file?.file || file?.url;
      if (!path) return "";
      if (/^(https?:)?\/\//.test(path) || path.startsWith("/")) return path;
      return `${dataDirectory}/${path}`;
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

    allFieldNotes = loadedNotes;
    drawPool = shuffle(allFieldNotes);
    renderRandomNotes();
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
