// solution.js

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

// --------- Path setup ---------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------- Express setup ---------
const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// --------- Gemini AI state ---------
let genAI = null;
let model = null;
let aiEnabled = false;
let workingModelName = null;

// --------- Simple in-memory sessions ---------
const userSessions = new Map();

// Session middleware
app.use((req, res, next) => {
  // Check multiple places for session ID
  if (!req.headers["user-session-id"]) {
    // Try to get from body (for POST requests)
    if (req.body && req.body.sessionId) {
      req.sessionId = req.body.sessionId;
    } else {
      // Generate new session
      req.sessionId = `session_${Date.now()}_${Math.random()}`;
    }
  } else {
    req.sessionId = req.headers["user-session-id"];
  }

  if (!userSessions.has(req.sessionId)) {
    console.log(`📝 Creating new session: ${req.sessionId}`);
    userSessions.set(req.sessionId, {
      currentLevel: "basic",
      correctStreak: 0,
      incorrectStreak: 0,
      totalCorrect: 0,
      totalQuestions: 0,
      topic: "",
      questionHistory: [],
      currentQuestion: null
    });
  }

  // Make session ID available to templates
  res.locals.sessionId = req.sessionId;
  next();
});

// --------- Gemini initialization ---------
async function initializeGeminiAI() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("❌ GEMINI_API_KEY not found in .env file");
      console.log("📝 Create .env with: GEMINI_API_KEY=your_actual_key");
      console.log("🔑 Get your key from: https://aistudio.google.com/app/apikey");
      return false;
    }

    if (
      apiKey === "your_api_key_here" ||
      apiKey === "your_gemini_api_key_here" ||
      apiKey.trim() === ""
    ) {
      console.error("❌ API key not configured (using placeholder)");
      return false;
    }

    genAI = new GoogleGenerativeAI(apiKey);

    // Fetch available models from API
    console.log("🔍 Fetching available models from API...");
    
    let modelsToTry = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-pro-latest",
      "gemini-flash-latest"
    ];

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      const data = await response.json();
      
      if (data.models) {
        const availableModels = data.models
          .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
          .map(m => m.name.replace("models/", ""));
        
        if (availableModels.length > 0) {
          modelsToTry = availableModels.slice(0, 5); // Use first 5 available models
          console.log(`✅ Found ${availableModels.length} available models`);
        }
      }
    } catch (err) {
      console.log("⚠️  Couldn't fetch model list, using defaults");
    }

    console.log("🔍 Testing models...");

    for (const modelName of modelsToTry) {
      try {
        console.log(`   Trying ${modelName}...`);
        const testModel = genAI.getGenerativeModel({ model: modelName });
        const result = await testModel.generateContent("ping");
        await result.response;
        model = testModel;
        workingModelName = modelName;
        aiEnabled = true;
        console.log(`✅ Successfully connected using model: ${modelName}`);
        return true;
      } catch (error) {
        console.log(`   ❌ ${modelName} failed: ${error.message.substring(0, 100)}...`);
      }
    }

    console.error("❌ No working Gemini models found");
    console.log("💡 Check https://ai.google.dev/gemini-api/docs/models for valid model IDs");
    return false;
  } catch (error) {
    console.error("❌ Failed to initialize Gemini AI:", error.message);
    return false;
  }
}

await initializeGeminiAI();

// --------- Views ---------
app.get("/", (req, res) => {
  if (!aiEnabled) {
    return res.status(503).render("error", {
      message: "AI Service Unavailable",
      details: "Please configure a valid GEMINI_API_KEY in your .env file"
    });
  }
  res.render("main.ejs");
});

app.get("/basic", (req, res) => res.render("basic.ejs"));
app.get("/medium", (req, res) => res.render("medium.ejs"));
app.get("/hard", (req, res) => res.render("hard.ejs"));

// --------- AI question generation ---------
async function generateAIQuestion(topic, level, previousQuestions = []) {
  if (!aiEnabled || !model) {
    throw new Error("AI not enabled. Check API key configuration.");
  }

  const difficultyDescriptions = {
    basic: "beginner-friendly, covering fundamental concepts and basic syntax",
    medium: "intermediate level, focusing on practical applications and problem-solving",
    hard: "advanced level, covering complex scenarios, optimization, and edge cases"
  };

  const topicMap = {
    c: "C Programming",
    python: "Python",
    javascript: "JavaScript",
    cplus: "C++",
    css: "CSS",
    html: "HTML",
    nodejs: "Node.js",
    sql: "SQL",
    java: "Java",
    numpy: "NumPy",
    pandas: "Pandas"
  };

  const fullTopicName = topicMap[topic] || topic;
  const previousContext =
    previousQuestions.length > 0
      ? `\n\nAvoid these topics already covered: ${previousQuestions
          .slice(-5)
          .map((q) => q.question.substring(0, 50))
          .join("; ")}`
      : "";

  const prompt = `Generate a ${difficultyDescriptions[level]} multiple-choice quiz question about ${fullTopicName}.

Requirements:
- Create ONE question appropriate for ${level} level
- Provide exactly 4 options labeled A, B, C, D
- Include the correct answer (A, B, C, or D)
- Provide a detailed explanation for why the answer is correct
- Make the question unique and interesting${previousContext}

IMPORTANT: Return ONLY valid JSON, no markdown code blocks, no extra text.

JSON format:
{
  "question": "Your question text here",
  "options": {
    "A": "First option",
    "B": "Second option",
    "C": "Third option",
    "D": "Fourth option"
  },
  "correctAnswer": "A",
  "explanation": "Detailed explanation here",
  "difficulty": "${level}"
}`;

  console.log(`🤖 Generating AI question: ${fullTopicName} (${level})...`);

  const result = await model.generateContent(prompt);
  const response = await result.response;
  let text = response.text();

  // Clean up markdown code blocks if present
  let jsonText = text.trim();
  jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  const questionData = JSON.parse(jsonText);

  console.log(
    `✅ Generated: "${questionData.question.substring(0, 60)}..."`
  );

  return {
    question: questionData.question,
    options: questionData.options,
    answer: questionData.correctAnswer,
    explanation: questionData.explanation,
    difficulty: level,
    topic: fullTopicName,
    aiGenerated: true
  };
}

// --------- AI hint generation ---------
async function generateHint(question, difficulty, hintNumber) {
  if (!aiEnabled || !model) {
    return "AI hints unavailable. Please check your API key configuration.";
  }

  const hintLevel = hintNumber === 1 ? "subtle" : "more direct";

  const prompt = `For this quiz question, provide a ${hintLevel} hint that helps guide toward the answer without giving it away directly.

Question: ${question.question}
Options: ${JSON.stringify(question.options)}
Difficulty: ${difficulty}

Hint ${hintNumber} should be ${hintLevel} and educational. Return ONLY the hint text, nothing else.`;

  console.log(`💡 Generating hint ${hintNumber}...`);

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const hint = response.text().trim();
    console.log("✅ Hint generated successfully");
    return hint;
  } catch (error) {
    console.error("❌ Error generating hint:", error.message);
    return "Hint unavailable at the moment. Please try again.";
  }
}

// --------- AI answer validation ---------
async function validateAnswer(userAnswer, correctAnswer, question) {
  try {
    const prompt = `Determine if the user's answer is correct for this quiz question.

Question: ${question.question}
Correct Answer: ${correctAnswer}
User's Answer: ${userAnswer}

Consider:
- Exact matches
- Semantically equivalent answers
- Common abbreviations
- Minor typos or spelling variations

Respond with ONLY "CORRECT" or "INCORRECT" followed by a brief explanation.
Format: CORRECT|explanation or INCORRECT|explanation`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    const upper = text.toUpperCase();
    const isCorrect = upper.startsWith("CORRECT");
    const explanation = text.split("|")[1] || "";

    return { isCorrect, explanation };
  } catch (error) {
    console.error("Error validating answer:", error);
    // Fallback to simple comparison
    return {
      isCorrect:
        userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim(),
      explanation: "Standard comparison used."
    };
  }
}

// --------- Adaptive difficulty ---------
function adjustDifficulty(session) {
  const currentLevel = session.currentLevel;

  // Level up on 3 correct in a row
  if (session.correctStreak >= 3 && currentLevel === "basic") {
    session.currentLevel = "medium";
    session.correctStreak = 0;
    session.incorrectStreak = 0;
    return { changed: true, newLevel: "medium", direction: "up" };
  } else if (session.correctStreak >= 3 && currentLevel === "medium") {
    session.currentLevel = "hard";
    session.correctStreak = 0;
    session.incorrectStreak = 0;
    return { changed: true, newLevel: "hard", direction: "up" };
  }

  // Level down on 2 incorrect in a row
  if (session.incorrectStreak >= 2 && currentLevel === "hard") {
    session.currentLevel = "medium";
    session.correctStreak = 0;
    session.incorrectStreak = 0;
    return { changed: true, newLevel: "medium", direction: "down" };
  } else if (session.incorrectStreak >= 2 && currentLevel === "medium") {
    session.currentLevel = "basic";
    session.correctStreak = 0;
    session.incorrectStreak = 0;
    return { changed: true, newLevel: "basic", direction: "down" };
  }

  return { changed: false };
}

// --------- AI-powered quiz handler ---------
async function handleAIQuiz(sessionId, topic, res, manualLevel = null) {
  const session = userSessions.get(sessionId);
  session.topic = topic;

  if (manualLevel) {
    session.currentLevel = manualLevel;
  }

  if (!aiEnabled || !model) {
    return res.status(503).render("error", {
      message: "AI Service Unavailable",
      details: "Please check your GEMINI_API_KEY configuration"
    });
  }

  try {
    console.log(`🎯 Generating ${session.currentLevel} question for ${topic}...`);

    const question = await generateAIQuestion(
      topic,
      session.currentLevel,
      session.questionHistory
    );

    session.questionHistory.push(question);
    session.currentQuestion = question;

    console.log("✅ Question ready for user");

    res.render("index.ejs", {
      question: question,
      sessionId: sessionId,
      currentLevel: session.currentLevel,
      stats: {
        correct: session.totalCorrect,
        total: session.totalQuestions,
        streak: session.correctStreak
      },
      aiMode: true
    });
  } catch (error) {
    console.error("❌ AI generation failed:", error.message);
    res.status(500).render("error", {
      message: "Failed to Generate Question",
      details: error.message
    });
  }
}

// --------- Quiz routes ---------
const topics = [
  "c",
  "python",
  "javascript",
  "cplus",
  "css",
  "html",
  "nodejs",
  "sql",
  "java",
  "numpy",
  "pandas"
];

// Basic level routes
topics.forEach((topic) => {
  app.get(`/quiz/${topic}`, async (req, res) => {
    await handleAIQuiz(req.sessionId, topic, res, "basic");
  });
});

// Medium level routes
topics.forEach((topic) => {
  app.get(`/quiz/medium${topic}`, async (req, res) => {
    await handleAIQuiz(req.sessionId, topic, res, "medium");
  });
});

// Hard level routes
topics.forEach((topic) => {
  app.get(`/quiz/hard${topic}`, async (req, res) => {
    await handleAIQuiz(req.sessionId, topic, res, "hard");
  });
});

// --------- Submit answer ---------
app.post("/submit", async (req, res) => {
  console.log("📥 Submit request received");
  console.log("   Session ID:", req.sessionId);
  console.log("   Body:", req.body);
  
  const session = userSessions.get(req.sessionId);
  
  if (!session) {
    console.error("❌ Session not found:", req.sessionId);
    console.log("   Available sessions:", Array.from(userSessions.keys()));
    return res.status(400).render("error", {
      message: "Session Not Found",
      details: "Your session has expired. Please start a new quiz."
    });
  }
  
  if (!session.currentQuestion) {
    console.error("❌ No active question in session");
    console.log("   Session data:", session);
    return res.status(400).render("error", {
      message: "No Active Question",
      details: "Please start a quiz first by selecting a topic."
    });
  }

  let answer = (req.body.answer || "").trim();
  
  if (!answer) {
    return res.status(400).render("error", {
      message: "No Answer Provided",
      details: "Please select an answer before submitting."
    });
  }

  let isCorrect = false;
  let explanation = "";
  let levelChange = { changed: false };

  const currentQuestion = session.currentQuestion;
  const correctAnswer = currentQuestion.answer;

  console.log(`📝 Answer submitted: ${answer}, Correct: ${correctAnswer}`);

  // Validate answer using AI
  const validation = await validateAnswer(
    answer,
    correctAnswer,
    currentQuestion
  );
  isCorrect = validation.isCorrect;
  explanation = currentQuestion.explanation || validation.explanation;

  session.totalQuestions++;

  if (isCorrect) {
    session.totalCorrect++;
    session.correctStreak++;
    session.incorrectStreak = 0;
  } else {
    session.incorrectStreak++;
    session.correctStreak = 0;
  }

  // Check if difficulty should change
  levelChange = adjustDifficulty(session);

  // Generate next question
  try {
    const nextQ = await generateAIQuestion(
      session.topic,
      session.currentLevel,
      session.questionHistory
    );
    session.questionHistory.push(nextQ);
    session.currentQuestion = nextQ;

    res.render("index.ejs", {
      question: nextQ,
      wasCorrect: isCorrect,
      totalScore: session.totalCorrect,
      explanation: explanation,
      levelChange: levelChange,
      sessionId: req.sessionId,
      currentLevel: session.currentLevel,
      stats: {
        correct: session.totalCorrect,
        total: session.totalQuestions,
        streak: session.correctStreak
      },
      aiMode: true
    });
  } catch (error) {
    console.error("Failed to generate next question:", error);
    res.status(500).render("error", {
      message: "Failed to Generate Next Question",
      details: error.message
    });
  }
});

// --------- Hint endpoint ---------
app.post("/hint", async (req, res) => {
  const session = userSessions.get(req.sessionId);
  const hintNumber = Number(req.body.hintNumber) || 1;

  if (!session.currentQuestion) {
    return res.json({ hint: "No active question" });
  }

  if (hintNumber > 2) {
    return res.json({ hint: "Maximum hints reached for this question." });
  }

  try {
    const hint = await generateHint(
      session.currentQuestion,
      session.currentLevel,
      hintNumber
    );
    res.json({ hint: hint, hintNumber: hintNumber });
  } catch (error) {
    res.json({ hint: "Unable to generate hint at this time." });
  }
});

// --------- Session utilities ---------
app.post("/reset-session", (req, res) => {
  const session = userSessions.get(req.sessionId);
  session.currentLevel = "basic";
  session.correctStreak = 0;
  session.incorrectStreak = 0;
  session.totalCorrect = 0;
  session.totalQuestions = 0;
  session.questionHistory = [];
  session.currentQuestion = null;
  res.json({ message: "Session reset successfully" });
});

app.get("/session-stats", (req, res) => {
  const session = userSessions.get(req.sessionId);
  const accuracy =
    session.totalQuestions > 0
      ? ((session.totalCorrect / session.totalQuestions) * 100).toFixed(1)
      : 0;

  res.json({
    currentLevel: session.currentLevel,
    totalCorrect: session.totalCorrect,
    totalQuestions: session.totalQuestions,
    correctStreak: session.correctStreak,
    accuracy,
    aiEnabled: aiEnabled
  });
});

// --------- Start server ---------
app.listen(port, () => {
  console.log("\n" + "=".repeat(60));
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log("=".repeat(60));

  if (aiEnabled) {
    console.log("✅ AI-Powered Quiz Mode: ENABLED");
    console.log(`🤖 Using model: ${workingModelName}`);
    console.log("🎯 All questions generated dynamically by Gemini AI");
  } else {
    console.log("❌ AI-Powered Quiz Mode: DISABLED");
    console.log("⚠️  Application requires valid GEMINI_API_KEY");
    console.log("📝 Add GEMINI_API_KEY to your .env file");
  }

  console.log("=".repeat(60) + "\n");
});