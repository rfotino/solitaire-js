/**
 * Script to generate many shuffled decks to be played as solitaire
 * games. Writes each shuffle as a single line of 104 characters (2
 * characters per card with no separator) to stdout.
 *
 * A command line argument can be passed to control the number of shuffles
 * output.
 *
 * @author Robert Fotino <robert@fotino.me>
 */

const solitaire = require('./solitaire.js');

let numGames = 100;
if (process.argv.length > 2) {
  numGames = parseInt(process.argv[2]);
}

while (numGames > 0) {
  numGames--;
  console.log(solitaire.getShuffledDeck().join(''));
}
