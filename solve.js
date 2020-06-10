const solitaire = require('./solitaire.js');

class Solver {
  constructor(game) {
    this.game = game;
    this.seenStates = new Set();
  }

  getWinningMoves(game = this.game, depth = 0) {
    // Base case for recursion
    if (game.isWon()) {
      return [];
    }

    // Short circuit if we've hit a cycle - this could be because
    // there are no more moves on the board, so the solver is just
    // cycling through draws. Alternatively this prevents moving
    // from tableau to tableau back and forth.
    const gameJSON = JSON.stringify(game);
    if (this.seenStates.has(gameJSON)) {
      return null;
    }
    this.seenStates.add(gameJSON);

    // Go through all "possible" moves (these moves may not be
    // valid - the game code will return false upon attempting
    // to apply an invalid move, and we will continue).
    const possibleMoves = this.getPossibleMoves(game);
    let clonedGame = game.clone();
    for (let i = 0; i < possibleMoves.length; i++) {
      const tryMove = possibleMoves[i];
      if (clonedGame.applyMove(tryMove)) {
	let remainingMoves = this.getWinningMoves(clonedGame, depth + 1);
	if (remainingMoves !== null) {
	  remainingMoves.unshift(tryMove);
	  return remainingMoves;
	} else {
	  clonedGame = game.clone();
	}
      }
    }
    return null;
  }

  getPossibleMoves(game) {
    let moves = [];
    for (let i = 0; i < game.tableau.length; i++) {
      moves.push(new solitaire.Move(solitaire.Move.WASTE_TO_TABLEAU, [i]));
      moves.push(new solitaire.Move(solitaire.Move.TABLEAU_TO_FOUNDATION, [i]));
      for (let j = 0; j < game.tableau[i].length; j++) {
	for (let k = 0; k < game.tableau.length; k++) {
	  moves.push(new solitaire.Move(
	    solitaire.Move.TABLEAU_TO_TABLEAU,
	    [i, j, k]
	  ));
	}
      }
    }
    moves.push(new solitaire.Move(solitaire.Move.WASTE_TO_FOUNDATION));
    moves.push(new solitaire.Move(solitaire.Move.DRAW));
    return moves;
  }
}

exports.Solver = Solver;
