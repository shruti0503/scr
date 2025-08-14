import express from 'express';
import { ScrapflyClient, ScrapeConfig } from 'scrapfly-sdk';
import dotenv from 'dotenv';
import fs from 'fs'
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import path from 'path';
dotenv.config();

export const  capterraScraper=async(companySlug, pageno) =>{
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
        ? `${viewReviewsLink}/?page=${pageno}`
        : `https://www.capterra.com${viewReviewsLink}/?page=${pageno}`;
    
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

export const g2Scrapper=async(companySlug, page)=>{
    const client = new ScrapflyClient({ key: process.env.SCRAPFLY_API_KEY });
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

    return reviews;
    

}


export const saveReviews = async (newReviews, companyName, fileName = 'reviews.json') => {
    const filePath = path.join(process.cwd(), fileName);
    let existingData = {};

    // Read existing reviews if file exists
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        try {
            existingData = JSON.parse(data);
        } catch (err) {
            console.warn(`Failed to parse existing ${fileName}, starting fresh.`);
        }
    }

    // Initialize company array if not exists
    if (!existingData[companyName]) {
        existingData[companyName] = [];
    }

    // Merge new reviews for this company
    existingData[companyName] = [...existingData[companyName], ...newReviews];

    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));

    return existingData[companyName];
};

