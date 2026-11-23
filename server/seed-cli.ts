import { seedInitialData } from './seed.js';

console.log('🌱 Starting manual seeding of demo data...');
try {
  seedInitialData();
  console.log('🎉 Seeding completed successfully!');
  process.exit(0);
} catch (err) {
  console.error('❌ Error during seeding:', err);
  process.exit(1);
}
