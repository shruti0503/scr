// routes/g2Reviews.js
import express from 'express';
import { ScrapflyClient, ScrapeConfig } from 'scrapfly-sdk';
import dotenv from 'dotenv';
import fs from 'fs'
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
dotenv.config();
const router = express.Router();



const  capterraScraper=async(companySlug) =>{
    const browser = await chromium.launch({ headless: true , args: ['--no-sandbox', '--disable-dev-shm-usage']});
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 }, 
        locale: 'en-US',
    });

    const page = await context.newPage();

    const reviews = [];

    // Step 1: Search for the company
    const searchUrl = `https://www.capterra.com/search/?query=${encodeURIComponent(companySlug)}`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

    // Step 2: Click the first "View all reviews" lnk
    const viewReviewsLink = await page.getAttribute(
        'a:has-text("View all reviews")',
        'href'
    );

    if (!viewReviewsLink) {
        console.log('No reviews link found');
        await browser.close();
        return reviews;
    }

    const reviewPageUrl = viewReviewsLink.startsWith('http')
        ? viewReviewsLink
        : `https://www.capterra.com${viewReviewsLink}`;
    
    console.log("Review page:", reviewPageUrl);
    await page.goto(reviewPageUrl, { waitUntil: 'domcontentloaded' });

    // Step 3: Scrape reviews
    const reviewCards = await page.$$('div[data-test-id="review-cards-container"] > div');

    for (let card of reviewCards) {
        try{
            const reviewer = await card.$eval('.typo-20.text-neutral-99.font-semibold:nth-of-type(1)', el => el.textContent?.trim());
            console.log("reviewer",reviewer);
            const title = (await card.$eval('h3', el => el.textContent))?.trim().replace(/^"|"$/g, '');
            const date = (await card.$eval('div.typo-0', el => el.textContent))?.trim();
            console.log("title", title)
            const overallRating = await card.$eval('div[data-testid="rating"]', el => el.querySelectorAll('i').length);
            const pros = await card.$eval('span:has-text("Pros")', el => el.parentElement.nextElementSibling?.textContent.trim()).catch(() => "");
            const cons = await card.$eval('span:has-text("Cons")', el => el.parentElement.nextElementSibling?.textContent.trim()).catch(() => "");

            reviews.push({ reviewer, title, date, overallRating, pros, cons });

        }
        catch(err){
            console.warn('missing element', err.message);
        }
    }

    await browser.close();
    console.log("reviews",reviews)
    return reviews;
}


// POST /g2-reviews
router.post("/reviews", async (req, res) => {
    const { companySlug, page = 1, source } = req.body;
    const client = new ScrapflyClient({ key: process.env.SCRAPFLY_API_KEY });

    if (!companySlug) {
        return res.status(400).json({ error: "Company slug is required" });
    }

    try {
        if (source === "g2") {
            const targetUrl = `https://www.g2.com/products/${companySlug}/reviews?page=${page}`;
            const result = await client.scrape(new ScrapeConfig({
                url: targetUrl,
                asp: true,          
                country: "US",
                render_js: true    
            }));

            const html = result.result.content;
            fs.writeFileSync("g2_html.txt", html, "utf8");
            const $ = cheerio.load(html);
            const reviews = [];

            $("div[data-poison] article").each((i, el) => {
                const rating = $(el).find('[itemprop="ratingValue"]').attr("content") || null;
                const author = $(el).find('[itemprop="author"] [itemprop="name"]').attr("content") 
                    || $(el).find('[itemprop="author"] meta[itemprop="name"]').attr("content") 
                    || $(el).find('[itemprop="author"]').text().trim();
                const date = $(el).find('meta[itemprop="datePublished"]').attr("content") || null;
                const title = $(el).find('[itemprop="name"]').first().text().trim().replace(/^"|"$/g, "");

                let bodyParts = [];
                $(el).find('[itemprop="reviewBody"]').each((_, sec) => {
                    bodyParts.push($(sec).text().trim());
                });
                const body = bodyParts.join("\n\n").trim();

                reviews.push({ title, author, date, rating, body });
            });

            return res.json({ count: reviews.length, reviews, companySlug:companySlug });

        } 
        else if(source==="capterra"){
            const reviews=await capterraScraper(companySlug);
            console.log("reviews hihi",reviews)
            return res.json({ count: reviews.length, reviews , companySlug});

        }
        // else if (source === "capterra") {
            
        //     // Step 1: Search
        //     const searchUrl = `https://www.capterra.com/search/?query=${encodeURIComponent(companySlug)}`;
        //     const searchResult = await client.scrape(new ScrapeConfig({
        //         url: searchUrl,
        //         asp: true,
        //         country: "US",
        //         render_js: true
        //     }));

        //     const $search = cheerio.load(searchResult.result.content);

        //     // Step 2: Get first product card's "View all reviews" link
        //     const firstCard = $search('div[data-testid="search-product-card"]').first();
        //     const reviewsLink = firstCard.find('a:contains("View all reviews")').attr("href");
        //     console.log("reviewsLink",reviewsLink);

        //     if (!reviewsLink) {
        //         return res.status(404).json({ error: "No product reviews link found" });
        //     }

        //     // Step 3: Go to review page
        //     const reviewPageUrl = reviewsLink.startsWith("http") 
        //         ? reviewsLink 
        //         : `https://www.capterra.com${reviewsLink}`;

        //     console.log("reviewPageUrl ",reviewPageUrl);

        //     const reviewResult = await client.scrape(new ScrapeConfig({
        //         url: reviewPageUrl,
        //         asp: true,
        //         country: "US",
        //         render_js: true
        //     }));

        //     const $reviews = cheerio.load(reviewResult.result.content);
        //     const reviews = [];

        //     // Step 4: Extract reviews
        //     $reviews('div[data-test-id="review-cards-container"] > div').each((i, el) => {
        //         const reviewer = $reviews(el).find('span.typo-20').first().text().trim();
        //         const title = $reviews(el).find('h3').first().text().trim().replace(/^"|"$/g, '');
        //         const date = $reviews(el).find('div.typo-0').first().text().trim();
        //         const overallRating = $reviews(el).find('div[data-testid="rating"] span').first().text().trim();

        //         const pros = $reviews(el).find('span:contains("Pros")').parent().next('p').text().trim();
        //         const cons = $reviews(el).find('span:contains("Cons")').parent().next('p').text().trim();

        //         reviews.push({ reviewer, title, date, overallRating, pros, cons });
        //     });

        //     return res.json({ count: reviews.length, reviews });
        // } 
        else {
            return res.status(400).json({ error: "Unsupported source" });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});

export default router;
