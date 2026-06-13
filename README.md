# 台語感官田調網站

純 HTML、CSS、JavaScript 的 GitHub Pages 網站。原始資料與高解析插圖保留在本機
私有目錄；Git 只保存去敏後的公開資料與最佳化圖片。

## 資料與部署邊界

| 目錄 | 用途 | Git / Pages |
| --- | --- | --- |
| `private-data/field-notes/` | 每日原始 JSON、prompt、內部備註 | 不提交、不部署 |
| `private-assets/generated-images/` | 高解析 PNG 原圖 | 不提交、不部署 |
| `public/data/` | 去敏後、分頁且 hash 命名的公開 JSON | 提交、部署 |
| `public/assets/images/` | responsive WebP 與高品質 JPEG fallback | 提交、部署 |
| `dist/` | allowlist 組成的最終 Pages artifact | 不提交，由 Actions 部署 |

`public/data/` 只包含網站畫面實際使用的欄位：詞目、台羅、公開釋義、田調筆記、
公開分類、教育部辭典連結、圖片 alt 與最佳化圖片路徑。它不包含
`插圖_prompt`、`社群來源`、內部脈絡或完整原始 JSON。

公開網站上實際顯示的文字與圖片仍然可以被下載或爬取。靜態網站無法提供真正的
DRM；hash 檔名、分頁與 robots 只能降低批次列舉及一般搜尋引擎索引風險。

## 每日更新流程

1. 在 `private-data/field-notes/` 新增每日 JSON。
2. 圖片採手動模式時，複製 JSON 的 `插圖_prompt` 到 ChatGPT 生圖。
3. 將高解析圖片命名為 `{id}.png`，放到
   `private-assets/generated-images/`。
4. 執行：

```bash
npm install
npm run build
```

`npm run build` 會：

1. 產生 480、768、1200、1600px 的高品質 WebP。
2. 產生高品質 JPEG fallback。
3. 使用內容 hash 命名圖片，避免瀏覽器或 CDN 顯示舊圖。
4. 從私有 JSON 產生每頁 9 筆的最小公開資料。
5. 建立 `dist/` 並掃描 prompt、secret、私鑰與禁止部署的原始素材。

本機預覽請以靜態伺服器提供 `dist/`，例如：

```bash
python3 -m http.server 8000 --directory dist
```

## 選用：OpenAI API 自動產圖

```bash
npm run generate-images -- --id-prefix=2026-06-12
```

此功能只會將原圖寫入 ignored 的 `private-assets/generated-images/`，不會直接把
API 產物放進 Pages。API key 僅能存在根目錄 `.env`：

```text
OPENAI_API_KEY=your_api_key_here
MAX_IMAGES_PER_RUN=3
```

完成後仍需執行 `npm run build`。

## GitHub Pages

`.github/workflows/deploy-pages.yml` 只部署 `dist/`。首次切換後，請在 repository
的 **Settings → Pages → Build and deployment → Source** 選擇
**GitHub Actions**。Actions 不使用 OpenAI key，也不需要任何應用程式 secret。

## 已知限制

- 此 repository 目前是 public。已提交過的原始 JSON、prompt 與 PNG 仍存在 Git
  歷史中；普通刪檔不會清除歷史。若內容屬敏感資料，需另行重寫 Git 歷史並通知
  所有 clone 重新取得，或改用新的乾淨 repository。
- 若希望未來的原始資料也不出現在 public repo，請維持 `private-data/` 與
  `private-assets/` 不受 Git 追蹤，或把來源移到獨立 private repo。
- Cloudflare 規則需要自有網域；設定建議見
  [`docs/cloudflare-recommendations.md`](docs/cloudflare-recommendations.md)。
