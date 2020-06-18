 const solitaire = require('./solitaire.js');
const lrucache = require('./lrucache.js');

const START_TIME = Date.now();
let totalMoves = 0;

class Solver {
  constructor(game, timeout, cacheSize = 1000000) {
    this.game = game;
    this.stateCache = new lrucache.LRUCache(cacheSize);
    this.startTimestamp = Date.now();
    this.tableauRevealingMoveCache = new Map();
    this.tableauNonrevealingMoveCache = new Map();
    this.calls = 0;
    this.tableauCacheHit = 0;
    this.tableauCacheMiss = 0;
    this.timeout = timeout;
    this.didTimeout = false;
  }

  getValidMoves(game) {
    const tableauCacheString = game.tableau.map(
      c => c.faceUp.join('')
    ).join('|');
    return [].concat.apply([], [
      this.getAceMoves(game),
      this.getMovesToFoundation(game),
      this.getCardRevealingMoves(game, tableauCacheString),
      this.getMovesWasteToTableau(game),
      this.getDrawMove(game),
      this.getMovesTableauToTableau(game, tableauCacheString),
    ]);
  }

  getAceMoves(game) {
    let ret = [];
    if (game.waste.length > 0 && game.waste[game.waste.length - 1][0] === 'A') {
      ret.push(new solitaire.Move(solitaire.Move.WASTE_TO_FOUNDATION));
    }
    for (let i = 0; i < game.tableau.length; i++) {
      const faceUpCards = game.tableau[i].faceUp;
      if (faceUpCards.length > 0 &&
	  faceUpCards[faceUpCards.length - 1][0] === 'A') {
	ret.push(new solitaire.Move(solitaire.Move.TABLEAU_TO_FOUNDATION, [i]));
      }
    }
    return ret;
  }

  getMovesToFoundation(game) {
    let ret = [];
    if (game.waste.length > 0 && game.waste[game.waste.length - 1][0] !== 'A') {
      const move = new solitaire.Move(solitaire.Move.WASTE_TO_FOUNDATION);
      if (game.isValid(move)) {
	ret.push(move);
      }
    }
    for (let i = 0; i < game.tableau.length; i++) {
      const faceUpCards = game.tableau[i].faceUp;
      if (faceUpCards.length > 0 &&
	  faceUpCards[faceUpCards.length - 1][0] !== 'A') {
	const move = new solitaire.Move(solitaire.Move.TABLEAU_TO_FOUNDATION, [i]);
	if (game.isValid(move)) {
	  ret.push(move);
	}
      }
    }
    return ret;
  }

  hasEmptySpace(tableau) {
    for (let i = 0; i < tableau.length; i++) {
      if (tableau[i].faceUp.length === 0) {
	return true;
      }
    }
    return false;
  }

  /**
   * Only tableau-to-tableau moves that reveal a card or an empty space.
   */
  getCardRevealingMoves(game, tableauCacheString = null) {
    // Often there are many cards face up on the tableau but only
    // a small number of legal moves. Cache the legal moves instead
    // of checking all of them every time
    if (this.tableauRevealingMoveCache.has(tableauCacheString)) {
      this.tableauCacheHit++;
      return this.tableauRevealingMoveCache.get(tableauCacheString);
    }
    this.tableauCacheMiss++;

    let ret = [];
    const needsKingSpace = !this.hasEmptySpace(game.tableau);
    for (let i = 0; i < game.tableau.length; i++) {
      if (game.tableau[i].faceUp.length > 0) {
	for (let j = 0; j < game.tableau.length; j++) {
	  if (i === j) {
	    continue;
	  }
	  const move = new solitaire.Move(
	    solitaire.Move.TABLEAU_TO_TABLEAU,
	    [i, 0, j]
	  );
	  if (game.isValid(move)) {
	    ret.push(move);
	  }
	}
      }
    }
    ret.sort((first, second) => {
      const firstFaceDownCount = game.tableau[first.extras[0]].faceDown.length;
      const secondFaceDownCount = game.tableau[second.extras[0]].faceDown.length;
      if (firstFaceDownCount !== secondFaceDownCount) {
	if (needsKingSpace) {
	  return firstFaceDownCount - secondFaceDownCount;
	} else {
	  return secondFaceDownCount - firstFaceDownCount;
	}
      } else {
	return first.extras[0] - second.extras[0];
      }
    });
    this.tableauRevealingMoveCache.set(tableauCacheString, ret);
    return ret;
  }

  getMovesWasteToTableau(game) {
    let ret = [];
    for (let i = 0; i < game.tableau.length; i++) {
      const move = new solitaire.Move(solitaire.Move.WASTE_TO_TABLEAU, [i]);
      if (game.isValid(move)) {
	ret.push(move);
      }
    }
    return ret;
  }

  getDrawMove(game) {
    const move = new solitaire.Move(solitaire.Move.DRAW);
    if (game.isValid(move)) {
      return [move];
    } else {
      return [];
    }
  }

  /**
   * Tableau to tableau moves that don't reveal a card
   */
  getMovesTableauToTableau(game, tableauCacheString = null) {
    // Often there are many cards face up on the tableau but only
    // a small number of legal moves. Cache the legal moves instead
    // of checking all of them every time
    if (this.tableauNonrevealingMoveCache.has(tableauCacheString)) {
      this.tableauCacheHit++;
      return this.tableauNonrevealingMoveCache.get(tableauCacheString);
    }
    this.tableauCacheMiss;

    let ret = [];
    for (let i = 0; i < game.tableau.length; i++) {
      const srcFaceUp = game.tableau[i].faceUp;
      for (let j = 1; j < srcFaceUp.length; j++) {
	for (let k = 0; k < game.tableau.length; k++) {
	  if (i === k) {
	    continue;
	  }
	  const move = new solitaire.Move(
	    solitaire.Move.TABLEAU_TO_TABLEAU,
	    [i, j, k]
	  );
	  if (game.isValid(move)) {
	    ret.push(move);
	  }
	}
      }
    }
    this.tableauNonrevealingMoveCache.set(tableauCacheString, ret);
    return ret;
  }

  /**
   * Return a string that uniquely identifies a game state, cached
   * for branch pruning when we come across a state we've seen before.
   * Tableau columns are sorted so that games with tableau columns
   * moved around still count as the same game.
   *
   * The length of this string is around ~100 bytes, which could be
   * halved to ~50 bytes by bit packing. But it is all ASCII-printable
   * for now to aid diagnostics. The naive JSON-serializing of a game
   * state is around ~500 bytes.
   */
  getGameStateId(game, canFlipDeck) {
    const separator = '|';
    let accessibleDrawCards = new Set();
    if (game.waste.length > 0){
      accessibleDrawCards.add(game.waste[game.waste.length - 1]);
    }
    const newDeck = game.waste.slice().reverse().concat(game.hand);
    for (let i = newDeck.length - game.rules.drawSize;
	 i >= 0; i -= game.rules.drawSize) {
      accessibleDrawCards.add(newDeck[i]);
    }
    if (newDeck.length > 0) {
      accessibleDrawCards.add(newDeck[0]);
    }
    return [
      canFlipDeck ? '1' : '0',
      game.waste.length > 0 ? game.waste[game.waste.length - 1] : '',
      Array.from(accessibleDrawCards).join(''),
      solitaire.SUITS.map(s => game.foundation[s] + 1).join(','),
      game.tableau.map((col, index) => {
	if (col.faceDown.length > 0) {
	  return '' + index + col.faceDown.length + col.faceUp.join('');
	} else {
	  return col.faceUp.join('');
	}
      }).sort().join(','),
    ].join(separator);
  }

  /**
   * Corecursive with getWinningMoves(), this is to make it cleaner to
   * keep track of modifications we've made to seenCardStacks and other
   * variables so that we can revert them if we backtrack.
   */
  maybeApplyMove(move, game, seenCardStacks, canFlipDeck, depth) {
    // If you draw through the entire deck without playing from the
    // waste, you can't flip the deck and continue to draw. If the hand
    // length is zero and the move is draw we're about to flip the deck.
    // This prevents loops between moving things around on the tableau
    // and endlessly flipping through the deck.
    if (move.type === solitaire.Move.DRAW) {
      if (game.hand.length === 0) {
	if (canFlipDeck) {
	  canFlipDeck = false;
	} else {
	  return null;
	}
      }
    } else if (move.type === solitaire.Move.WASTE_TO_FOUNDATION ||
	       move.type === solitaire.Move.WASTE_TO_TABLEAU) {
      canFlipDeck = true;
    }
    // If we're doing something other than drawing, we can flip the deck
    let clonedGame = game.clone();
    clonedGame.applyMove(move);
    // Check for recreated stack loops on the tableau
    let newStacks = [];
    if (move.type === solitaire.Move.TABLEAU_TO_TABLEAU) {
      const newSrcStack = clonedGame.tableau[move.extras[0]].faceUp.join('');
      const newDstStack = clonedGame.tableau[move.extras[2]].faceUp.join('');
      if (seenCardStacks.has(newSrcStack) && seenCardStacks.has(newDstStack)) {
	return null;
      }
      newStacks.push(newSrcStack);
      newStacks.push(newDstStack);
    }
    for (let i = 0; i < newStacks.length; i++) {
      seenCardStacks.add(newStacks[i]);
    }
    // Recurse one move further
    const winningMoves = this.getWinningMoves(
      clonedGame, seenCardStacks, canFlipDeck, depth + 1);
    if (winningMoves !== null) {
      return winningMoves;
    }
    // Move was unsuccessful, undo changes made by applying this move
    for (let i = 0; i < newStacks.length; i++) {
      seenCardStacks.delete(newStacks[i]);
    }
    return null;
  }

  /**
   * Main entry point for the solver, corecursive with maybeApplyMove(). Returns
   * a list of winning moves if a solution is found, otherwise returns null.
   */
  getWinningMoves(
    game = this.game,
    seenCardStacks = new Set(),
    canFlipDeck = false,
    depth = 0
  ) {
    const elapsedTimeMs = Date.now() - this.startTimestamp;
    if (this.timeout < elapsedTimeMs) {
      this.didTimeout = true;
      return null;
    }

    // Recursion base case
    if (game.isWon()) {
      return [];
    }

    // Short circuit if we've seen this game state before
    const gameStateId = this.getGameStateId(game, canFlipDeck);
    if (this.stateCache.has(gameStateId)) {
      return null;
    }
    this.stateCache.add(gameStateId);

    // Print out diagnostic info every so often
    this.calls++;
    totalMoves++;
    if (this.calls % 5000 === 0) {
      console.error(`moves/sec: ${this.calls / (elapsedTimeMs / 1000)}`);
      console.error(`calls: ${this.calls}`);
      console.error(`cache: ${this.stateCache.size}`);
      console.error(`depth: ${depth}`);
      console.error(`time spent: ${elapsedTimeMs / 1000} seconds`);
      console.error(`hit rate: ${this.tableauCacheHit / (this.tableauCacheHit + this.tableauCacheMiss)}`);
      console.error(`tableau move cache size: ${this.tableauRevealingMoveCache.size}`);
      console.error(game.toConsoleString());
    }

    const moves = this.getValidMoves(game);
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      let remainingMoves = this.maybeApplyMove(
	move, game, seenCardStacks, canFlipDeck, depth);
      if (remainingMoves !== null) {
	remainingMoves.unshift(move);
	return remainingMoves;
      }
    }
    return null;
  }
}

exports.Solver = Solver;
