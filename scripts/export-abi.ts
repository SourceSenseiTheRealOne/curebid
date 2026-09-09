import { readFile, mkdir, writeFile } from "node:fs/promises";
await mkdir("apps/web/lib", { recursive: true });
for (const name of ["CureMarket", "CureRouter", "AttestcoinVerifier"]) {
  const artifact = JSON.parse(
    await readFile(`out/${name}.sol/${name}.json`, "utf8"),
  );
  await writeFile(
    `apps/web/lib/${name}.json`,
    JSON.stringify(artifact.abi, null, 2) + "\n",
  );
}
