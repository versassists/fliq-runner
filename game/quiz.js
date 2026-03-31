// ── Question Bank (15 financial literacy questions) ───────────────
export const QUESTIONS = [
  {
    id: 'q1',
    question: "You have $20. A toy costs $25. What should you do?",
    answers: [
      "Buy it on credit",
      "Save up until you have $25",
      "Borrow from a friend",
      "Buy something cheaper right now"
    ],
    correct: 1,
    explanation: "Saving first means you only spend money you actually have — no debt!"
  },
  {
    id: 'q2',
    question: "Which of these is a NEED, not a WANT?",
    answers: ["New video game", "Designer sneakers", "Food & water", "Movie tickets"],
    correct: 2,
    explanation: "Food and water are needs — we must have them to survive. The others are wants!"
  },
  {
    id: 'q3',
    question: "What is a budget?",
    answers: [
      "A type of bank account",
      "A plan for how to spend and save your money",
      "A type of credit card",
      "Money you borrow from the bank"
    ],
    correct: 1,
    explanation: "A budget is your money plan — it helps you stay in control and reach your goals!"
  },
  {
    id: 'q4',
    question: "If you save $5 every week, how much do you have after 4 weeks?",
    answers: ["$10", "$15", "$20", "$25"],
    correct: 2,
    explanation: "5 × 4 = $20! Small amounts add up — that's the power of consistent saving!"
  },
  {
    id: 'q5',
    question: "What does an Emergency Fund help you do?",
    answers: [
      "Buy things on sale faster",
      "Pay for unexpected costs without going into debt",
      "Earn more money quickly",
      "Get a loan approved faster"
    ],
    correct: 1,
    explanation: "An emergency fund is your safety net — surprises happen, and it keeps you out of debt!"
  },
  {
    id: 'q6',
    question: "You want a game that costs $40. You have $25. What's the SMART move?",
    answers: [
      "Use a credit card right now",
      "Ask a store for a loan",
      "Save for a few more weeks until you can afford it",
      "Give up on the game forever"
    ],
    correct: 2,
    explanation: "Delayed gratification — waiting until you can afford it — is one of the best money habits!"
  },
  {
    id: 'q7',
    question: "What does 'interest' mean when you BORROW money?",
    answers: [
      "The fun you have spending money",
      "Extra money you pay back on top of what you borrowed",
      "A type of savings account reward",
      "Free money the bank gives you"
    ],
    correct: 1,
    explanation: "When you borrow, you pay back MORE than you took — that extra charge is called interest!"
  },
  {
    id: 'q8',
    question: "Which habit BEST helps you build savings over time?",
    answers: [
      "Buy everything you want right away",
      "Spend first, save whatever happens to be left over",
      "Save a set amount FIRST, then spend the rest",
      "Never spend any money at all"
    ],
    correct: 2,
    explanation: "Pay yourself first! Setting aside savings before spending is how wealth grows!"
  },
  {
    id: 'q9',
    question: "What is a credit score?",
    answers: [
      "Your test score from financial class",
      "How much cash you have in the bank right now",
      "A number that shows how responsibly you handle borrowed money",
      "The fee you pay to get a credit card"
    ],
    correct: 2,
    explanation: "A credit score shows lenders if you're trustworthy. Higher score = better loan terms!"
  },
  {
    id: 'q10',
    question: "Loan Shark Larry offers: $50 now, but you owe $100 next week. Should you take it?",
    answers: [
      "Yes — it's free money right now!",
      "No — you'd pay back DOUBLE what you borrowed",
      "Yes, if you really need it urgently",
      "Only if the money is for a real need"
    ],
    correct: 1,
    explanation: "Predatory loans trap you in debt! Always understand the true cost before borrowing!"
  },
  {
    id: 'q11',
    question: "What's the BEST way to track your spending?",
    answers: [
      "Just try to remember it in your head",
      "Ask friends how much they think you spent",
      "Write it down or use a budgeting app",
      "Check your pockets at the end of the week"
    ],
    correct: 2,
    explanation: "Tracking spending reveals where your money really goes — it surprises most people!"
  },
  {
    id: 'q12',
    question: "What does 'investing' mean?",
    answers: [
      "Spending all your money on clothes",
      "Putting money to work so it can grow over time",
      "Borrowing money from a bank",
      "Giving money to charity"
    ],
    correct: 1,
    explanation: "Investing lets your money EARN more money — that's how wealth grows over time!"
  },
  {
    id: 'q13',
    question: "If you earn $100 and spend $110, you are…",
    answers: [
      "In surplus — you have extra money!",
      "Perfectly balanced (breaking even)",
      "In deficit — spending more than you earn",
      "Investing wisely for the future"
    ],
    correct: 2,
    explanation: "Spending more than you earn creates debt. A budget keeps you balanced or in surplus!"
  },
  {
    id: 'q14',
    question: "What does 'generosity' have to do with money?",
    answers: [
      "It means keeping all your money safely",
      "It means spending only on yourself",
      "Sharing resources to help others and strengthen communities",
      "Borrowing money and not paying it back"
    ],
    correct: 2,
    explanation: "Giving back strengthens communities and is one of the smartest uses of financial abundance!"
  },
  {
    id: 'q15',
    question: "Ms. Overdraft keeps spending more than she earns. What will happen?",
    answers: [
      "She'll save more money automatically",
      "Her credit score will improve",
      "She'll go into debt and face financial stress",
      "Banks will give her free money"
    ],
    correct: 2,
    explanation: "Overspending leads to debt and stress. Staying within your means is the key to financial freedom!"
  },
];

// ── Quiz Manager ────────────────────────────────────────────────
export class QuizManager {
  constructor(gameState) {
    this.gameState       = gameState;
    this._triggers       = [];
    this._usedQuestions  = new Set();
    this._currentQ       = null;

    // DOM
    this._overlay    = document.getElementById('quiz-overlay');
    this._questionEl = document.getElementById('quiz-question');
    this._answersEl  = document.getElementById('quiz-answers');
    this._feedbackEl = document.getElementById('quiz-feedback');

    this._setupKeyboard();
  }

  addTriggers(triggers) {
    // triggers: [{x, y, z, radius}]
    this._triggers = triggers.map(t => ({ ...t, fired: false }));
  }

  resetTriggers() {
    this._triggers.forEach(t => (t.fired = false));
  }

  checkTriggers(playerPosition) {
    if (this.gameState.paused) return;
    for (const t of this._triggers) {
      if (t.fired) continue;
      const dx   = playerPosition.x - t.x;
      const dz   = playerPosition.z - t.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < (t.radius ?? 3)) {
        t.fired = true;
        this._showQuiz();
        break;
      }
    }
  }

  // ── Internal ────────────────────────────────────────────────
  _pickQuestion() {
    const pool = QUESTIONS.filter(q => !this._usedQuestions.has(q.id));
    if (!pool.length) {
      this._usedQuestions.clear();
      return QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
    }
    const q = pool[Math.floor(Math.random() * pool.length)];
    this._usedQuestions.add(q.id);
    return q;
  }

  _setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (!this.gameState.inQuiz) return;
      const map = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 };
      if (map[e.code] !== undefined) this._selectAnswer(map[e.code]);
    });
  }

  _showQuiz() {
    this._currentQ = this._pickQuestion();
    this.gameState.paused = true;
    this.gameState.inQuiz = true;

    this._questionEl.textContent = this._currentQ.question;
    this._answersEl.innerHTML    = '';
    this._feedbackEl.textContent = '';
    this._feedbackEl.className   = '';

    this._currentQ.answers.forEach((ans, i) => {
      const btn      = document.createElement('button');
      btn.className  = 'quiz-answer';
      btn.textContent = `${['A', 'B', 'C', 'D'][i]}. ${ans}`;
      btn.addEventListener('click', () => this._selectAnswer(i));
      this._answersEl.appendChild(btn);
    });

    this._overlay.classList.remove('hidden');
  }

  _selectAnswer(idx) {
    if (!this.gameState.inQuiz) return;
    this.gameState.inQuiz = false; // lock against double-click

    const correct  = idx === this._currentQ.correct;
    const buttons  = this._answersEl.querySelectorAll('.quiz-answer');
    buttons.forEach((btn, i) => {
      btn.disabled = true;
      if (i === this._currentQ.correct) btn.classList.add('correct');
      else if (i === idx && !correct)   btn.classList.add('wrong');
    });

    if (correct) {
      this._feedbackEl.textContent = '✓ Smart Move! +50 FLIQ Coins!';
      this._feedbackEl.className   = 'correct';
      this.gameState.quizResult    = 'correct';
    } else {
      this._feedbackEl.textContent = `✗ ${this._currentQ.explanation}`;
      this._feedbackEl.className   = 'wrong';
      this.gameState.quizResult    = 'wrong';
    }

    setTimeout(() => this._hideQuiz(), 2800);
  }

  _hideQuiz() {
    this._overlay.classList.add('hidden');
    this.gameState.paused = false;
    this.gameState.inQuiz = false;
  }
}
