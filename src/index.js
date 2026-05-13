import 'dotenv/config';

async function main() {
  await import('./server.js');
  await import('./workers/playerTracker.js');
  console.log('🚀 Server + Worker birlikte başlatıldı');
}

main().catch(console.error);