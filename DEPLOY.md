# 部署（Cloudflare Pages）

正式站：**https://gab-guide.pages.dev**（Pages 專案預設網域）
自訂網域：**https://gab-guide.omnivorouscat.com**（首次需手動加一次，見下方）

> 帳號 / zone / account ID 等與帳戶相關的細節不放進本開源 repo，存在本機 gitignore 的
> `info/deploy-credentials.md`（見 `.gitignore`）。部署前先讀那份取得 account ID。

## 架構決定（為什麼這樣部署）

- **純前端，無 Functions、無 D1、無 secrets。** 分析與計分由使用者自帶的 Gemini API key 在瀏覽器端直打 Google；key 只存在使用者瀏覽器 localStorage，沒有後端可打，流量成本恆為 $0、也沒有 blast radius。建置時 `vite.config.ts` 的 `process.env.*` define 在沒有 `GEMINI_API_KEY` 時為 undefined，屬預期（正式站不內嵌任何 key）。
- **`base` 為 `/`。** 本站掛在自己的 subdomain root（`gab-guide.omnivorouscat.com`），資產從 `/assets/*` 載入。舊的 GitHub Pages 部署在子路徑 `/gab-guide/`，兩者的 base 不相容——GitHub Pages workflow 已停用（見 `.github/workflows/deploy.yml`），主力託管改到這裡。
- **vite build 的 JS/CSS 帶 content-hash**，故快取單純：hashed bundle 長快取 immutable，其餘不帶 hash 的檔（entry HTML、favicon/logo、教學圖）走 no-cache（見 `public/_headers`）。

## Google 分析 / 廣告

- **AdSense**（`ca-pub-3282236858407428`）是帳號層級的公開識別碼，跨所有 domain 共用同一個 pub ID，內嵌在 `index.html`。`omnivorouscat.com` 是新 domain，需在 AdSense 後台 **Sites** 加入並通過審核，廣告才會實際投放（不會自動出現）。
- **GA（已啟用，共用 property）**：`omnivorouscat.com` 這個 root domain 有一個 GA4 property，底下**只有一條 web data stream**（`G-DG4P6FWLZE`），供所有 `*.omnivorouscat.com` subdomain 共用——本站（`gab-guide.omnivorouscat.com`）就是其一。gtag 區塊已加進 `index.html`；**不要**為本 subdomain 另開 stream（同 root 的 subdomain GA4 原生支援，多開反而讓跨站 journey 破碎）。要分開看各站數據時，用報表的 `hostname` 維度切。

## 部署 / 上版

```bash
npx wrangler login                                    # token 過期才需要（互動式 OAuth）
export CLOUDFLARE_ACCOUNT_ID=<見 info/deploy-credentials.md>
npm run deploy                                        # = npm run build && npx wrangler pages deploy
```

`wrangler.toml` 的 `pages_build_output_dir = "dist"` 讓 `wrangler pages deploy` 不必帶目錄參數。首次執行 `wrangler pages deploy` 會提示建立 `gab-guide` 專案，選 create 即可。

## 自訂網域：唯一需要手動的一步

`wrangler login` 拿到的 OAuth token 是 `zone:read`，不能寫 DNS，所以建立 CNAME 那步腳本做不到。首次上線要手動一次：

> Cloudflare Dashboard → **Workers & Pages → gab-guide → Custom domains → Set up a custom domain → `gab-guide.omnivorouscat.com`**

因為 `omnivorouscat.com` 在同一帳號，Cloudflare 會自動建 CNAME（`gab-guide` → `gab-guide.pages.dev`）並簽 SSL，幾分鐘生效。之後重新部署不用再做這步。

驗收：`dig +short gab-guide.omnivorouscat.com` 有值，且 `curl -sI https://gab-guide.omnivorouscat.com/` 回 200。

## 快取策略（`public/_headers` → 部署後在 `dist/_headers`）

- `/assets/*`（content-hash 過的 JS/CSS）→ `public, max-age=31536000, immutable`。
- `/`、`/index.html`、`/favicon.png`、`/logo.png`、`/tutorial/*`（不帶 hash）→ `no-cache`（存 body、每次 ETag 重新驗證，改版即拿到新版）。
- 路徑刻意不重疊、不用 `/*`：Pages 會把每一條符合規則併成一個 header，`/*` 的 no-cache 會蓋掉 `/assets/*` 的長快取。

### zone 的 Browser Cache TTL 注意事項

若 `omnivorouscat.com` 這個 zone 設了非預設的 Browser Cache TTL，它只套在 Cloudflare 認定的可快取靜態副檔名上，可能蓋掉 `_headers`。對本站：

- **JS/CSS 帶 content-hash → 即使被套瀏覽器快取也無害甚至有益**（改版換檔名自然破快取），不需處理。
- `.html` 通常不在該清單裡 → entry 不受影響。
- **PNG（favicon/logo/tutorial）在清單裡 → 可能被 zone TTL 蓋成較長快取**。這些圖幾乎不變，一般可接受。若某次改了圖要立刻生效，可到 Dashboard 對該檔 Purge，或建 Cache Rule（`Hostname equals gab-guide.omnivorouscat.com` → Browser TTL → Respect Existing Headers）。

**驗收**（改動快取相關設定後跑）：

```bash
curl -sI https://gab-guide.omnivorouscat.com/assets/$(ls dist/assets | grep '\.js$') | grep -i cache-control
# 期望：public, max-age=31536000, immutable
curl -sI https://gab-guide.omnivorouscat.com/ | grep -i cache-control
# 期望：no-cache
```

## 找不到的路徑

Pages 對未命中的路徑回 `index.html` + HTTP 200（SPA fallback，因為專案沒有 `404.html`），單頁應用的深連結都會落回首頁，不需要 `_redirects`。
