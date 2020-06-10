const solitaire = require('./solitaire.js');
const readline = require('readline');

const game = new solitaire.Solitaire();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
function prompt(inputStr) {
  const inputArr = inputStr.split(' ');
  if (inputArr.length !== 0) {
    const moveType = inputArr[0];
    const moveExtras = inputArr.slice(1).map(s => Number(s));
    if (game.applyMove(new solitaire.Move(moveType, moveExtras))) {
      console.log(game.toConsoleString());
    }
  }
  rl.question('> ', prompt);
}

console.log(game.toConsoleString());
rl.question('> ', prompt);
