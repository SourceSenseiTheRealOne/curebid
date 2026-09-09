export function parseAssetAmount(input: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 77)
    throw new Error("Invalid decimals");
  if (input.length > 80 || !/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(input))
    throw new Error("Use a plain decimal amount");
  const [whole = "0", fraction = ""] = input.split(".");
  if (fraction.length > decimals) throw new Error("Too many decimal places");
  const amount =
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0") || "0");
  if (amount >= 2n ** 256n) throw new Error("Amount exceeds uint256");
  return amount;
}
