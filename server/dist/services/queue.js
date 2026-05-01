"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backgroundQueue = void 0;
const p_queue_1 = __importDefault(require("p-queue"));
// We limit concurrency to 2 to avoid hammering external APIs (Inventaire, Wikipedia)
exports.backgroundQueue = new p_queue_1.default({ concurrency: 2 });
exports.backgroundQueue.on('active', () => {
    console.log(`[Queue] Task started. Size: ${exports.backgroundQueue.size}  Pending: ${exports.backgroundQueue.pending}`);
});
exports.backgroundQueue.on('completed', () => {
    console.log(`[Queue] Task completed. Size: ${exports.backgroundQueue.size}  Pending: ${exports.backgroundQueue.pending}`);
});
exports.backgroundQueue.on('error', error => {
    console.error('[Queue] Task error:', error);
});
