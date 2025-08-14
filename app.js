import express from "express";
import g2Scraper from "./scraper/g2Scrapper.js";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
// import capterraScraper from "./scraper/capterraScraper.js";
// import getAppScraper from "./scraper/getAppScraper.js";
import saveToFile from "./utils/saveToFile.js";

const app = express();
app.use(express.json());
puppeteer.use(StealthPlugin());
const browser = await puppeteer.launch({ headless:  false});


app.post("/scrape", async (req, res) => {
  try {
    const { companyName, startDate, endDate, source } = req.body;

    if (!companyName || !startDate || !endDate || !source) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    let reviews = [];
    if (source.toLowerCase() === "g2") {
      reviews = await g2Scraper(companyName, startDate, endDate, browser);
      console.log("reviewes", reviews)
    } 
    // else if (source.toLowerCase() === "capterra") {
    //   reviews = await capterraScraper(companyName, startDate, endDate);
    // } 
    // else if (source.toLowerCase() === "getapp") {
    //   reviews = await getAppScraper(companyName, startDate, endDate);
    // } 
    else {
      return res.status(400).json({ error: "Invalid source" });
    }

    const filePath = saveToFile(companyName, reviews);
    res.json({ message: "Scraping complete", file: filePath, reviewsCount: reviews.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
