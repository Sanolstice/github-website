import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");
const privateImagesDirectory = path.join(rootDirectory, "private-assets", "generated-images");
const privateHeroPath = path.join(
  rootDirectory,
  "private-assets",
  "hero",
  "taiwan-street-illustration.png"
);
const publicImagesDirectory = path.join(rootDirectory, "public", "assets", "images");
const buildDirectory = path.join(rootDirectory, ".build");
const imageManifestPath = path.join(buildDirectory, "image-manifest.json");
const heroManifestPath = path.join(rootDirectory, "public", "assets", "hero-manifest.json");
const responsiveWidths = [480, 768, 1200, 1600];
const expectedOutputFiles = new Set();

const hashBuffer = (buffer) => createHash("sha256").update(buffer).digest("hex").slice(0, 16);

const relativePublicPath = (fileName) => `assets/images/${fileName}`;

const getResponsiveWidths = (sourceWidth) => {
  const widths = responsiveWidths
    .map((width) => Math.min(width, sourceWidth))
    .filter((width, index, values) => values.indexOf(width) === index);

  if (!widths.includes(sourceWidth) && sourceWidth < responsiveWidths.at(-1)) {
    widths.push(sourceWidth);
  }

  return widths.sort((a, b) => a - b);
};

const optimizeImage = async (sourcePath) => {
  const sourceBuffer = await readFile(sourcePath);
  const sourceHash = hashBuffer(sourceBuffer);
  const metadata = await sharp(sourceBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`無法取得圖片尺寸：${sourcePath}`);
  }

  const widths = getResponsiveWidths(metadata.width);
  const webpVariants = [];

  for (const width of widths) {
    const fileName = `${sourceHash}-${width}.webp`;
    expectedOutputFiles.add(fileName);
    const outputPath = path.join(publicImagesDirectory, fileName);
    await sharp(sourceBuffer)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 92, effort: 6, smartSubsample: true })
      .toFile(outputPath);
    webpVariants.push({ width, path: relativePublicPath(fileName) });
  }

  const fallbackWidth = Math.min(metadata.width, 1600);
  const fallbackHeight = Math.round((metadata.height * fallbackWidth) / metadata.width);
  const fallbackFileName = `${sourceHash}-${fallbackWidth}.jpg`;
  expectedOutputFiles.add(fallbackFileName);
  await sharp(sourceBuffer)
    .resize({ width: fallbackWidth, withoutEnlargement: true })
    .jpeg({
      quality: 95,
      progressive: true,
      chromaSubsampling: "4:4:4",
      mozjpeg: true,
    })
    .toFile(path.join(publicImagesDirectory, fallbackFileName));

  return {
    fallback: relativePublicPath(fallbackFileName),
    src: webpVariants.at(-1).path,
    srcset: webpVariants.map(({ width, path: imagePath }) => `${imagePath} ${width}w`).join(", "),
    width: fallbackWidth,
    height: fallbackHeight,
  };
};

const getDirectorySize = async (directory) => {
  if (!existsSync(directory)) return 0;
  const entries = await readdir(directory, { withFileTypes: true });
  let total = 0;

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      total += await getDirectorySize(entryPath);
    } else {
      total += (await stat(entryPath)).size;
    }
  }

  return total;
};

const formatMiB = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;

const main = async () => {
  if (!existsSync(privateImagesDirectory)) {
    throw new Error(`找不到私有圖片目錄：${privateImagesDirectory}`);
  }
  if (!existsSync(privateHeroPath)) {
    throw new Error(`找不到主視覺原圖：${privateHeroPath}`);
  }

  await rm(publicImagesDirectory, { recursive: true, force: true });
  await mkdir(publicImagesDirectory, { recursive: true });
  await mkdir(buildDirectory, { recursive: true });

  const imageFiles = (await readdir(privateImagesDirectory))
    .filter((fileName) => /\.(png|jpe?g|webp)$/i.test(fileName))
    .sort();
  const notes = {};

  for (const fileName of imageFiles) {
    const id = path.basename(fileName, path.extname(fileName));
    notes[id] = await optimizeImage(path.join(privateImagesDirectory, fileName));
    console.log(`[image] ${id}`);
  }

  const hero = await optimizeImage(privateHeroPath);
  for (const fileName of await readdir(publicImagesDirectory)) {
    if (!expectedOutputFiles.has(fileName)) {
      await rm(path.join(publicImagesDirectory, fileName), { force: true });
    }
  }
  await writeFile(
    imageManifestPath,
    `${JSON.stringify({ notes, hero }, null, 2)}\n`,
    "utf8"
  );
  await mkdir(path.dirname(heroManifestPath), { recursive: true });
  await writeFile(heroManifestPath, `${JSON.stringify(hero, null, 2)}\n`, "utf8");

  const sourceBytes =
    (await getDirectorySize(privateImagesDirectory)) +
    (await stat(privateHeroPath)).size;
  const outputBytes = await getDirectorySize(publicImagesDirectory);
  console.log(
    `Optimized ${imageFiles.length + 1} image(s): ` +
      `${formatMiB(sourceBytes)} source -> ${formatMiB(outputBytes)} public variants.`
  );
};

main().catch((error) => {
  console.error(`圖片最佳化失敗：${error.message}`);
  process.exitCode = 1;
});
