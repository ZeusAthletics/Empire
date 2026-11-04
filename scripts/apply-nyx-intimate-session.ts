import { applyNyxIntimateSessionSchema } from "./apply-schema";

async function main() {
  await applyNyxIntimateSessionSchema();
  console.log("Nyx intimate session migration applied.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
