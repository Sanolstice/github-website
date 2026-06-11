# 台語感官田調網站

這是純 HTML、CSS、JavaScript 網站。預設採用「手動圖片模式」，網站本身
不需要 OpenAI API key，也不需要先執行自動產圖。

## 每日資料

每日 JSON 放在 `data/field-notes/`：

```json
{
  "date": "2026-06-11",
  "entries": [
    {
      "id": "2026-06-11-100000",
      "詞目": "範例",
      "插圖_prompt": "既有的插圖 prompt"
    }
  ]
}
```

- `id`：每筆資料的穩定識別，也是預設圖片檔名。
- `插圖_prompt`：手動或選用自動產圖時使用的既有 prompt。
- `image`：選填。沒有此欄位時，前端自動使用
  `generated-images/{id}.png`。
- 圖片 alt text 優先使用 `alt`、`title`、`description`，最後使用
  `詞目`。

圖片不存在或載入失敗時，卡片會顯示「尚未加入圖片」placeholder，不影響
其他內容或網站操作。

## 手動圖片流程

每天新增 JSON 後：

1. 複製該筆 JSON 的 `插圖_prompt`。
2. 到 ChatGPT 手動生圖。
3. 下載圖片。
4. 將圖片改名為 `{id}.png`，例如
   `2026-06-11-100000.png`。
5. 將圖片放進 `public/generated-images/`。
6. 執行：

```bash
npm run build
```

`npm run build` 會更新 `data/field-notes/index.json`，並把
`public/generated-images/` 同步到網站實際提供的 `generated-images/`。
前端會以相對路徑 `generated-images/{id}.png` 讀取圖片。這樣在 GitHub
Pages 的 `/github-website/` 子路徑部署時，圖片會正確解析為
`/github-website/generated-images/{id}.png`。

若圖片需要重做，替換或刪除
`public/generated-images/{id}.png`，再執行 `npm run build`。

## 選用：OpenAI API 自動產圖

`scripts/generate-images.js` 與以下指令是選用功能：

```bash
npm run generate-images
```

只有使用自動產圖時才需要 OpenAI API key。可在專案根目錄建立不會被 Git
追蹤的 `.env`：

```text
OPENAI_API_KEY=your_api_key_here
```

手動圖片模式不需要建立 `.env`，也不需要執行 `npm run generate-images`。
API key、ChatGPT 登入資訊與任何 token 都不可寫入 JSON、前端程式或提交到
Git。
