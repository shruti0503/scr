import express from 'express';
import g2ReviewsRoute from './scrapper.js';
import dotenv from 'dotenv';

dotenv.config();
const app = express();

app.use(express.json());

app.use('/api', g2ReviewsRoute);

app.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});
