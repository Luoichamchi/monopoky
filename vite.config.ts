import { defineConfig } from 'vite';

// `npm run dev` (client, :5173) + `npm run dev:server` (game server, :3000)
export default defineConfig({
  // host: true so friends on the same Wi-Fi can open the dev server via the LAN IP
  server: { host: true, proxy: { '/socket.io': { target: 'http://localhost:3000', ws: true }, '/lan': 'http://localhost:3000' } },
  // the 3D template chunk (three.js) is ~700 kB but only downloaded when a player picks 3D
  build: { chunkSizeWarningLimit: 800 },
});
