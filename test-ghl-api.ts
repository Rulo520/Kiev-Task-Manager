import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testGHL() {
  const GHL_ACCESS_TOKEN = process.env.GHL_ACCESS_TOKEN;
  const GHL_COMPANY_ID = process.env.GHL_COMPANY_ID;

  console.log("Token exists:", !!GHL_ACCESS_TOKEN);
  console.log("Company ID exists:", !!GHL_COMPANY_ID);

  if (!GHL_ACCESS_TOKEN || !GHL_COMPANY_ID) {
    console.log("Missing env vars");
    return;
  }

  const url = new URL("https://services.leadconnectorhq.com/users/search");
  url.searchParams.append("companyId", GHL_COMPANY_ID);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${GHL_ACCESS_TOKEN}`,
        "Version": "2021-07-28",
        "Accept": "application/json"
      },
    });

    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Data:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

testGHL();
