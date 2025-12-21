import express from 'express';
import cors from 'cors';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Example data
const quotes = [
    {
        id: 1,
        text: "The only way to do great work is to love what you do.",
        author: "Steve Jobs",
        book: "Stanford Commencement Address"
    },
    {
        id: 2,
        text: "It does not matter how slowly you go as long as you do not stop.",
        author: "Confucius",
        book: "Analects"
    }
];

app.get('/quotes', (req, res) => {
    console.log('GET /quotes accessed');
    res.json(quotes);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
