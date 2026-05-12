const PUUID = 'JlD2W8BSvsV89DASEmLHORVqfAoxg2stn5fn1nSF7ubxd7-fDuYBXm17ve2Uif-xYouhmdmprJ7A9A';

const API_KEYS = [
  'RGAPI-e8171cc4-3df0-4ea9-8b97-c250e30599fd',
  'RGAPI-7ef87cff-062d-4cbd-a009-05fd84de7b2e',
  'RGAPI-4fa83d3f-01d2-43f9-8e7b-5f2efcdab2f7',
  'RGAPI-32107afb-6e90-4d33-b30c-4a6b8d43f8e2',
  'RGAPI-c3c15532-9fa3-4d1b-acbd-2dd2ba74ab5f',
  'RGAPI-ca393042-5bde-489b-bae4-41b813ab8445',
  'RGAPI-8f7d8ccb-0aff-45c5-bdd5-9272de6231df',
  'RGAPI-3e815384-d9a3-4603-8b81-ee52c3c5fcdb',
  'RGAPI-abc6e1c3-dc3f-43de-8e16-ec47b32fa084',
  'RGAPI-c19c77f3-3ee1-44bd-a12e-8e4d1722f8ca',
  'RGAPI-7a70cbd9-d95b-4173-9438-da59c57d2f17',
  'RGAPI-598531a9-f6fe-4f47-8ba6-b32d6b52ecfd',
  'RGAPI-226a992a-9dd4-4e06-9309-104c09166842',
  'RGAPI-c5ff684b-d274-414d-be31-e72b6af4485a',
  'RGAPI-7d748cef-9445-45a3-9c9d-a241e3d770e2',
  'RGAPI-7065cb99-d72e-4a9b-8f9d-9bf8b5fe78b4',
];

async function testKey(key, index) {
  const url = `https://tr1.api.riotgames.com/lol/league/v4/entries/by-puuid/${PUUID}?api_key=${key}`;
  const res = await fetch(url);
  const body = await res.text();
  console.log(`Key ${index + 1}: status ${res.status} → ${body.substring(0, 80)}`);
}

(async () => {
  for (let i = 0; i < API_KEYS.length; i++) {
    await testKey(API_KEYS[i], i);
    await new Promise(r => setTimeout(r, 100));
  }
})();