// Globalny stan
let questions = [];
let currentQuestion = 0;
let score = 0;
let answered = false;
let currentQuizType = '';
let kataQuestionsFullList = []; // Cache dla pełnej listy Kata
let kumiteQuestionsFullList = []; // Cache dla pełnej listy Kumite

// Elementy DOM
const quizSelectionDiv = document.getElementById("quiz-selection-view");
const quizContainerDiv = document.getElementById("quiz-container");
const questionContainer = document.getElementById("question-container");
const questionElement = document.getElementById("question");
const answersElement = document.getElementById("answers");
const nextButton = document.getElementById("next-btn");
const kataButton = document.getElementById("kata-btn");
const kumiteButton = document.getElementById("kumite-btn");
const infoKumite = document.getElementById("info-kumite");

// Nowe elementy dla zakładek i widoków
const navTabs = document.querySelectorAll('.nav-tab');
const contentViews = document.querySelectorAll('.content-view');


// ======== FUNKCJE ZARZĄDZANIA WIDOKAMI (ZAKŁADKAMI) ========

function switchView(targetId) {
    // 1. Zmień aktywną zakładkę
    navTabs.forEach(tab => {
        tab.classList.remove('active-tab');
        if (tab.getAttribute('data-target') === targetId) {
            tab.classList.add('active-tab');
            
            // Jeśli przełączamy na widok listy, załaduj dane
            if (targetId.includes('list')) {
                loadFullList(targetId);
            }
        }
    });

    // 2. Zmień widoczny kontener
    // Ukryj wszystkie sekcje z klasą .content-view
    contentViews.forEach(view => {
        view.style.display = 'none';
    });
    
    // Ukryj kontener quizu (gdyż nie jest elementem content-view)
    quizContainerDiv.style.display = 'none';

    // Pokaż wybrany widok
    const targetView = document.getElementById(targetId);
    if (targetView) {
        targetView.style.display = 'block';
    }

    
}


// ======== INICJALIZACJA ========
document.addEventListener("DOMContentLoaded", () => {
    // Sprawdzenie, czy wszystkie elementy DOM zostały znalezione
    if (!quizSelectionDiv) {
        console.error("Błąd krytyczny: Nie znaleziono elementu #quiz-selection-view. Sprawdź index.html.");
        return; 
    }

    // Domyślne listenery quizu
    nextButton.addEventListener("click", nextQuestion);
    kataButton.addEventListener("click", () => loadQuiz('kata'));
    kumiteButton.addEventListener("click", () => loadQuiz('kumite'));

    // Listenery dla zakładek nawigacyjnych
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-target');
            switchView(targetId);
        });
    });
    
    // Upewnij się, że na starcie widoczny jest tylko ekran wyboru quizu
    switchView('quiz-selection-view'); 
});

// ======== NOWA FUNKCJA DO MIESZANIA (TASOWANIA) TABLICY ========

/**
 * Tasuje (miesza) elementy tablicy w miejscu.
 * Używa algorytmu Fisher-Yates.
 * @param {Array} array Tablica do przetasowania.
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; // Zamiana elementów
    }
}
// ======== FUNKCJE ŁADOWANIA DANYCH (PapaParse) ========

// Funkcja pomocnicza do parsowania CSV
function parseCsvData(filename, callback) {
    Papa.parse(filename, {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        delimiter: ";", 
        complete: function(results) {
            // Walidacja, że dane się załadowały i mają wiersze
            if (results.data.length === 0 || results.errors.length > 0) {
                 // Zwróć błąd, jeśli plik jest pusty lub ma błędy parsowania
                 const errorMessage = results.errors.length > 0 ? results.errors[0].message : "Brak danych lub błędny format pliku CSV.";
                 return callback(null, errorMessage);
            }

            // Filtrowanie i mapowanie danych
            const validData = results.data.filter(item => item.Pytanie && item.Poprawna_odpowiedz !== undefined);
            
            if (validData.length > 0) {
                const mappedQuestions = validData.map(item => {
                    // Normalizacja odpowiedzi (0/F -> F, reszta -> P)
                    const correctAns = item.Poprawna_odpowiedz == 0 || item.Poprawna_odpowiedz.toString().toUpperCase().trim() === 'F' ? 'F' : 'P';
                    return {
                        question: item.Pytanie,
                        correct: correctAns, 
                        explanation: item.Wyjaśnienie || "Brak objaśnienia." // Jeśli brak wyjaśnienia
                    };
                });
                callback(mappedQuestions);
            } else {
                callback(null, "Plik CSV nie zawiera kolumn: Pytanie, Poprawna_odpowiedz, Wyjaśnienie lub jest pusty.");
            }
        },
        error: function(error) {
            callback(null, `Wystąpił błąd podczas ładowania pliku ${filename}. Szczegóły techniczne: ${error.message}`);
        }
    });
}

function handleLoadError(quizType, message) {
    // Wróć do ekranu wyboru
    switchView('quiz-selection-view'); 
    
    const errorDiv = document.getElementById('info-kumite'); // Używamy tego elementu do wyświetlania błędów
    errorDiv.style.display = 'block';
    
    // Wyświetl konkretną informację o błędzie
    errorDiv.innerHTML = `<strong>Błąd ładowania quizu ${quizType.toUpperCase()}!</strong> ${message}`;
    
    // Przywróć oryginalny nagłówek
    document.querySelector('header h1').textContent = `Quiz o przepisach karate 🥋`;
    document.querySelector('header p').textContent = `Sprawdź, jak dobrze znasz zasady i przepisy karate!`;
}

// ======== LOGIKA ŁADOWANIA QUIZU (Rozpoczyna grę) ========

function loadQuiz(quizType) {
    currentQuizType = quizType;
    const timestamp = new Date().getTime();
    const filename = `${quizType}.csv`;
    
    // Ukryj wybór, pokaż wskaźnik ładowania
    quizSelectionDiv.style.display = 'none';
    quizContainerDiv.style.display = 'block';
    infoKumite.style.display = 'none'; // Ukryj ewentualne komunikaty o błędach
    
    questionElement.textContent = `Ładowanie pytań dla quizu ${quizType.toUpperCase()}...`;
    answersElement.innerHTML = '';
    nextButton.style.display = 'none';

    parseCsvData(filename, (mappedQuestions, error) => {
        if (mappedQuestions) {
            questions = mappedQuestions;
            startQuiz();
        } else {
            handleLoadError(quizType, error);
        }
    });
}

function startQuiz() {
    // Reset stanu
    currentQuestion = 0;
    score = 0;
    answered = false;
    
    shuffleArray(questions);

    // Zaktualizuj nagłówek
    document.querySelector('header h1').textContent = `Quiz o przepisach karate (${currentQuizType.toUpperCase()}) 🥋`;
    document.querySelector('header p').textContent = `Pytanie 1 z ${questions.length}`;
    
    // Pokaż kontener quizu
    quizContainerDiv.style.display = 'block';
    questionContainer.style.display = 'block'; 

    // Upewnij się, że przycisk "Zacznij od nowa" wróci do swojej pierwotnej funkcji
    nextButton.removeEventListener("click", showResults); // Poprawiona logika
    nextButton.removeEventListener("click", resetQuiz);
    nextButton.addEventListener("click", nextQuestion);

    showQuestion();
}

// ======== LOGIKA ŁADOWANIA PEŁNEJ LISTY PYTAŃ (Dla zakładek) ========

function loadFullList(targetId) {
    const quizType = targetId.includes('kata') ? 'kata' : 'kumite';
    const filename = `${quizType}.csv`;
    const targetElement = document.getElementById(targetId);
    
    // Sprawdzenie cache
    const questionsCache = quizType === 'kata' ? kataQuestionsFullList : kumiteQuestionsFullList;
    if (questionsCache.length > 0) {
        displayFullList(targetId, questionsCache);
        return;
    }
    
    targetElement.innerHTML = `<h2>Lista Pytań ${quizType.toUpperCase()}</h2><p>Ładowanie pełnej listy pytań...</p>`;

    parseCsvData(filename, (mappedQuestions, error) => {
        if (mappedQuestions) {
            if (quizType === 'kata') {
                kataQuestionsFullList = mappedQuestions;
            } else {
                kumiteQuestionsFullList = mappedQuestions;
            }
            displayFullList(targetId, mappedQuestions);
        } else {
            targetElement.innerHTML = `<h2>Lista Pytań ${quizType.toUpperCase()}</h2><p>Błąd ładowania listy: ${error}. Upewnij się, że plik ${filename} istnieje i ma poprawne nagłówki (Pytanie;Poprawna_odpowiedz;Wyjaśnienie).</p>`;
        }
    });
}

function displayFullList(targetId, questionsList) {
    const targetElement = document.getElementById(targetId);
    let html = `<h2>Lista Pytań ${targetId.includes('kata') ? 'Kata' : 'Kumite'}</h2>`;
    
    // Dołączamy element wyszukiwania, jeśli istnieje
    const searchBox = document.getElementById(`${targetId.split('-')[0]}-search-box`);
    if (searchBox) {
        // Ponieważ ten element jest już w HTML, nie dodajemy go tu,
        // ale dodajemy wynik, aby nie kasować pola wyszukiwania
        html += searchBox.outerHTML; 
    }
    
    html += '<ol class="questions-list">';

    questionsList.forEach((q, index) => {
        const correctText = q.correct === 'P' ? 'Prawda' : 'Fałsz';
        const explanationHtml = q.explanation ? `<span class="explanation-text">Wyjaśnienie: ${q.explanation}</span>` : '';
        html += `
            <li class="question-item">
                <p><strong>${index + 1}. ${q.question}</strong></p>
                <p class="answer-info">
                    <span class="correct-answer">Poprawna: ${correctText}</span>
                    ${explanationHtml}
                </p>
            </li>
        `;
    });

    html += '</ol>';
    targetElement.innerHTML = html;
    
    // Musimy odtworzyć elementy wyszukiwania, ponieważ innerHTML je kasuje
    // W tej prostej implementacji po prostu odświeżamy całą zawartość.
    // Lepszym rozwiązaniem byłoby tylko aktualizowanie listy, ale to jest szybsze.
}


// ======== FUNKCJA WYSZUKIWANIA PYTAŃ ========

function searchQuestion(quizType) {
    const inputElement = document.getElementById(`${quizType}-question-number`);
    const resultElement = document.getElementById(`${quizType}-search-result`);
    const questionNumber = parseInt(inputElement.value);
    
    const questionsCache = quizType === 'kata' ? kataQuestionsFullList : kumiteQuestionsFullList;

    // 1. Walidacja danych
    if (isNaN(questionNumber) || questionNumber <= 0) {
        resultElement.innerHTML = `<p style="color: red;">Proszę wpisać poprawny numer pytania (liczbę dodatnią).</p>`;
        resultElement.style.display = 'block';
        return;
    }

    // 2. Sprawdzenie, czy lista jest załadowana
    if (questionsCache.length === 0) {
        resultElement.innerHTML = `<p style="color: orange;">Ładowanie listy do wyszukiwania... Proszę spróbować ponownie po 2-3 sekundach.</p>`;
        resultElement.style.display = 'block';
        // Automatyczne załadowanie listy
        loadFullList(`${quizType}-list-view`); 
        return;
    }

    // 3. Wyszukanie pytania
    const questionIndex = questionNumber - 1;
    const questionData = questionsCache[questionIndex];

    if (questionData) {
        const correctText = questionData.correct === 'P' ? 'Prawda' : 'Fałsz';
        const explanationHtml = questionData.explanation 
            ? `<p class="explanation-text" style="color: #555;">Wyjaśnienie: ${questionData.explanation}</p>` 
            : '';

        resultElement.innerHTML = `
            <h3>Pytanie Nr ${questionNumber} (${quizType.toUpperCase()})</h3>
            <p><strong>Pytanie:</strong> ${questionData.question}</p>
            <p style="color: green; font-weight: bold;">Poprawna Odpowiedź: ${correctText}</p>
            ${explanationHtml}
        `;
        resultElement.style.display = 'block';
    } else {
        resultElement.innerHTML = `<p style="color: red;">Pytanie nr ${questionNumber} nie istnieje w liście (zakres: 1-${questionsCache.length}).</p>`;
        resultElement.style.display = 'block';
    }
}


// ======== FUNKCJE QUIZU ========

function showQuestion() {
    answered = false;
    
    if (currentQuestion >= questions.length) {
        showResults();
        return;
    }

    let q = questions[currentQuestion];
    
    // Aktualizacja numeru pytania w nagłówku
    document.querySelector('header p').textContent = `Pytanie ${currentQuestion + 1} z ${questions.length}`;

    questionElement.textContent = `${currentQuestion + 1}. ${q.question}`;
    answersElement.innerHTML = '';
    nextButton.style.display = 'none'; 

    // Przyciski odpowiedzi 'P' i 'F'
    ['P', 'F'].forEach(answer => {
        const btn = document.createElement("button");
        btn.textContent = answer === 'P' ? "Prawda" : "Fałsz";
        btn.setAttribute('data-answer', answer);
        btn.classList.add("answer-btn"); 
        btn.addEventListener("click", () => checkAnswer(answer));
        answersElement.appendChild(btn);
    });
}

function checkAnswer(selected) {
    if (answered) {
        return;
    }
    answered = true;
    
    let q = questions[currentQuestion];
    const feedback = document.createElement("p");
    feedback.style.width = '100%';

    document.querySelectorAll(".answer-btn").forEach(btn => btn.disabled = true);
    
    answersElement.querySelector('p')?.remove();

    const correctOptionText = q.correct === 'P' ? "Prawda" : "Fałsz";

    if (selected.toUpperCase().trim() === q.correct) {
        score++;
        feedback.innerHTML = `✅ Dobrze! (${correctOptionText})<br>${q.explanation}`;
        feedback.style.color = "green";
    } else {
        feedback.innerHTML = `❌ Źle! Poprawna odpowiedź to: ${correctOptionText}.<br>${q.explanation}`;
        feedback.style.color = "red";
    }

    answersElement.appendChild(feedback);

    nextButton.textContent = currentQuestion < questions.length - 1 ? "Następne pytanie" : "Zobacz wyniki";
    nextButton.style.display = "block";
}

function nextQuestion() {
    currentQuestion++;
    showQuestion();
}

function showResults() {
    questionElement.textContent = "Quiz zakończony!";
    
    // Zaktualizuj nagłówek
    document.querySelector('header h1').textContent = `Gratulacje! Quiz zakończony.`;
    document.querySelector('header p').textContent = `Twój wynik to: ${score} na ${questions.length}.`;
    
    answersElement.innerHTML = '';
    nextButton.textContent = "Wróć do wyboru quizu";
    
    // Zmiana akcji przycisku na powrót do widoku wyboru (resetQuiz)
    nextButton.removeEventListener("click", nextQuestion);
    nextButton.addEventListener("click", resetQuiz);
}

function resetQuiz() {
    // Reset stanu
    currentQuestion = 0;
    score = 0;
    questions = [];
    currentQuizType = '';
    
    // Przywróć oryginalny nagłówek
    document.querySelector('header h1').textContent = `Quiz o przepisach karate 🥋`;
    document.querySelector('header p').textContent = `Sprawdź, jak dobrze znasz zasady i przepisy karate!`;

    // Pokaż ekran wyboru quizu i ukryj quiz
    switchView('quiz-selection-view');
    
    // Przywróć oryginalną akcję przycisku "Następne pytanie"
    nextButton.removeEventListener("click", resetQuiz);
    nextButton.addEventListener("click", nextQuestion);
}