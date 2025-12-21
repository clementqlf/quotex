"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
const port = 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
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
