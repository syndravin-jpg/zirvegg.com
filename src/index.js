import 'dotenv/config';

// Server'ı başlat
import('./server.js').then(() => {
  // Worker'ı başlat
  import('./workers/playerTracker.js');
  console.log('Server + Worker baslatildi');
}).catch(console.error);