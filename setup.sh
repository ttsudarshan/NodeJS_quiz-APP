#!/bin/bash

echo "🚀 Setting up AI-Powered Quiz Application..."
echo ""

# Step 1: Update package.json
echo "📦 Step 1: Updating dependencies..."
npm install @google/generative-ai@latest
echo "✅ Dependencies updated"
echo ""

# Step 2: Check for .env file
echo "🔑 Step 2: Checking API key..."
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Creating .env file..."
    echo "GEMINI_API_KEY=your_api_key_here" > .env
    echo "❗ IMPORTANT: Edit .env and add your Gemini API key"
    echo "   Get it from: https://makersuite.google.com/app/apikey"
else
    if grep -q "your_api_key_here" .env || grep -q "your_gemini_api_key_here" .env; then
        echo "⚠️  API key not configured in .env"
        echo "   Please edit .env and add your actual API key"
    else
        echo "✅ API key found in .env"
    fi
fi
echo ""

# Step 3: Verify file structure
echo "📁 Step 3: Verifying file structure..."
files=("solution.js" "package.json" "views/index.ejs" "dataset/basic/pythonquestions.csv")
all_good=true

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file NOT FOUND"
        all_good=false
    fi
done
echo ""

# Step 4: Show next steps
echo "🎯 Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Make sure your .env has a valid GEMINI_API_KEY"
echo "2. Run: npm start"
echo "3. Visit: http://localhost:3000"
echo ""
echo "🔍 To verify API key is working, the server should show:"
echo "   'AI-Powered Quiz Mode: ENABLED'"
echo ""
echo "📚 Available models you can use:"
echo "   - gemini-1.5-flash (Fast, recommended)"
echo "   - gemini-1.5-pro (More capable)"
echo ""
echo "Happy learning! 🚀"