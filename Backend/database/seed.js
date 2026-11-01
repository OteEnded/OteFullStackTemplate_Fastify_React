// Seed data — run by hand, never at server boot.
//
//   npm run db:seed                 add the demo rows that are missing (safe to re-run)
//   npm run db:reset-demo           reset the DEMO table to exactly the seed rows
//   node database/seed.js --config <file> [--reset]
//
// Add your own seeds to SEEDS below (one module per table, in database/seeds/).

import { loadConfig } from "../lib/utility.js";
import { initDB } from "./index.js";
import seedTemplateItems from "./seeds/seed_template_items.js"; // @demo

const SEEDS = [
    seedTemplateItems, // @demo
];

const args = process.argv.slice(2);
const configPath = args.includes("--config") ? args[args.indexOf("--config") + 1] : undefined;
const reset = args.includes("--reset");

let db;
let exitCode = 0;
try {
    loadConfig(configPath);
    db = await initDB();
    for (const seed of SEEDS) await seed(db, { forceSync: reset });
    console.log(reset ? "Demo data reset to the seed rows." : "Seed rows ensured.");
} catch (err) {
    console.error(`db:seed FAILED: ${err.message}`);
    exitCode = 1;
} finally {
    await db?.sequelize.close().catch(() => {});
}
process.exit(exitCode);
