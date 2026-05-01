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
const externalAuthor_1 = require("./services/externalAuthor");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log("Starting search for 'Victor Hugo'...");
            const results = yield (0, externalAuthor_1.searchExternalAuthors)("Victor Hugo");
            console.log("Results:", JSON.stringify(results, null, 2));
        }
        catch (e) {
            console.error("Error:", e);
        }
    });
}
main();
