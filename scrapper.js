// routes/g2Reviews.js
import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs'
import { capterraScraper, g2Scrapper, saveReviews } from './util.js';
dotenv.config();
const router = express.Router();

//POST
router.post("/reviews", async (req, res) => {
    const { companySlug, page = 1, source } = req.body;
    let reviews;

    if (!companySlug) {
        return res.status(400).json({ error: "Company slug is required" });
    }

    try {
        if (source === "g2") {
            reviews=await g2Scrapper(companySlug,page);
        } 
        else if(source==="capterra"){
            reviews=await capterraScraper(companySlug,page);
        }
        else {
            return res.status(400).json({ error: "Unsupported source" });
        }
        saveReviews(reviews, companySlug);
        return res.json({ count: reviews.length, reviews, companySlug:companySlug });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});

export default router;
