# Cloudflare 建議設定

這份文件只提供後台設定建議，不會自動修改 Cloudflare。GitHub Pages 目前使用
`github.io` 網址時，無法直接套用自己的 Cloudflare 規則；必須先使用自有網域，
把 DNS 交給 Cloudflare 並代理該網域。

## Cache Rules

建議依序建立：

| 路徑 | Edge TTL | Browser TTL | 說明 |
| --- | --- | --- | --- |
| `/assets/images/*` | 1 年 | 1 年 | 圖片使用內容 hash 命名，可安全長期快取。 |
| `/assets/app-*.css`、`/assets/app-*.js` | 1 年 | 1 年 | CSS/JS 使用內容 hash 命名。 |
| `/data/page-*.json` | 1 年 | 1 年 | 分頁 JSON 使用內容 hash 命名。 |
| `/data/manifest.json` | 5 分鐘 | Respect existing headers 或 5 分鐘 | 這是唯一固定檔名，需較快取得新版本。 |
| `/`、`/index.html` | 5 分鐘 | Respect existing headers | 避免新版入口頁長時間卡在舊快取。 |

不要對所有 HTML 與 `manifest.json` 套用一年快取。發布後若內容未更新，先檢查
Cloudflare 是否快取了固定檔名入口，再考慮 Purge Cache。

## Rate Limiting

先以 Log 或 Managed Challenge 觀察，再啟用 Block。門檻需依實際流量調整：

| 範圍 | 起始建議 | 動作 |
| --- | --- | --- |
| `/data/*` | 單一 IP 每分鐘超過 60 次 | Managed Challenge，持續 10 分鐘 |
| `/assets/images/*` | 單一 IP 每分鐘超過 240 次 | Managed Challenge，持續 10 分鐘 |
| 全站明顯爆量 | 單一 IP 每分鐘超過 600 次 | Managed Challenge 或暫時 Block |

圖片頁面會正常並行下載，門檻不可設得太低。免費或不同方案可用的 Rate Limiting
欄位、規則數量與動作可能不同，請以 Cloudflare 後台顯示為準。

## Bot 與防盜連

- 可先開啟 Bot Fight Mode，觀察 Analytics 是否誤判正常讀者。
- 對已知惡意 ASN、資料中心流量或異常 User-Agent，可用 WAF Custom Rule 加
  Managed Challenge。
- Hotlink Protection 可降低第三方網站直接嵌圖，但不能防止直接下載、截圖或
  重新上傳，也可能影響 RSS、社群預覽與合法引用，啟用前需測試。
- 不建議只靠 `robots.txt`、Referer、禁止右鍵或 JS 混淆。它們不是存取控制。

## 官方文件

- [Cache Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/)
- [Browser Cache TTL](https://developers.cloudflare.com/cache/how-to/edge-browser-cache-ttl/)
- [Rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Bot Fight Mode](https://developers.cloudflare.com/bots/get-started/free/)
- [Managed Challenge](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/challenge-passage/)
- [Hotlink Protection](https://developers.cloudflare.com/waf/tools/scrape-shield/hotlink-protection/)
