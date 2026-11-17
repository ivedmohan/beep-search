import type { RawPost } from "@/lib/sources/types";

const INDIA_RE =
  /\b(india|bengaluru|bangalore|mumbai|pune|hyderabad|chennai|new delhi|delhi|gurgaon|gurugram|noida|kolkata|ahmedabad|kochi|cochin|jaipur|indore|chandigarh|coimbatore|thiruvananthapuram|trivandrum|bhubaneswar|lucknow|nagpur|vadodara|surat|mohali|faridabad|ghaziabad|visakhapatnam|vizag|mysuru|mysore|goa|ncr|karnataka|maharashtra|telangana|tamil nadu|haryana|uttar pradesh|gujarat|kerala|west bengal|rajasthan|madhya pradesh)\b/i;

const NON_INDIA_REMOTE_RE = /\b(us|usa|u\.s\.|united states|canada|uk|europe|emea|latam|apac(?! india)|australia|singapore|germany|philippines|pakistan|bangladesh)\b/i;

/** True when the post is for India (explicit), or remote with no non-India country hint. */
export function isIndiaPost(p: RawPost): boolean {
  if (p.country) return p.country.toUpperCase() === "IN";
  const loc = p.locationRaw;
  if (INDIA_RE.test(loc)) return true;
  if (/\bremote\b/i.test(loc) && !NON_INDIA_REMOTE_RE.test(loc)) {
    // Remote with no country: accept only if the description mentions India.
    return /\bindia\b|\bINR\b|₹|\bbengaluru\b|\bbangalore\b/i.test(p.description);
  }
  return false;
}
