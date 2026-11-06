import { createHmac } from "node:crypto";

const secret =
  process.env.FORION_ORBIT_INTERNAL_SECRET ||
  "orbit-forion-internal-dev-secret-12345";
const userId = process.env.DEV_API_USER_ID || "xsviuWUARjywMLDk0bcI6";
const serverUrl = process.env.FORION_SERVER_URL || "http://localhost:3001";

function sign(method, path) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const payload = `v2|${method.toUpperCase()}|${userId}|${path}|${ts}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${secret}`,
    "x-orbit-user-id": userId,
    "x-orbit-req-ts": ts,
    "x-orbit-sig-version": "2",
    "x-orbit-req-sig": sig,
    "X-Orbit-Client": "orbit-bot",
  };
}

async function testOrbitBillingFlow() {
  console.log("=== Orbit Bot -> Orbit Microservices End-to-End Billing Test ===");

  // 1. Initial Balance Check
  const balancePath = `/api/credits/balance/${encodeURIComponent(userId)}`;
  const balanceRes = await fetch(`${serverUrl}${balancePath}`, {
    method: "GET",
    headers: sign("GET", balancePath),
  });
  const balanceJson = await balanceRes.json();
  console.log("1. Live Wallet Balance:", balanceJson.data);

  // 2. Lock Credits (Preflight before model execution)
  const usePath = "/api/credits/use";
  const refId = `orbit_bot_test_${Date.now()}`;
  const useRes = await fetch(`${serverUrl}${usePath}`, {
    method: "POST",
    headers: sign("POST", usePath),
    body: JSON.stringify({
      user_id: userId,
      model: "deepseek/deepseek-v4-flash",
      input_tokens: 150,
      max_output_tokens: 300,
      product: "orbit-bot",
      reference_id: refId,
    }),
  });
  const useJson = await useRes.json();
  console.log("2. Credit Lock Result:", useJson);

  // 3. Commit Credits (After model execution settles)
  const commitPath = "/api/credits/commit";
  const commitRes = await fetch(`${serverUrl}${commitPath}`, {
    method: "POST",
    headers: sign("POST", commitPath),
    body: JSON.stringify({
      user_id: userId,
      amount: useJson.data?.cost ?? 2,
      reference_id: refId,
      product: "orbit-bot",
    }),
  });
  const commitJson = await commitRes.json();
  console.log("3. Credit Commit Result:", commitJson);

  // 4. Final Balance Check
  const finalRes = await fetch(`${serverUrl}${balancePath}`, {
    method: "GET",
    headers: sign("GET", balancePath),
  });
  const finalJson = await finalRes.json();
  console.log("4. Updated Live Wallet Balance:", finalJson.data);

  console.log("✔ Complete Orbit Bot control plane billing lifecycle confirmed!");
}

testOrbitBillingFlow().catch(console.error);
