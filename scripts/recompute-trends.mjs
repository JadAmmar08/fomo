const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const response = await fetch(`${baseUrl}/api/trends/recompute`, {
  method: "POST"
});

if (!response.ok) {
  console.error("Trend recompute failed");
  process.exit(1);
}

const data = await response.json();
console.log(`Trend recompute completed at ${data.generatedAt}`);
