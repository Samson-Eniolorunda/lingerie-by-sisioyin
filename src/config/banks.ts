/**
 * Nigerian banks the owner can choose from for the bank transfer details (Admin, Settings,
 * Payments). The stored value is the plain name. Microfinance and digital banks are included
 * because many small shops bank with them. If the shop's bank is missing, add its name here.
 */
export const NIGERIAN_BANKS = [
  "Access Bank",
  "Citibank Nigeria",
  "Ecobank Nigeria",
  "Fidelity Bank",
  "First Bank of Nigeria",
  "First City Monument Bank (FCMB)",
  "Globus Bank",
  "Guaranty Trust Bank (GTBank)",
  "Heritage Bank",
  "Keystone Bank",
  "Kuda Microfinance Bank",
  "Lotus Bank",
  "Moniepoint Microfinance Bank",
  "Opay (Paycom)",
  "Optimus Bank",
  "PalmPay",
  "Parallex Bank",
  "Polaris Bank",
  "Premium Trust Bank",
  "Providus Bank",
  "Stanbic IBTC Bank",
  "Standard Chartered Bank",
  "Sterling Bank",
  "SunTrust Bank",
  "Titan Trust Bank",
  "Union Bank of Nigeria",
  "United Bank for Africa (UBA)",
  "Unity Bank",
  "VFD Microfinance Bank",
  "Wema Bank",
  "Zenith Bank",
] as const;

export function isKnownBank(name: string): boolean {
  return (NIGERIAN_BANKS as readonly string[]).includes(name);
}
