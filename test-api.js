// diagnose-api.js
// Complete diagnostic tool for Gemini API

import dotenv from "dotenv";
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyB24llqXXIPF-HzTWi6C8QM5ZDjvl9bads";

console.log("\n" + "=".repeat(70));
console.log("🔬 GEMINI API COMPREHENSIVE DIAGNOSTIC");
console.log("=".repeat(70) + "\n");

console.log("Step 1: Checking API Key");
console.log("-".repeat(70));
console.log(`API Key: ${API_KEY.substring(0, 15)}...${API_KEY.substring(API_KEY.length - 4)}`);
console.log(`Length: ${API_KEY.length} characters`);
console.log();

// Test 1: List all available models
console.log("Step 2: Listing Available Models");
console.log("-".repeat(70));

async function listModels() {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
    console.log("Fetching from API...\n");
    
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error("❌ API Error:", response.status, response.statusText);
      console.error("Response:", JSON.stringify(data, null, 2));
      
      if (response.status === 400) {
        console.log("\n⚠️  DIAGNOSIS: Invalid API Key");
        console.log("   - Your API key format is incorrect or expired");
        console.log("   - Generate a new key at: https://aistudio.google.com/app/apikey");
      } else if (response.status === 403) {
        console.log("\n⚠️  DIAGNOSIS: API Key Permission Issue");
        console.log("   - API key exists but doesn't have access");
        console.log("   - Check if billing is enabled");
        console.log("   - Verify API key restrictions");
      }
      return null;
    }

    if (!data.models || data.models.length === 0) {
      console.log("⚠️  No models found for this API key");
      return null;
    }

    console.log(`✅ Found ${data.models.length} models!\n`);
    
    // Filter models that support generateContent
    const contentModels = data.models.filter(m => 
      m.supportedGenerationMethods?.includes("generateContent")
    );

    console.log(`🎯 Models supporting generateContent: ${contentModels.length}\n`);
    
    contentModels.forEach((model, i) => {
      const modelId = model.name.replace("models/", "");
      console.log(`${i + 1}. ${modelId}`);
      console.log(`   Name: ${model.displayName || "N/A"}`);
      console.log(`   Methods: ${model.supportedGenerationMethods?.join(", ") || "N/A"}`);
      console.log();
    });

    return contentModels;
  } catch (error) {
    console.error("❌ Network Error:", error.message);
    console.log("\n⚠️  DIAGNOSIS: Connection Issue");
    console.log("   - Check your internet connection");
    console.log("   - Verify firewall settings");
    return null;
  }
}

// Test 2: Try generating content with available models
async function testGeneration(models) {
  if (!models || models.length === 0) {
    console.log("⏭️  Skipping generation test (no models available)\n");
    return;
  }

  console.log("\nStep 3: Testing Content Generation");
  console.log("-".repeat(70));

  for (const model of models.slice(0, 3)) { // Test first 3 models
    const modelId = model.name.replace("models/", "");
    console.log(`\nTesting: ${modelId}...`);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/${model.name}:generateContent?key=${API_KEY}`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: "Say 'Hello! API is working!'" }]
          }]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.log(`   ❌ Failed: ${data.error?.message || "Unknown error"}`);
        continue;
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log(`   ✅ Success!`);
      console.log(`   Response: ${text?.substring(0, 60)}...`);
      
      return { modelId, success: true };
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  return null;
}

// Test 3: Check API key permissions
async function checkPermissions() {
  console.log("\n\nStep 4: Checking API Key Permissions");
  console.log("-".repeat(70));

  try {
    // Try v1 endpoint
    const v1Response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${API_KEY}`
    );
    console.log(`v1 endpoint: ${v1Response.status} ${v1Response.ok ? "✅" : "❌"}`);

    // Try v1beta endpoint
    const betaResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
    );
    console.log(`v1beta endpoint: ${betaResponse.status} ${betaResponse.ok ? "✅" : "❌"}`);

  } catch (error) {
    console.log("❌ Permission check failed:", error.message);
  }
}

// Main execution
async function runDiagnostics() {
  const models = await listModels();
  await testGeneration(models);
  await checkPermissions();

  console.log("\n" + "=".repeat(70));
  console.log("📋 SUMMARY & RECOMMENDATIONS");
  console.log("=".repeat(70) + "\n");

  if (!models || models.length === 0) {
    console.log("❌ PROBLEM: No models accessible with this API key\n");
    console.log("🔧 SOLUTIONS:");
    console.log("   1. Generate a NEW API key:");
    console.log("      → https://aistudio.google.com/app/apikey");
    console.log("   2. Make sure you're signed in to the correct Google account");
    console.log("   3. Check if Gemini API is available in your region");
    console.log("   4. Verify your .env file has no extra spaces/quotes");
    console.log("\n   Example .env format:");
    console.log("   GEMINI_API_KEY=AIzaSyB24llqXXIPF-HzTWi6C8QM5ZDjvl9bads");
  } else {
    console.log("✅ API key is working!\n");
    console.log("📝 Use these model names in your solution.js:\n");
    console.log("const modelsToTry = [");
    models.slice(0, 5).forEach(m => {
      const modelId = m.name.replace("models/", "");
      console.log(`  "${modelId}",`);
    });
    console.log("];\n");
  }

  console.log("=".repeat(70) + "\n");
}

runDiagnostics().catch(console.error);