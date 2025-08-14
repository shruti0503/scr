import puppeteer from "puppeteer";
import filterByDate from "../utils/dateFilter.js";

export default async function g2Scraper(companyName, startDate, endDate, browser) {
  const url = `https://www.g2.com/products/${companyName}/reviews`;
  //const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2" });

  let reviews = [];
  let hasNext = true;

  while (hasNext) {
    const pageReviews = await page.evaluate(() => {
      return [...document.querySelectorAll(".review-card")].map(card => ({
        title: card.querySelector(".review-title")?.innerText || "",
        review: card.querySelector(".review-content")?.innerText || "",
        date: card.querySelector(".review-date")?.innerText || "",
        reviewer: card.querySelector(".reviewer-name")?.innerText || "",
        rating: card.querySelector(".review-rating")?.innerText || ""
      }));
    });

    reviews.push(...pageReviews);

    hasNext = await page.$(".pagination .next") !== null;
    if (hasNext) await Promise.all([
      page.click(".pagination .next"),
      page.waitForNavigation({ waitUntil: "networkidle2" })
    ]);
  }

  await browser.close();
  return filterByDate(reviews, startDate, endDate);
}
