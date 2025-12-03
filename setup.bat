@echo off
echo.
echo 🚀 Setting up AI-Powered Quiz Application...
echo.

REM Step 1: Update dependencies
echo 📦 Step 1: Updating dependencies...
call npm install @google/generative-ai@latest
echo ✅ Dependencies updated
echo.

REM Step 2: Check for .env file
echo 🔑 Step 2: Checking API key...
if not exist .env (
    echo ⚠️  .env file not found!
    echo Creating .env file...
    echo GEMINI_API_KEY=your_api_key_here > .env
    echo ❗ IMPORTANT: Edit .env and add your Gemini API key
    echo    Get it from: https://makersuite.google.com/app/apikey
) else (
    findstr /C:"your_api_key_here" .env >nul
    if %errorlevel%==0 (
        echo ⚠️  API key not configured in .env
        echo    Please edit .env and add your actual API key
    ) else (
        echo ✅ API key found in .env
    )
)
echo.

REM Step 3: Verify files
echo 📁 Step 3: Verifying file structure...
if exist solution.js (echo ✅ solution.js) else (echo ❌ solution.js NOT FOUND)
if exist package.json (echo ✅ package.json) else (echo ❌ package.json NOT FOUND)
if exist views\index.ejs (echo ✅ views\index.ejs) else (echo ❌ views\index.ejs NOT FOUND)
if exist dataset\basic\pythonquestions.csv (echo ✅ dataset\basic\pythonquestions.csv) else (echo ❌ CSV files NOT FOUND)
echo.

echo 🎯 Setup Complete!
echo.
echo Next steps:
echo 1. Make sure your .env has a valid GEMINI_API_KEY
echo 2. Run: npm start
echo 3. Visit: http://localhost:3000
echo.
echo 🔍 To verify API key is working, the server should show:
echo    'AI-Powered Quiz Mode: ENABLED'
echo.
echo 📚 Available models you can use:
echo    - gemini-1.5-flash (Fast, recommended)
echo    - gemini-1.5-pro (More capable)
echo.
echo Happy learning! 🚀
echo.
pause