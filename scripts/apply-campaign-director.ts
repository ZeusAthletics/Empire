import { applyCampaignDirectorSchema } from "./apply-schema";

async function main() {
  await applyCampaignDirectorSchema();
  console.log("Campaign Director migration applied.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
