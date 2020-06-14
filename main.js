const solitaire = require('./solitaire.js');
const solve = require('./solve.js');
const readline = require('readline');

const game = new solitaire.Solitaire(new solitaire.Rules(3));
const solver = new solve.Solver(game);
console.log('Attempting to solve:');
console.log(game.toConsoleString());
const winningMoves = solver.getWinningMoves();
if (winningMoves !== null) {
  // Verify solution
  for (let i = 0; i < winningMoves.length; i++) {
    if (!game.isValidMove(winningMoves[i])) {
      console.log(`Solver bug, solution was invalid at move ${i}`);
      console.log(`Game state and move attempted at move ${i}:`);
      console.log(game.toConsoleString());
      console.log(winningMoves[i]);
      break;
    }
    game.applyMove(winningMoves[i]);
  }
  console.log(`Found solution in ${winningMoves.length} moves.`);
} else {
  console.log('No solution.');
}
