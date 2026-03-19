/**
 * LexiLearn IELTS Grading Engine
 * Handles normalization and comparison for various IELTS question types.
 */

export const gradingEngine = {
  /**
   * Main grading function
   * @param {string|Array} userAnswer - Student's answer
   * @param {Array} correctAnswers - Array of accepted answers from question_blocks.answers[questionNum]
   * @param {string} type - block_type
   * @param {Object} config - question_block.config
   */
  grade(userAnswer, correctAnswers, type, config = {}) {
    if (!userAnswer || !correctAnswers) return false;

    switch (type) {
      case 'fill_blank':
      case 'sentence_completion':
      case 'short_answer':
        return this.gradeTextEntry(userAnswer, correctAnswers, config);

      case 'multiple_choice':
      case 'matching':
      case 'true_false_ng':
      case 'map_labeling':
        return this.gradeExactMatch(userAnswer, correctAnswers?.[0] || correctAnswers);

      case 'multiple_select':
        return this.gradeMultipleSelect(userAnswer, correctAnswers, config);

      default:
        return false;
    }
  },

  /**
   * Text entry grading with normalization
   */
  gradeTextEntry(userAnswer, correctAnswers, config) {
    const normUser = this.normalize(userAnswer, config);
    if (normUser === '__OVER_WORD_LIMIT__') return false;

    // correctAnswers should be an array of possible correct strings
    const accepted = Array.isArray(correctAnswers) ? correctAnswers : [correctAnswers];
    
    return accepted.some(ans => {
      const normAns = this.normalize(ans, config);
      return normUser === normAns;
    });
  },

  /**
   * Exact match (MCQ, matching, T/F/NG)
   */
  gradeExactMatch(userAnswer, correctAnswer) {
    if (!userAnswer || !correctAnswer) return false;
    return userAnswer.toString().trim().toUpperCase() === correctAnswer.toString().trim().toUpperCase();
  },

  /**
   * Multiple select (Choose TWO/THREE)
   */
  gradeMultipleSelect(userAnswers, correctAnswers, config) {
    if (!Array.isArray(userAnswers) || !Array.isArray(correctAnswers)) return false;
    if (userAnswers.length !== correctAnswers.length) return false;

    const normUser = userAnswers.map(a => a.toString().trim().toUpperCase()).sort();
    const normCorrect = correctAnswers.map(a => a.toString().trim().toUpperCase()).sort();

    return JSON.stringify(normUser) === JSON.stringify(normCorrect);
  },

  /**
   * Normalization logic
   */
  normalize(text, config = {}) {
    if (typeof text !== 'string') return '';
    
    let result = text.trim();
    
    // Case sensitivity
    if (!config.case_sensitive) {
      result = result.toLowerCase();
    }

    // Collapse multiple spaces
    result = result.replace(/\s+/g, ' ');

    // Remove basic punctuation that might be optional (e.g., periods at the end)
    // result = result.replace(/[.,!?]$/g, ''); // Be careful with decimal numbers

    // Check word limit
    if (config.max_words) {
      const wordCount = result.split(/\s+/).filter(w => w.length > 0).length;
      if (wordCount > config.max_words) return '__OVER_WORD_LIMIT__';
    }

    return result;
  },

  /**
   * Band score mapping
   */
  calculateBand(scoreRaw, totalQuestions, module) {
    // Standard Academic/General Reading mapping (simplified for MVP)
    const mapping = module === 'reading' ? this.READING_BAND_MAP : this.LISTENING_BAND_MAP;
    
    for (const threshold of mapping) {
      if (scoreRaw >= threshold.min) return threshold.band;
    }
    return 0;
  },

  READING_BAND_MAP: [
    { min: 39, band: 9.0 }, { min: 37, band: 8.5 }, { min: 35, band: 8.0 },
    { min: 33, band: 7.5 }, { min: 30, band: 7.0 }, { min: 27, band: 6.5 },
    { min: 23, band: 6.0 }, { min: 19, band: 5.5 }, { min: 15, band: 5.0 },
    { min: 13, band: 4.5 }, { min: 10, band: 4.0 }, { min: 6,  band: 3.5 },
    { min: 4,  band: 3.0 }, { min: 0,  band: 0 }
  ],

  LISTENING_BAND_MAP: [
    { min: 39, band: 9.0 }, { min: 37, band: 8.5 }, { min: 35, band: 8.0 },
    { min: 32, band: 7.5 }, { min: 30, band: 7.0 }, { min: 26, band: 6.5 },
    { min: 23, band: 6.0 }, { min: 18, band: 5.5 }, { min: 16, band: 5.0 },
    { min: 13, band: 4.5 }, { min: 10, band: 4.0 }, { min: 6,  band: 3.5 },
    { min: 4,  band: 3.0 }, { min: 0,  band: 0 }
  ]
};
