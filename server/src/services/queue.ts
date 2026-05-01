import PQueue from 'p-queue';

// We limit concurrency to 2 to avoid hammering external APIs (Inventaire, Wikipedia)
export const backgroundQueue = new PQueue({ concurrency: 2 });

backgroundQueue.on('active', () => {
    console.log(`[Queue] Task started. Size: ${backgroundQueue.size}  Pending: ${backgroundQueue.pending}`);
});

backgroundQueue.on('completed', () => {
    console.log(`[Queue] Task completed. Size: ${backgroundQueue.size}  Pending: ${backgroundQueue.pending}`);
});

backgroundQueue.on('error', error => {
    console.error('[Queue] Task error:', error);
});
