# OmniStudia

**An advanced, open-source AI educational platform designed to transform your study materials into fully interactive learning experiences.**

OmniStudia helps students, educators, and researchers maximize their learning efficiency by seamlessly converting static documents into contextual chats, flashcards, quizzes, and even dynamic audio podcasts.

---

## 🚀 Features

OmniStudia converts your study material into **interactive resources** including quizzes, flashcards, structured notes, and podcasts.

### Learning Tools

- **Contextual Chat** – Upload documents (PDF, DOCX, Markdown, TXT) and ask contextual questions.
- **SmartNotes** – Generate structured, Cornell-style notes automatically.
- **Flashcards** – Extract and generate flashcards to facilitate spaced repetition.
- **Quizzes** – Create interactive, testable quizzes with hints and comprehensive explanations.
- **AI Podcast** – Convert complex topics into engaging, easy-to-listen-to audio content.
- **Voice Transcriber** - Convert lecture recordings and voice memos into structured text.
- **Homework Planner** - Schedule and map out your homework with intelligent AI assistance.
- **ExamLab** - Simulate real exams and get feedback.
- **Study Companion** - A personalized AI companion built directly into your workflow.

### Supported Models & Providers
OmniStudia is designed to work seamlessly with:
- Google Gemini 
- Google Text-to-Speech (Free)

---

## 🛠️ Technology Stack

| Component      | Technology                               |
| -------------- | ---------------------------------------- |
| **Backend**    | Node.js, JavaScript                      |
| **Frontend**   | Vite, React, TailwindCSS                 |
| **Database**   | JSON (default, file-based)               |
| **AI/Audio**   | Google Gemini, Google TTS, `ffmpeg`      |

---

## ⚡ Getting Started

### Prerequisites

- Node.js v21.18+
- npm

### Installation & Setup

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd OmniStudia
   ```

2. Install dependencies:
   ```bash
   cd backend
   npm install
   cd ../frontend
   npm install
   cd ..
   ```

3. Setup environment variables:
   Copy `.env.example` to `.env` and fill out your specific configuration (primarily your Gemini API Key).
   ```bash
   cp .env.example .env
   ```

4. Run the application:
   You will need two terminals running simultaneously in the project root.
   
   **Terminal 1 (Backend):**
   ```bash
   cd backend
   npm run dev
   ```

   **Terminal 2 (Frontend):**
   ```bash
   cd frontend
   npm run dev
   ```

Access the application at: **http://localhost:5173**

---

## 📜 License

Licensed under the **MIT License**.  
See `LICENSE.md` for full terms.
