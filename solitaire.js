/**
 * Classes for initializing and playing a game of solitaire.
 * @author Robert Fotino <robert@fotino.me>
 */

const SPADES = 'S';
const DIAMONDS = 'D';
const CLUBS = 'C';
const HEARTS = 'H';
const SUITS = Object.freeze([SPADES, HEARTS, DIAMONDS, CLUBS]);
const VALUES = Object.freeze(
  ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K']
);
const SORTED_DECK = Object.freeze(
  [].concat.apply([], SUITS.map(s => VALUES.map(v => v + s)))
);

/**
 * Copy and shuffle the sorted deck using Fisher-Yates algorithm,
 * then return the shuffled deck.
 */
function getShuffledDeck() {
  let deck = SORTED_DECK.slice();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const x = deck[i];
    deck[i] = deck[j];
    deck[j] = x;
  }
  return deck;
}

/**
 * Utility functions
 */
function getValue(card) { return card[0]; }
function getSuit(card) { return card[1]; }
function isBlack(card) {
  const suit = getSuit(card);
  return suit === SPADES || suit === CLUBS;
}

function areDifferentColors(card1, card2) {
  return isBlack(card1) !== isBlack(card2);
}

// https://en.wikipedia.org/wiki/Playing_cards_in_Unicode
const UNICODE_FACE_DOWN = String.fromCodePoint(0x1f0a0);
function toUnicode(card) {
  const value = getValue(card);
  const suit = getSuit(card);
  const valueIndex = VALUES.indexOf(value);
  // Unicode has a "knight" card in between jack and queen,
  // which we have to skip over by adding 1 if card is greater
  // than jack
  return String.fromCodePoint({
    S: 0x1f0a1,
    H: 0x1f0b1,
    D: 0x1f0c1,
    C: 0x1f0d1,
  }[suit] + valueIndex + (valueIndex > 10 ? 1 : 0));
}

/**
 * Various ways you might want to switch up the rules, to remove magic
 * constants like number of cards drawn or tableau size.
 */
class Rules {
  constructor(drawSize = 3, tableauSize = 7) {
    this.drawSize = drawSize;
    this.tableauSize = tableauSize;
  }
}

/**
 * Encompasses any type of move that you can make in solitaire. These
 * are passed to the Solitaire.applyMove() function and are used by
 * the solver.
 *
 * Some types of moves like "draw" only require the move type to be
 * executed. Others require one or more indices from the tableau,
 * to the tableau, etc. These are documented by the static method
 * and are passed via the "extras" array.
 */
class Move {
  constructor(type, extras = []) {
    this.type = type;
    this.extras = extras;
  }

  static get DRAW() { return 1; }
  static get WASTE_TO_FOUNDATION() { return 2; }

  // extras = [dstCol]
  static get WASTE_TO_TABLEAU() { return 3; }

  // extras = [srcCol]
  static get TABLEAU_TO_FOUNDATION() { return 4; }

  // extras = [srcCol, srcRow, dstCol]
  static get TABLEAU_TO_TABLEAU() { return 5; }

  // extras = [suit, dstCol]
  static get FOUNDATION_TO_TABLEAU() { return 6; }
}

/**
 * Main class for initializing the game and applying moves.
 */
class Solitaire {
  constructor(rules = new Rules(), deck = getShuffledDeck()) {
    this.rules = Object.freeze(rules);

    // Foundation is the four suit piles on top of the table, they
    // start empty but are filled in with ace through king. Values
    // in this map are indices in the VALUES array, or -1 if empty.
    // Game ends when foundation is all kings.
    this.foundation = {'S': -1, 'D': -1, 'C': -1, 'H': -1};

    // Initialize hand (draw pile) and waste (face up cards that have
    // been drawn).
    this.hand = deck.slice();
    this.waste = [];

    // Initialize tableau, (typically 7) columns of cards with some face
    // down and the one on the bottom of each starting face up.
    this.tableau = [];
    for (let i = 0; i < this.rules.tableauSize; i++) {
      this.tableau.push({faceDown: [], faceUp: []});
    }
    for (let row = 0; row < this.rules.tableauSize; row++) {
      for (let column = row; column < this.rules.tableauSize; column++) {
        const card = this.hand.pop();
	if (row === column) {
	  this.tableau[column].faceUp.push(card);
	} else {
	  this.tableau[column].faceDown.push(card);
	}
      }
    }
  }

  /**
   * Return boolean whether the move could be applied.
   */
  isValid(move) {
    switch (move.type) {
    case Move.DRAW: {
      // If both hand and waste are empty this fails
      if (this.hand.length === 0 && this.waste.length === 0) {
        return false;
      }
      break;
    }
    case Move.WASTE_TO_FOUNDATION: {
      // Must have at least one card in waste
      if (this.waste.length === 0) {
        return false;
      }
      const card = this.waste[this.waste.length - 1];
      const suit = getSuit(card);
      const valueIndex = VALUES.indexOf(getValue(card));
      if (valueIndex !== this.foundation[suit] + 1) {
        return false;
      }
      break;
    }
    case Move.WASTE_TO_TABLEAU: {
      if (move.extras.length < 1) {
        return false;
      }
      const dstCol = move.extras[0];
      // Waste must have cards and dst must be in tableau range
      if (this.waste.length === 0 || dstCol < 0 ||
          dstCol >= this.tableau.length) {
        return false;
      }
      // If tableau is empty, waste card must be a king
      const column = this.tableau[dstCol];
      const srcCard = this.waste[this.waste.length - 1];
      if (column.faceUp.length === 0) {
        if (getValue(srcCard) !== VALUES[VALUES.length - 1]) {
          return false;
        }
      } else {
        // Src/dst cards must have opposite suits and values must be
        // descending
        const dstCard = column.faceUp[column.faceUp.length - 1];
        const srcValueIndex = VALUES.indexOf(getValue(srcCard));
        const dstValueIndex = VALUES.indexOf(getValue(dstCard));
        if (!areDifferentColors(srcCard, dstCard) ||
            srcValueIndex !== dstValueIndex - 1) {
          return false;
        }
      }
      break;
    }
    case Move.TABLEAU_TO_FOUNDATION: {
      if (move.extras.length < 1) {
        return false;
      }
      const srcCol = move.extras[0];
      // Tableau src index must be in range and that column must
      // contain at least one card
      if (srcCol < 0 || srcCol >= this.tableau.length ||
          this.tableau[srcCol].faceUp.length === 0) {
        return false;
      }
      // Card must be the next one to add to that suit's foundation
      const column = this.tableau[srcCol];
      const card = column.faceUp[column.faceUp.length - 1];
      const suit = getSuit(card);
      const valueIndex = VALUES.indexOf(getValue(card));
      if (valueIndex !== this.foundation[suit] + 1) {
        return false;
      }
      break;
    }
    case Move.TABLEAU_TO_TABLEAU: {
      if (move.extras.length < 3) {
        return false;
      }
      const srcCol = move.extras[0];
      const srcRow = move.extras[1];
      const dstCol = move.extras[2];
      // src/dst columns and srcRow must be in range
      if (srcCol < 0 || srcCol >= this.tableau.length ||
          dstCol < 0 || dstCol >= this.tableau.length ||
          srcRow < 0 || srcRow >= this.tableau[srcCol].faceUp.length) {
        return false;
      }
      // Source card must not be flipped over
      const srcCard = this.tableau[srcCol].faceUp[srcRow];
      // Source card can be king and destination can be a blank space
      if (this.tableau[dstCol].faceUp.length === 0) {
	if (getValue(srcCard) !== VALUES[VALUES.length - 1]) {
	  return false;
	}
      } else {
	// Otherwise source card must be opposite color
	// and one value lower than destination card
	const dstCard = this.tableau[dstCol].faceUp[this.tableau[dstCol].faceUp.length - 1];
	const srcValueIndex = VALUES.indexOf(getValue(srcCard));
	const dstValueIndex = VALUES.indexOf(getValue(dstCard));
	if (!areDifferentColors(srcCard, dstCard) ||
            srcValueIndex !== dstValueIndex - 1) {
          return false;
	}
      }
      break;
    }
    case Move.FOUNDATION_TO_TABLEAU: {
      if (move.extras.length < 2) {
	return false;
      }
      const suitIdx = move.extras[0];
      if (suitIdx < 0 || suitIdx >= SUITS.length) {
	return false;
      }
      const suit = SUITS[suitIdx];
      const dstColIdx = move.extras[1];
      if (this.foundation[suit] < 0 ||
	  dstColIdx < 0 || dstColIdx >= this.tableau.length ||
	  this.tableau[dstColIdx].faceUp.length === 0) {
	return false;
      }
      const dstCol = this.tableau[dstColIdx];
      const foundationCard = VALUES[this.foundation[suit]] + suit;
      const dstCard = dstCol.faceUp[dstCol.faceUp.length - 1];
      const srcValueIdx = VALUES.indexOf(getValue(foundationCard));
      const dstValueIdx = VALUES.indexOf(getValue(dstCard));
      if (!areDifferentColors(dstCard, foundationCard) ||
	  dstValueIdx !== srcValueIdx + 1) {
	console.log(dstCard, foundationCard, SUITS, this.foundation);
	return false;
      }
      break;
    }
    default:
      return false;
    }
    return true;
  }

  /**
   * Precondition that isValid(move) === true. Returns void.
   */
  applyMove(move) {
    switch (move.type) {
    case Move.DRAW: {
      // Move waste back to hand if hand is empty
      if (this.hand.length === 0 && this.waste.length > 0) {
        this.hand = this.waste.reverse();
        this.waste = [];
      }
      // Draw up to rules.drawSize cards and place in waste
      let cardsToDraw = this.rules.drawSize;
      while (cardsToDraw > 0 && this.hand.length > 0) {
        this.waste.push(this.hand.pop());
        cardsToDraw--;
      }
      break;
    }
    case Move.WASTE_TO_FOUNDATION: {
      const card = this.waste[this.waste.length - 1];
      const suit = getSuit(card);
      this.foundation[suit]++;
      this.waste.pop();
      break;
    }
    case Move.WASTE_TO_TABLEAU: {
      const dstCol = move.extras[0];
      let column = this.tableau[dstCol];
      const srcCard = this.waste[this.waste.length - 1];
      this.waste.pop();
      column.faceUp.push(srcCard);
      break;
    }
    case Move.TABLEAU_TO_FOUNDATION: {
      const srcCol = move.extras[0];
      let column = this.tableau[srcCol];
      const card = column.faceUp[column.faceUp.length - 1];
      const suit = getSuit(card);
      this.foundation[suit]++;
      this.tableau[srcCol].faceUp.pop();
      break;
    }
    case Move.TABLEAU_TO_TABLEAU: {
      const srcCol = move.extras[0];
      const srcRow = move.extras[1];
      const dstCol = move.extras[2];
      this.tableau[dstCol].faceUp = this.tableau[dstCol].faceUp.concat(
	this.tableau[srcCol].faceUp.slice(srcRow)
      );
      this.tableau[srcCol].faceUp = this.tableau[srcCol].faceUp.slice(0, srcRow);
      break;
    }
    case Move.FOUNDATION_TO_TABLEAU: {
      const suit = SUITS[move.extras[0]];
      const foundationCard = VALUES[this.foundation[suit]] + suit;
      let dstCol = this.tableau[move.extras[1]];
      dstCol.faceUp.push(foundationCard);
      this.foundation[suit]--;
      break;
    }
    }

    // Flip over any cards that have been exposed in the tableau
    for (let i = 0; i < this.tableau.length; i++) {
      let column = this.tableau[i];
      if (column.faceUp.length === 0 && column.faceDown.length !== 0) {
	column.faceUp.push(column.faceDown.pop());
      }
    }
  }

  /**
   * Game is technically won when the foundation is all kings, but we can
   * short circuit the solver algorithm and just call the game won when
   * there are no cards in the hand/waste and there are no face-down cards
   * on the tableau.
   */
  isWon() {
    if (this.hand.length > 0 || this.waste.length > 0) {
      return false;
    }
    for (let i = 0; i < this.tableau.length; i++) {
      if (this.tableau[i].faceDown.length > 0) {
	return false;
      }
    }
    return true;
  }

  /**
   * Solver needs to modify games, then backtrack. Simplest way to
   * do that is to make a copy.
   */
  clone() {
    let other = new Solitaire();
    other.rules = this.rules;
    other.foundation = {};
    SUITS.forEach(suit => other.foundation[suit] = this.foundation[suit]);
    other.hand = this.hand.slice();
    other.waste = this.waste.slice();
    other.tableau = [];
    this.tableau.forEach(col => other.tableau.push({
      faceDown: col.faceDown.slice(),
      faceUp: col.faceUp.slice(),
    }));
    return other;
  }

  /**
   * Return console-printable version of the game using unicode playing
   * card symbols.
   */
  toConsoleString() {
    const FACE_DOWN = '\u001b[31m';
    const RESET = '\u001b[0m';
    let ret = '';
    ret += this.hand.length > 0 ? UNICODE_FACE_DOWN + ' ' : '  ';
    ret += this.waste.length > 0 ?
      toUnicode(this.waste[this.waste.length - 1]) + ' ' : '  ';
    ret += '  '.repeat(this.rules.tableauSize - SUITS.length);
    SUITS.forEach(suit => {
      ret += this.foundation[suit] >= 0 ? toUnicode(
        VALUES[this.foundation[suit]] + suit
      ) + ' ' : '  ';
    });
    ret += '\n';
    const tableauHeight = Math.max.apply(
      Math, this.tableau.map(c => c.faceDown.length + c.faceUp.length)
    );
    for (let i = 0; i < tableauHeight; i++) {
      ret += '\n    ';
      for (let j = 0; j < this.tableau.length; j++) {
	const faceDownLength = this.tableau[j].faceDown.length;
	const faceUpLength = this.tableau[j].faceUp.length;
	if (i < faceDownLength) {
	  ret +=
	    FACE_DOWN + toUnicode(this.tableau[j].faceDown[i]) + RESET + ' ';
	} else if (i < faceDownLength + faceUpLength) {
	  ret += toUnicode(this.tableau[j].faceUp[i - faceDownLength]) + ' ';
	} else {
	  ret += '  ';
	}
      }
    }
    return ret;
  }
}

exports.SUITS = SUITS;
exports.VALUES = VALUES;
exports.getShuffledDeck = getShuffledDeck;
exports.Rules = Rules;
exports.Move = Move;
exports.Solitaire = Solitaire;
