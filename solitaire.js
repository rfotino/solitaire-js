/**
 * Classes for initializing and playing a game of solitaire.
 * @author Robert Fotino <robert@fotino.me>
 */

const SPADES = 'S';
const DIAMONDS = 'D';
const CLUBS = 'C';
const HEARTS = 'H';
const SUITS = Object.freeze([SPADES, DIAMONDS, CLUBS, HEARTS]);
const VALUES = Object.freeze(
  ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K']
);
const SORTED_DECK = Object.freeze(
  [].concat.apply([], SUITS.map(s => VALUES.map(v => v + s)))
);
const FACE_UP = 'U';
const FACE_DOWN = 'D';

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
function isFaceDown(card) {
  return card.length === 3 && card[2] === FACE_DOWN;
}
function toFaceUp(card) {
  return card.substring(0, 2) + FACE_UP;
}

function areDifferentColors(card1, card2) {
  return isBlack(card1) !== isBlack(card2);
}

// https://en.wikipedia.org/wiki/Playing_cards_in_Unicode
const UNICODE_FACE_DOWN = String.fromCodePoint(0x1f0a0);
function toUnicode(card) {
  if (isFaceDown(card)) {
    return UNICODE_FACE_DOWN;
  }
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

  static get DRAW() { return 'd'; }
  static get WASTE_TO_FOUNDATION() { return 'wf'; }

  // extras = [dstCol]
  static get WASTE_TO_TABLEAU() { return 'p'; }

  // extras = [srcCol]
  static get TABLEAU_TO_FOUNDATION() { return 'tf'; }

  // extras = [srcCol, srcRow, dstCol]
  static get TABLEAU_TO_TABLEAU() { return 'm'; }
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
      this.tableau.push([]);
    }
    for (let row = 0; row < this.rules.tableauSize; row++) {
      for (let column = row; column < this.rules.tableauSize; column++) {
        const card = this.hand.pop();
        this.tableau[column].push(
          card + (row === column ? FACE_UP : FACE_DOWN)
        );
      }
    }
  }

  /**
   * Return true if the move is valid and has been successfully applied,
   * false if the move is invalid.
   */
  applyMove(move) {
    switch (move.type) {
    case Move.DRAW: {
      if (move.extras.length !== 0) {
        return false;
      }
      // If both hand and waste are empty this fails
      if (this.hand.length === 0 && this.waste.length === 0) {
        return false;
      }
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
      if (move.extras.length !== 0) {
        return false;
      }
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
      // Suit and value are appropriate
      this.foundation[suit]++;
      this.waste.pop();
      break;
    }
    case Move.WASTE_TO_TABLEAU: {
      if (move.extras.length !== 1) {
        return false;
      }
      const dstCol = move.extras[0];
      // Waste must have cards and dst must be in tableau range
      if (this.waste.length === 0 || dstCol < 0 ||
          dstCol >= this.tableau.length) {
        return false;
      }
      // If tableau is empty, waste card must be a king
      let column = this.tableau[dstCol];
      const srcCard = this.waste[this.waste.length - 1];
      if (column.length === 0) {
        if (getValue(srcCard) !== VALUES[VALUES.length - 1]) {
          return false;
        }
        this.waste.pop();
        column.push(toFaceUp(srcCard));
      } else {
        // Src/dst cards must have opposite suits and values must be
        // descending
        const dstCard = column[column.length - 1];
        const srcValueIndex = VALUES.indexOf(getValue(srcCard));
        const dstValueIndex = VALUES.indexOf(getValue(dstCard));
        if (!areDifferentColors(srcCard, dstCard) ||
            srcValueIndex !== dstValueIndex - 1) {
          return false;
        }
        this.waste.pop();
        column.push(srcCard);
      }
      break;
    }
    case Move.TABLEAU_TO_FOUNDATION: {
      if (move.extras.length !== 1) {
        return false;
      }
      const srcCol = move.extras[0];
      // Tableau src index must be in range and that column must
      // contain at least one card
      if (srcCol < 0 || srcCol >= this.tableau.length ||
          this.tableau[srcCol].length === 0) {
        return false;
      }
      // Card must be the next one to add to that suit's foundation
      const column = this.tableau[srcCol];
      const card = column[column.length - 1];
      const suit = getSuit(card);
      const valueIndex = VALUES.indexOf(getValue(card));
      if (valueIndex !== this.foundation[suit] + 1) {
        return false;
      }
      // Suit and value are appropriate
      this.foundation[suit]++;
      this.tableau[srcCol].pop();
      break;
    }
    case Move.TABLEAU_TO_TABLEAU: {
      if (move.extras.length !== 3) {
        return false;
      }
      const srcCol = move.extras[0];
      const srcRow = move.extras[1];
      const dstCol = move.extras[2];
      // src/dst columns and srcRow must be in range
      if (srcCol < 0 || srcCol >= this.tableau.length ||
          dstCol < 0 || dstCol >= this.tableau.length ||
          srcRow < 0 || srcRow >= this.tableau[srcCol].length) {
        return false;
      }
      // Source card must not be flipped over
      const srcCard = this.tableau[srcCol][srcRow];
      if (isFaceDown(srcCard)) {
	return false;
      }
      // Source card can be king and destination can be a blank space
      if (this.tableau[dstCol].length === 0) {
	if (getValue(srcCard) !== VALUES[VALUES.length - 1]) {
	  return false;
	}
	this.tableau[dstCol] = this.tableau[srcCol].slice(srcRow);
	this.tableau[srcCol] = this.tableau[srcCol].slice(0, srcRow);
      } else {
	// Otherwise source card must be opposite color
	// and one value lower than destination card
	const dstCard = this.tableau[dstCol][this.tableau[dstCol].length - 1];
	const srcValueIndex = VALUES.indexOf(getValue(srcCard));
	const dstValueIndex = VALUES.indexOf(getValue(dstCard));
	if (!areDifferentColors(srcCard, dstCard) ||
            srcValueIndex !== dstValueIndex - 1) {
          return false;
	}
	this.tableau[dstCol] = this.tableau[dstCol].concat(
          this.tableau[srcCol].slice(srcRow)
	);
	this.tableau[srcCol] = this.tableau[srcCol].slice(0, srcRow);
      }
      break;
    }
    default:
      return false;
    }

    // Flip over any cards that have been exposed in the tableau
    for (let i = 0; i < this.tableau.length; i++) {
      let column = this.tableau[i];
      if (column.length === 0) {
        continue;
      }
      const card = column[column.length - 1];
      if (isFaceDown(card)) {
        column[column.length - 1] = toFaceUp(card);
      }
    }
    return true;
  }

  /**
   * Game is won when the tableau, hand, and waste are clear and the
   * foundation has kings on top. For simplicity we can just check the
   * foundation, assuming the game has been played without cheating.
   */
  isWon() {
    const kingValue = VALUES.length - 1;
    for (let i = 0; i < SUITS.length; i++) {
      const suit = SUITS[i];
      if (this.foundation[suit] !== kingValue) {
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
    this.tableau.forEach(col => other.tableau.push(col.slice()));
    return other;
  }

  /**
   * Return console-printable version of the game using unicode playing
   * card symbols.
   */
  toConsoleString() {
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
      Math, this.tableau.map(c => c.length)
    );
    for (let i = 0; i < tableauHeight; i++) {
      ret += '\n    ';
      for (let j = 0; j < this.tableau.length; j++) {
        ret += this.tableau[j].length > i ?
          toUnicode(this.tableau[j][i]) + ' ' : '  ';
      }
    }
    return ret;
  }
}

exports.Rules = Rules;
exports.Move = Move;
exports.Solitaire = Solitaire;
