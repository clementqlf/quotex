"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const seedData_1 = require("./src/seedData");
const prisma = new client_1.PrismaClient();
function forceSeed() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Clearing existing data...');
        // Delete in order to satisfy foreign key constraints
        yield prisma.like.deleteMany();
        yield prisma.review.deleteMany();
        yield prisma.quote.deleteMany();
        yield prisma.book.deleteMany();
        yield prisma.author.deleteMany();
        yield prisma.user.deleteMany();
        console.log('Running seed...');
        yield (0, seedData_1.seed)();
        console.log('Verification:');
        const authors = yield prisma.author.findMany();
        authors.forEach(a => {
            console.log(`- ${a.name}: ${a.birthDate}`);
        });
        yield prisma.$disconnect();
    });
}
forceSeed();
