require("dotenv").config({ path: ".env.local" });

const GHL_ACCESS_TOKEN = process.env.GHL_ACCESS_TOKEN;
const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";

async function testToken() {
  const headers = {
    Authorization: `Bearer ${GHL_ACCESS_TOKEN}`,
    Version: GHL_API_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  try {
    const res = await fetch(`${GHL_API_BASE}/users/search`, { headers });
    console.log("Users search status:", res.status);
    const data = await res.json();
    console.log("Users search result:", JSON.stringify(data).substring(0, 200));
  } catch (e) {
    console.log("Error:", e);
  }
}

testToken();
