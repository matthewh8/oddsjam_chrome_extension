/**
 * Convert American odds to decimal odds
 * @param {string} americanOdds - American odds format (e.g., "+150", "-110")
 * @returns {number} Decimal odds
 */
function americanToDecimal(americanOdds) {
    const odds = parseInt(americanOdds.replace('+', ''));
    return odds > 0 ? 1 + (odds / 100) : 1 + (100 / Math.abs(odds));
  }
  
  /**
   * Calculate implied probability from American odds
   * @param {string} americanOdds - American odds format
   * @returns {number} Implied probability as percentage (0-100)
   */
  function calculateImpliedOdds(americanOdds) {
    const odds = parseInt(americanOdds);
    if (isNaN(odds)) return 0;
    
    return odds > 0 
      ? (100 / (odds + 100) * 100).toFixed(2)
      : (Math.abs(odds) / (Math.abs(odds) + 100) * 100).toFixed(2);
  }
  
  /**
   * Calculate Kelly Criterion bet size
   * @param {string} trueOdds - True/fair American odds
   * @param {string} bookOdds - Bookmaker American odds
   * @param {number} bankroll - Total bankroll amount
   * @param {number} kellyMultiplier - Kelly multiplier (0-1)
   * @returns {number} Recommended bet size in dollars
   */
  function calculateKellyBetSize(trueOdds, bookOdds, bankroll, kellyMultiplier) {
    const bookDecimalOdds = americanToDecimal(bookOdds);
    const actualProb = calculateImpliedOdds(trueOdds) / 100;
    
    const b = bookDecimalOdds - 1; // Net odds received on the wager
    const p = actualProb;          // Probability of winning
    const q = 1.0 - p;            // Probability of losing
    
    // Kelly formula: f = (bp - q) / b
    const kellyFraction = ((b * p) - q) / b;
    
    // Apply Kelly multiplier and ensure non-negative result
    return Math.max(0, kellyFraction * kellyMultiplier * bankroll);
  }
  
  /**
   * Process scraped table data and calculate bet sizes for each row
   * @param {string} rawText - Raw scraped text from the page
   * @param {number} bankroll - Total bankroll amount
   * @param {number} kellyMultiplier - Kelly multiplier
   * @returns {Array} Array of processed table data with bet sizes
   */
  function processTableData(rawText, bankroll, kellyMultiplier) {
    const lines = rawText.trim().split('\n\n');
    const tableData = [];
    
    console.log(`Processing data with bankroll: $${bankroll}, Kelly multiplier: ${kellyMultiplier}`);
    
    for (let i = 0; i < lines.length; i += 3) {
      if (i + 2 < lines.length) {
        const trueAmericanOdds = lines[i + 1].replace(/^\d+\.\s/, '');
        const bookAmericanOdds = lines[i + 2].replace(/^\d+\.\s/, '');
        const betSize = calculateKellyBetSize(
          trueAmericanOdds, 
          bookAmericanOdds, 
          bankroll, 
          kellyMultiplier
        );
        
        tableData.push({
          ev: lines[i].replace(/^\d+\.\s/, ''),
          odds: trueAmericanOdds,
          bookPrice: bookAmericanOdds,
          impliedOdds: calculateImpliedOdds(trueAmericanOdds),
          betSize: betSize.toFixed(2)
        });
      }
    }
    
    return tableData;
  }
  
// Export functions for use in other files
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = {
      americanToDecimal,
      calculateImpliedOdds,
      calculateKellyBetSize,
      processTableData
    };
  } else if (typeof self !== 'undefined') {
    // Service worker environment - attach to global scope
    self.BettingCalculations = {
      americanToDecimal,
      calculateImpliedOdds,
      calculateKellyBetSize,
      processTableData
    };
  } else if (typeof window !== 'undefined') {
    // Browser environment - attach to window object
    window.BettingCalculations = {
      americanToDecimal,
      calculateImpliedOdds,
      calculateKellyBetSize,
      processTableData
    };
  }