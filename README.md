

# Review Scraper – G2 & Capterra

## Overview
This project is an **Express.js API** for scraping product reviews from **G2** and **Capterra** for a specified company.  
It supports:
- Dynamic review fetching by **company slug**
- Optional **page number** selection
- Source selection (`"g2"` or `"capterra"`)
- Automatic **saving of results** into a JSON file, grouped by company

***
Demo Video : https://drive.google.com/file/d/1pbXSeURjoFyMD9ktSxPgHHQIs1q2CnLG/view?usp=sharing

## Why Different Approaches for Each Source?

### **G2 – ScrapFly + Cheerio**
- **Reasoning:**  
  - G2 has **strong anti-bot protection** (e.g., Cloudflare, Akamai, `data-poison` traps).
  - Direct requests with Axios/fetch quickly get blocked.
  - ScrapFly is used here because it:
    - Bypasses anti‑scraping via **ASP mode**.
    - Fetches **fully rendered** HTML (`render_js: true`).
    - Gives stable results without managing proxies/manually rotating IPs.
  - Once the full HTML is fetched, **Cheerio** is used to parse it:
    - G2 uses `itemprop` schema markup (`reviewBody`, `ratingValue`, `author`, etc.)
    - This structured markup makes it easy to reliably extract data.
- **Advantages:**  
  - Fast, lightweight parsing.
  - Avoids full browser automation overhead.
- **Trade‑off:**  
  - Requires a ScrapFly API key and usage quota.

***

### **Capterra – Playwright Browser Automation**
- **Reasoning:**  
  - Capterra’s review pages are **not directly linked** , you must:
    1. Search for the product in the search results.
    2. Click the **"View all reviews"** link.
    3. Land on a dynamically generated SPA review page.
  - The content is **JS-rendered using React**, and reviews load only after the page's UI events (clicks/navigation).
  - Attempted static scraping (ScrapFly + Cheerio) hit a **403 Forbidden** on search pages due to bot defenses.
  - **Playwright** solves this by:
    - Running an actual Chromium browser (headless or visible).
    - Simulating **real user actions** (navigate → click → scrape DOM).
    - Setting a **realistic User-Agent + viewport + locale** to reduce headless detection.
- **Advantages:**
  - Works even for dynamic, interaction‑based pages.
  - Lets you execute complex navigation flows.
- **Trade‑off:**
  - Slower than HTML parsing.
  - More resource‑intensive.
  - Requires careful wait/scroll logic for headless mode.

***

## How It Works

### **Request Flow**
1. `POST /reviews` with:
   ```json
   { "companySlug": "notion", "page": 1, "source": "g2" }
   ```
2. Router decides:
   - If `source: "g2"` → calls `g2Scrapper()`.
   - If `source: "capterra"` → calls `capterraScraper()`.
3. Scraper function fetches reviews.
4. `saveReviews()` merges new reviews into `reviews.json`.
5. API returns JSON:
   ```json
   { "count": 20, "reviews": [...], "companySlug": "notion" }
   ```

***

### **G2 Scraper Steps**
- Build URL: `https://www.g2.com/products/${companySlug}/reviews?page=${page}`
- Call ScrapFly with:
  - `asp: true` (anti-bot bypass)
  - `render_js: true` (execute JS)
- Save HTML for debugging.
- Use Cheerio to select `div[data-poison] article` and pull:
  - `ratingValue`, `author`, `datePublished`, review `title`, `reviewBody` text.
- Return clean JSON.

***

### **Capterra Scraper Steps**
- Open Chromium via Playwright.
- New browser context with:
  - Realistic `userAgent`
  - Normal `viewport`
  - `locale: 'en-US'`
- Go to `https://www.capterra.com/search/?query=${companySlug}`
- Find and extract the **"View all reviews"** link from the first product card.
- Navigate to that URL (adding `?page=${pageno}`).
- Scrape `div[data-test-id="review-cards-container"] > div` for:
  - Reviewer name, review title, date, rating, pros, cons.
- Return clean JSON.

***

## Installation & Running

### Install dependencies:
```bash
npm install
```

### Environment setup:
Create `.env`:
```env
SCRAPFLY_API_KEY=your_scrapfly_key
```

### Start server:
```bash
node index.js
```

### Example API Calls:
**G2:**
```bash
curl -X POST http://localhost:3000/reviews \
-H "Content-Type: application/json" \
-d '{"companySlug": "notion", "page": 1, "source": "g2"}'
```

**Capterra:**
```bash
curl -X POST http://localhost:3000/reviews \
-H "Content-Type: application/json" \
-d '{"companySlug": "notion", "page": 1, "source": "capterra"}'
```


