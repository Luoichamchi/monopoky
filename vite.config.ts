import { defineConfig } from 'vite';

// `npm run dev` (client, :5173) + `npm run dev:server` (game server, :3000)
export default defineConfig({
  server: { proxy: { '/socket.io': { target: 'http://localhost:3000', ws: true } } },
  // the 3D template chunk (three.js) is ~700 kB but only downloaded when a player picks 3D
  build: { chunkSizeWarningLimit: 800 },
});
