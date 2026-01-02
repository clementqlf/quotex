"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const seedData_1 = require("./seedData");
(0, seedData_1.seed)()
    .then(() => {
    console.log('Seed executed successfully');
    process.exit(0);
})
    .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
});
