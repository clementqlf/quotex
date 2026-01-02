
import { seed } from './seedData';

seed()
    .then(() => {
        console.log('Seed executed successfully');
        process.exit(0);
    })
    .catch((e) => {
        console.error('Seed failed:', e);
        process.exit(1);
    });
