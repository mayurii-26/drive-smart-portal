// Driving Test Practice JavaScript

let questions = [];
let currentQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = [];
let quizStarted = false;
let quizCompleted = false;
const QUESTIONS_PER_QUIZ = 20;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadQuestions();
  if (questions.length > 0) {
    startQuiz();
  } else {
    showError('Failed to load questions. Please refresh the page.');
  }
});

// Load questions from JSON file
async function loadQuestions() {
  try {
    const response = await fetch('/data/ll_questions.json');
    if (!response.ok) {
      throw new Error('Failed to load questions');
    }
    questions = await response.json();
    console.log(`Loaded ${questions.length} questions`);
  } catch (error) {
    console.error('Error loading questions:', error);
    showError('Failed to load questions. Please check your connection and refresh.');
  }
}

// Start quiz - randomize and select questions
function startQuiz() {
  if (questions.length < QUESTIONS_PER_QUIZ) {
    showError(`Not enough questions available. Need ${QUESTIONS_PER_QUIZ}, found ${questions.length}.`);
    return;
  }
  
  // Shuffle and select random questions
  const shuffled = [...questions].sort(() => Math.random() - 0.5);
  currentQuestions = shuffled.slice(0, QUESTIONS_PER_QUIZ);
  
  // Reset quiz state
  currentQuestionIndex = 0;
  userAnswers = new Array(QUESTIONS_PER_QUIZ).fill(null);
  quizStarted = true;
  quizCompleted = false;
  
  // Show quiz container, hide results
  document.getElementById('quiz-container').style.display = 'block';
  document.getElementById('results-container').style.display = 'none';
  
  // Display first question
  displayQuestion();
  updateProgress();
}

// Display current question
function displayQuestion() {
  if (currentQuestionIndex >= currentQuestions.length) {
    submitQuiz();
    return;
  }
  
  const question = currentQuestions[currentQuestionIndex];
  const isAnswered = userAnswers[currentQuestionIndex] !== null;
  
  // Update question text
  document.getElementById('question-number').textContent = `Q${currentQuestionIndex + 1}`;
  document.getElementById('question-text').textContent = question.question;
  
  // Clear options
  const optionsContainer = document.getElementById('options-container');
  optionsContainer.innerHTML = '';
  
  // Create option buttons
  question.options.forEach((option, index) => {
    const optionBtn = document.createElement('button');
    optionBtn.className = 'option-btn';
    optionBtn.id = `option-${index}`;
    
    if (isAnswered && userAnswers[currentQuestionIndex] === index) {
      optionBtn.classList.add('selected');
    }
    
    const label = document.createElement('span');
    label.className = 'option-label';
    label.textContent = String.fromCharCode(65 + index); // A, B, C, D
    
    const text = document.createElement('span');
    text.textContent = option;
    
    optionBtn.appendChild(label);
    optionBtn.appendChild(text);
    
    optionBtn.addEventListener('click', () => selectOption(index));
    optionsContainer.appendChild(optionBtn);
  });
  
  // Update navigation buttons
  updateNavigationButtons();
}

// Select an option
function selectOption(index) {
  if (quizCompleted) return;
  
  // Save answer
  userAnswers[currentQuestionIndex] = index;
  
  // Update UI
  const options = document.querySelectorAll('.option-btn');
  options.forEach((btn, i) => {
    btn.classList.remove('selected');
    if (i === index) {
      btn.classList.add('selected');
    }
  });
  
  // Update navigation buttons
  updateNavigationButtons();
}

// Update navigation buttons
function updateNavigationButtons() {
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const submitBtn = document.getElementById('submit-btn');
  
  // Previous button
  prevBtn.disabled = currentQuestionIndex === 0;
  
  // Next/Submit button
  const isAnswered = userAnswers[currentQuestionIndex] !== null;
  const isLastQuestion = currentQuestionIndex === currentQuestions.length - 1;
  
  if (isLastQuestion) {
    nextBtn.style.display = 'none';
    submitBtn.style.display = isAnswered ? 'inline-block' : 'none';
  } else {
    nextBtn.style.display = 'inline-block';
    submitBtn.style.display = 'none';
  }
  
  nextBtn.disabled = !isAnswered;
  submitBtn.disabled = !isAnswered;
}

// Go to previous question
function previousQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    displayQuestion();
    updateProgress();
  }
}

// Go to next question
function nextQuestion() {
  if (userAnswers[currentQuestionIndex] === null) {
    return; // Must answer before proceeding
  }
  
  if (currentQuestionIndex < currentQuestions.length - 1) {
    currentQuestionIndex++;
    displayQuestion();
    updateProgress();
  } else {
    submitQuiz();
  }
}

// Update progress bar and text
function updateProgress() {
  const progress = ((currentQuestionIndex + 1) / currentQuestions.length) * 100;
  document.getElementById('progress-bar').style.width = `${progress}%`;
  document.getElementById('progress-text').textContent = `Question ${currentQuestionIndex + 1} of ${currentQuestions.length}`;
}

// Submit quiz and show results
function submitQuiz() {
  quizCompleted = true;
  
  // Calculate score
  let correctCount = 0;
  const results = [];
  
  currentQuestions.forEach((question, index) => {
    const userAnswer = userAnswers[index];
    const isCorrect = userAnswer === question.answerIndex;
    
    if (isCorrect) {
      correctCount++;
    }
    
    results.push({
      question: question,
      userAnswer: userAnswer,
      isCorrect: isCorrect
    });
  });
  
  const incorrectCount = QUESTIONS_PER_QUIZ - correctCount;
  const scorePercentage = Math.round((correctCount / QUESTIONS_PER_QUIZ) * 100);
  
  // Store results
  window.quizResults = results;
  
  // Display results
  displayResults(correctCount, incorrectCount, scorePercentage);
  
  // Hide quiz container, show results
  document.getElementById('quiz-container').style.display = 'none';
  document.getElementById('results-container').style.display = 'block';
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Display results
function displayResults(correctCount, incorrectCount, scorePercentage) {
  // Update score display
  document.getElementById('score-number').textContent = scorePercentage;
  document.getElementById('correct-count').textContent = correctCount;
  document.getElementById('incorrect-count').textContent = incorrectCount;
  document.getElementById('total-count').textContent = QUESTIONS_PER_QUIZ;
  
  // Hide review section initially
  document.getElementById('review-section').style.display = 'none';
}

// Restart quiz
function restartQuiz() {
  // Reset state
  currentQuestionIndex = 0;
  userAnswers = new Array(QUESTIONS_PER_QUIZ).fill(null);
  quizCompleted = false;
  
  // Start new quiz with new random questions
  startQuiz();
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Review answers
function reviewAnswers() {
  const reviewSection = document.getElementById('review-section');
  const reviewQuestions = document.getElementById('review-questions');
  
  if (reviewSection.style.display === 'none') {
    // Show review
    reviewQuestions.innerHTML = '';
    
    window.quizResults.forEach((result, index) => {
      const { question, userAnswer, isCorrect } = result;
      
      const reviewCard = document.createElement('div');
      reviewCard.className = `review-question ${isCorrect ? 'correct' : 'incorrect'}`;
      
      const header = document.createElement('div');
      header.className = 'review-question-header';
      
      const questionNumber = document.createElement('div');
      questionNumber.className = 'review-question-number';
      questionNumber.textContent = `Question ${index + 1}`;
      
      const status = document.createElement('div');
      status.className = `review-status ${isCorrect ? 'correct' : 'incorrect'}`;
      status.textContent = isCorrect ? '✓ Correct' : '✗ Incorrect';
      
      header.appendChild(questionNumber);
      header.appendChild(status);
      
      const questionText = document.createElement('div');
      questionText.className = 'review-question-text';
      questionText.textContent = question.question;
      
      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'review-options';
      
      question.options.forEach((option, optIndex) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'review-option';
        
        if (optIndex === userAnswer) {
          optionDiv.classList.add('user-answer');
        }
        
        if (optIndex === question.answerIndex) {
          optionDiv.classList.add('correct-answer');
        } else if (optIndex === userAnswer && !isCorrect) {
          optionDiv.classList.add('wrong-answer');
        }
        
        const label = document.createElement('span');
        label.className = 'option-label';
        label.textContent = String.fromCharCode(65 + optIndex);
        
        const text = document.createElement('span');
        text.textContent = option;
        
        optionDiv.appendChild(label);
        optionDiv.appendChild(text);
        optionsContainer.appendChild(optionDiv);
      });
      
      const explanation = document.createElement('div');
      explanation.className = 'review-explanation';
      
      const explanationLabel = document.createElement('div');
      explanationLabel.className = 'review-explanation-label';
      explanationLabel.textContent = 'Explanation:';
      
      const explanationText = document.createElement('div');
      explanationText.className = 'review-explanation-text';
      explanationText.textContent = question.explanation;
      
      explanation.appendChild(explanationLabel);
      explanation.appendChild(explanationText);
      
      reviewCard.appendChild(header);
      reviewCard.appendChild(questionText);
      reviewCard.appendChild(optionsContainer);
      reviewCard.appendChild(explanation);
      
      reviewQuestions.appendChild(reviewCard);
    });
    
    reviewSection.style.display = 'block';
    
    // Scroll to review section
    reviewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    // Hide review
    reviewSection.style.display = 'none';
  }
}

// Show error message
function showError(message) {
  const questionCard = document.getElementById('question-card');
  if (questionCard) {
    questionCard.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: #ef4444;">
        <h3 style="margin-bottom: 1rem;">⚠️ Error</h3>
        <p>${message}</p>
        <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 1rem;">Refresh Page</button>
      </div>
    `;
  }
}

