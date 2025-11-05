export const COUNTRY_NAME_TO_ISO2: Record<string, string> = {
  Afghanistan: "AF",
  Albania: "AL",
  Argentina: "AR",
  Australia: "AU",
  Austria: "AT",
  Bahrain: "BH",
  Belgium: "BE",
  "Bosnia and Herzegovina": "BA",
  Brazil: "BR",
  Canada: "CA",
  "Cayman Islands": "KY",
  Chile: "CL",
  China: "CN",
  "China / Hong Kong": "HK",
  "Greater China": "CN",
  Colombia: "CO",
  Croatia: "HR",
  "Czech Republic": "CZ",
  Denmark: "DK",
  Egypt: "EG",
  "El Salvador": "SV",
  Estonia: "EE",
  Finland: "FI",
  France: "FR",
  Germany: "DE",
  Greece: "GR",
  "Hong Kong": "HK",
  Hungary: "HU",
  India: "IN",
  Indonesia: "ID",
  Ireland: "IE",
  Israel: "IL",
  Italy: "IT",
  Japan: "JP",
  Latvia: "LV",
  Lithuania: "LT",
  Luxembourg: "LU",
  Malaysia: "MY",
  Mexico: "MX",
  Netherlands: "NL",
  "New Zealand": "NZ",
  Nigeria: "NG",
  Norway: "NO",
  Oman: "OM",
  "Philippines": "PH",
  Poland: "PL",
  Portugal: "PT",
  Qatar: "QA",
  Romania: "RO",
  Russia: "RU",
  "Saudi Arabia": "SA",
  Singapore: "SG",
  "South Africa": "ZA",
  "South Korea": "KR",
  "Republic of Korea": "KR",
  Spain: "ES",
  Sweden: "SE",
  Switzerland: "CH",
  Taiwan: "TW",
  Thailand: "TH",
  Turkey: "TR",
  "United Arab Emirates": "AE",
  "United Kingdom": "GB",
  "United States": "US",
  Vietnam: "VN",
  "Hong Kong SAR": "HK",
  "Mainland China": "CN",
  "United States of America": "US",
  "Great Britain": "GB",
  England: "GB",
  Scotland: "GB",
  Wales: "GB",
  "Northern Ireland": "GB",
};

export function resolveIsoCode(countryName: string | null | undefined): string | null {
  if (!countryName) return null;
  const trimmed = countryName.trim();
  if (!trimmed) return null;

  const direct = COUNTRY_NAME_TO_ISO2[trimmed];
  if (direct) return direct;

  // Handle common aliases manually (e.g., "UK" vs "United Kingdom")
  const lowered = trimmed.toLowerCase();
  if (lowered === "usa" || lowered === "u.s.a." || lowered === "united states of america") {
    return "US";
  }
  if (lowered === "u.k." || lowered === "uk" || lowered === "great britain" || lowered === "england") {
    return "GB";
  }
  if (lowered === "peoples republic of china" || lowered === "people's republic of china" || lowered === "prc") {
    return "CN";
  }
  if (lowered === "korea" || lowered === "republic of korea") {
    return "KR";
  }
  if (lowered === "u.a.e." || lowered === "uae") {
    return "AE";
  }

  return null;
}
