# Solitaire Solver

This is a brute force solitaire solver written in JavaScript, running on
node.js. It does some branch pruning but is not optimized very well -
I have since ported it to C++ with no dynamic memory allocations where
it runs at least 25x faster.

You can run `node generate.js N > outfile` to generate a file of `N`
random shuffles. You can then run the solver against these shuffles with
`cat outfile | node main.js [timeout]` where `timeout` is in seconds,
if you want to adjust the max time to search per game. Diagnostic info
like current game states are written to stderr while a JSON blob
containing structured information about time elapsed, moves attempted,
the set of winning moves, etc will be written to stdout after each solve.

More information can be found in
[the C++ version's README](https://github.com/rfotino/solitaire-cpp).