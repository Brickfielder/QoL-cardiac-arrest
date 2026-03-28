import "dotenv/config";

import { syncRepositorySeed } from "../src/lib/server/seed";

async function main() {
  const snapshot = await syncRepositorySeed();
  console.log("Seeded repository snapshot.");
  console.log(JSON.stringify(snapshot.counts, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
