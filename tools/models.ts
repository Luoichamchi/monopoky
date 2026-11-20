// Compress the game's glTF models after exporting them from Blender:  npm run models [files…]
// Meshopt: vertices are quantized (positions 14 bit) and packed; three.js decodes them with MeshoptDecoder.
// Node names and hierarchy are kept, so the game still finds cell_<n>, stable_<n>_glow, hub_flag, horse_spirit…
// Already compressed files are skipped, so it is safe to run after every export.
import { globSync, statSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : globSync('public/models/{,avatars/}*.glb');

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const kb = (f: string) => `${Math.round(statSync(f).size / 1024)}KB`;

for (const file of files) {
  const doc = await io.read(file);
  if (doc.getRoot().listExtensionsUsed().some(e => e.extensionName === 'EXT_meshopt_compression')) {
    console.log(`${file}: already compressed (${kb(file)})`);
    continue;
  }
  const before = kb(file);
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(file, doc);
  console.log(`${file}: ${before} → ${kb(file)}`);
}
