require("dotenv").config({ path: ".env.local" });

const GHL_ACCESS_TOKEN = process.env.GHL_ACCESS_TOKEN;
const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";

async function fetchGHLStaffUser(ghlUserId) {
  const headers = {
    Authorization: `Bearer ${GHL_ACCESS_TOKEN}`,
    Version: GHL_API_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const res = await fetch(`${GHL_API_BASE}/users/${ghlUserId}`, { headers });
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Data:", data.firstName ? "FOUND" : "NOT FOUND");
}

fetchGHLStaffUser("8Nksbc1UOohEq0R3nhps");
