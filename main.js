const solitaire = require('./solitaire.js');
const solve = require('./solve.js');

const readline = require('readline');

const rules = new solitaire.Rules(3);
const timeoutSeconds =
      process.argv.length > 2 ? parseInt(process.argv[2]) : 30;

let rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', line => {
  let deck = [];
  for (let i = 0; i < line.length; i += 2) {
    deck.push(line.slice(i, i + 2));
  }
  const game = new solitaire.Solitaire(rules, deck);
  const solver = new solve.Solver(game, timeoutSeconds * 1000);
  console.error('Attempting to solve:');
  console.error(game.toConsoleString());
  const winningMoves = solver.getWinningMoves();
  let status = null;
  if (winningMoves !== null) {
    status = 'win';
    for (let i = 0; i < winningMoves.length; i++) {
      if (!game.isValid(winningMoves[i])) {
	console.error(`Solver bug, solution was invalid at move ${i}`);
	console.error(`Game state and move attempted at move ${i}:`);
	console.error(game.toConsoleString());
	console.error(winningMoves[i]);
	break;
      }
      console.log(winningMoves[i]);
      console.log(game.toConsoleString());
      game.applyMove(winningMoves[i]);
    }
    console.log(game.toConsoleString());
    console.error(`Found solution in ${winningMoves.length} moves.`);
  } else if (solver.didTimeout) {
    status = 'timeout';
    console.error('Timed out, unknown if there is a solution');
  } else {
    status = 'lose';
    console.error('No solution.');
  }

  const result = {
    deck,
    status,
    winningMoves,
    movesConsidered: solver.calls,
    elapsedSeconds: (Date.now() - solver.startTimestamp) / 1000,
    timeoutSeconds,
    version: 'js',
  };
  console.log(JSON.stringify(result));
});
