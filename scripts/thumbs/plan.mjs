// Print the thumbnail job list (JSON) from the compiled server. Usage: node scripts/thumbs/plan.mjs > plan.json
import { buildThumbManifest } from '../../server/dist/thumbs.js';
process.stdout.write(JSON.stringify(buildThumbManifest(), null, 1));
