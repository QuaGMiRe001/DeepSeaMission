export function contractSummary(contract) {
  const mod = contract.modifier ? ` + ${contract.modifier.label}` : '';
  return `[${contract.aoiType}] ${contract.title}${mod} • risk ${contract.risk} • $${contract.pay}`;
}
