import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");
const dataDirectory = path.join(rootDirectory, "private-data", "field-notes");
const generatedImagesDirectory = path.join(rootDirectory, "private-assets", "generated-images");
const promptFields = ["插圖_prompt", "imagePrompt", "illustrationPrompt", "prompt"];
const imageFields = ["image", "imageUrl", "image_url", "圖片", "圖片路徑"];
const promptSuffix = "No text, no logo, no watermark, no UI elements, no captions.";
const supportedImageExtensions = new Set([".png", ".webp", ".jpg", ".jpeg"]);
const defaultMaxImagesPerRun = 3;
const dryRun = process.argv.includes("--dry-run");
const idPrefixArgument = process.argv.find((argument) => argument.startsWith("--id-prefix="));
const idPrefix = idPrefixArgument?.slice("--id-prefix=".length).trim() || "";

if (existsSync(path.join(rootDirectory, ".env")) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(path.join(rootDirectory, ".env"));
}

const getText = (record, fields) => {
  for (const field of fields) {
    const value = record?.[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const getMaxImagesPerRun = () => {
  const configuredValue = process.env.MAX_IMAGES_PER_RUN?.trim();
  if (!configuredValue) return defaultMaxImagesPerRun;

  if (!/^\d+$/.test(configuredValue)) {
    throw new Error(
      `MAX_IMAGES_PER_RUN 必須是非負整數，目前設定為：${configuredValue}`
    );
  }

  const parsedValue = Number(configuredValue);
  if (!Number.isSafeInteger(parsedValue)) {
    throw new Error("MAX_IMAGES_PER_RUN 超出可安全處理的整數範圍。");
  }

  return parsedValue;
};

const sanitizeFileStem = (value) =>
  String(value)
    .normalize("NFKC")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getStableId = (entry, date, index) => {
  const id = getText(entry, ["id", "slug"]);
  return sanitizeFileStem(id || `${date}-${String(index + 1).padStart(3, "0")}`);
};

const getLocalImageTarget = (entry, date, index) => {
  const explicitImage = getText(entry, imageFields);

  if (/^(https?:)?\/\//i.test(explicitImage) || explicitImage.startsWith("data:")) {
    return { external: true, publicPath: explicitImage, outputPath: null };
  }

  const requestedPath = explicitImage
    ? explicitImage.replace(/^\.?\//, "").replace(/^public\//, "")
    : `generated-images/${getStableId(entry, date, index)}.png`;

  if (!requestedPath.startsWith("generated-images/")) {
    throw new Error(`image 必須位於 generated-images/：${explicitImage}`);
  }

  const relativeImagePath = requestedPath.slice("generated-images/".length);
  const publicPath = `/generated-images/${relativeImagePath}`;
  const outputPath = path.resolve(generatedImagesDirectory, relativeImagePath);
  const relativePath = path.relative(generatedImagesDirectory, outputPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`圖片路徑超出專案範圍：${publicPath}`);
  }

  const extension = path.extname(outputPath).toLowerCase();
  if (!supportedImageExtensions.has(extension)) {
    throw new Error(`不支援的圖片格式：${publicPath}`);
  }

  return { external: false, publicPath, outputPath };
};

const getOutputFormat = (outputPath) => {
  const extension = path.extname(outputPath).toLowerCase();
  if (extension === ".webp") return "webp";
  if (extension === ".jpg" || extension === ".jpeg") return "jpeg";
  return "png";
};

const readDailyFiles = async () => {
  const fileNames = (await readdir(dataDirectory))
    .filter((fileName) => fileName.endsWith(".json") && fileName !== "index.json")
    .sort();
  const records = [];

  for (const fileName of fileNames) {
    const filePath = path.join(dataDirectory, fileName);
    const payload = JSON.parse(await readFile(filePath, "utf8"));
    const entries = Array.isArray(payload) ? payload : payload?.entries;
    const date = payload?.date || path.basename(fileName, ".json");

    if (!Array.isArray(entries)) {
      console.warn(`[skip] ${fileName} 沒有 entries 陣列。`);
      continue;
    }

    entries.forEach((entry, index) => {
      records.push({ date, entry, fileName, index });
    });
  }

  return records;
};

const requestImage = async (prompt, outputPath) => {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
      prompt: `${prompt}\n\n${promptSuffix}`,
      size: process.env.OPENAI_IMAGE_SIZE || "1536x1024",
      quality: process.env.OPENAI_IMAGE_QUALITY || "medium",
      output_format: getOutputFormat(outputPath),
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI API 回傳 HTTP ${response.status}`);
  }

  const base64Image = payload?.data?.[0]?.b64_json;
  if (!base64Image) throw new Error("OpenAI API 回應中沒有 b64_json 圖片資料。");

  const imageBuffer = Buffer.from(base64Image, "base64");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, imageBuffer);
};

const main = async () => {
  if (!dryRun && !process.env.OPENAI_API_KEY) {
    console.error(
      "找不到 OPENAI_API_KEY。請設定環境變數，或在專案根目錄建立不會提交的 .env。"
    );
    process.exitCode = 1;
    return;
  }

  await mkdir(generatedImagesDirectory, { recursive: true });
  const maxImagesPerRun = getMaxImagesPerRun();
  console.log(`[config] 本次最多呼叫 Images API ${maxImagesPerRun} 次。`);
  const records = await readDailyFiles();
  const selectedRecords = idPrefix
    ? records.filter(({ date, entry, index }) =>
        getStableId(entry, date, index).startsWith(idPrefix)
      )
    : records;

  if (idPrefix) {
    console.log(`[config] 僅處理 ID 前綴 ${idPrefix}，共 ${selectedRecords.length} 筆。`);
  }

  const summary = {
    generated: 0,
    apiCalls: 0,
    skipped: 0,
    warnings: 0,
    failed: 0,
    limitReached: false,
  };

  for (const { date, entry, fileName, index } of selectedRecords) {
    const label = getStableId(entry, date, index);

    try {
      const target = getLocalImageTarget(entry, date, index);

      if (target.external) {
        console.log(`[skip] ${label} 已指定外部 image：${target.publicPath}`);
        summary.skipped += 1;
        continue;
      }

      if (existsSync(target.outputPath)) {
        console.log(`[skip] ${label} 圖片已存在：${target.publicPath}`);
        summary.skipped += 1;
        continue;
      }

      const prompt = getText(entry, promptFields);
      if (!prompt) {
        console.warn(`[warn] ${fileName} / ${label} 缺少插圖 prompt，已跳過。`);
        summary.warnings += 1;
        continue;
      }

      if (dryRun) {
        console.log(`[dry-run] ${label} 將產生：${target.publicPath}`);
        summary.skipped += 1;
        continue;
      }

      if (summary.apiCalls >= maxImagesPerRun) {
        console.warn(
          `[limit] 已達本次 API 呼叫上限 ${maxImagesPerRun} 張，停止繼續產圖。` +
            "已存在的圖片未計入此限制。"
        );
        summary.limitReached = true;
        break;
      }

      summary.apiCalls += 1;
      console.log(
        `[generate ${summary.apiCalls}/${maxImagesPerRun}] ${label} -> ${target.publicPath}`
      );
      await requestImage(prompt, target.outputPath);
      summary.generated += 1;
    } catch (error) {
      console.error(`[failed] ${fileName} / ${label}: ${error.message}`);
      summary.failed += 1;
    }
  }

  console.log(
    `完成：API 呼叫 ${summary.apiCalls}/${maxImagesPerRun}、產生 ${summary.generated}、` +
      `跳過 ${summary.skipped}、警告 ${summary.warnings}、失敗 ${summary.failed}。`
  );

  if (summary.failed) process.exitCode = 1;
};

main().catch((error) => {
  console.error(`圖片產生流程無法啟動：${error.message}`);
  process.exitCode = 1;
});
