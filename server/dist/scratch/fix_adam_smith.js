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
const prisma_1 = require("../lib/prisma");
const inventaire_1 = require("../services/inventaire");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const author = yield prisma_1.prisma.author.findUnique({
            where: { name: 'Adam smith' }
        });
        if (!author) {
            console.log('Author "Adam smith" not found in database.');
            return;
        }
        console.log(`Found author ID: ${author.id}. Current URI: ${author.inventaireUri}`);
        // The economist URI
        const correctUri = 'wd:Q9381';
        // FORCE CLEAR description to bypass the guard in enrichment service
        console.log('Clearing current incorrect description to force refresh...');
        yield prisma_1.prisma.author.update({
            where: { id: author.id },
            data: { description: null } // Setting to null ensures length < 50 check passes
        });
        console.log(`Triggering re-enrichment with correct URI: ${correctUri}...`);
        const result = yield (0, inventaire_1.enrichAuthorWithInventaire)(author.id, author.name, correctUri);
        if (result) {
            console.log('Successfully re-enriched author!');
            console.log('New Description:', ((_a = result.description) === null || _a === void 0 ? void 0 : _a.substring(0, 200)) + '...');
            console.log('New URI:', result.inventaireUri);
        }
        else {
            console.log('Failed to re-enrich author.');
        }
    });
}
main().finally(() => prisma_1.prisma.$disconnect());
