# Chess vision!

**Tested on Greasemonkey of Firefox or Violentmonkey on Chrome**  
*Firefox only works with Greasemonkey, as they bypass CSP.*

A userscript that shows attacked and defended squares on.

- Squares controlled by the opponent are marked as red.
- Squares controlled by you are marked as green.
- Squares controlled by both are marked either red or green, depending on who wins if the pieces are traded.
- Squares controlled equally by both are marked as blue.

Each square has four numbers on it.

- Top left is the number of your attackers against that square.
- Top right is the number of the opponents attackers against that square.
- Bottom left is the value of your attackers.
- Bottom right is the value your opponents attackers.

The colors are not directly correlated with the numbers.

This script does not take tactics into consideration, e.g. forks, pins, skewers, etc. But it will look through your attackers, to see if you have more pieces lined up. e.g. doubled rooks, etc. It will also consider that your attacker can't move if it's pinned to the king. But only absolute pins are considered.

This is not a bot, or an engine, it does not play for you, it does not tell you the best move, or any move. It simply helps you visualize the board, so you can see how the squares are controlled.

## Development
The userscript is bundled together with rollup.js, using meta.json for the userscript meta tags.

You can see the commands in package.json

I use pnpm, but you can replace those with npm/yarn if you prefer.

To add sites, add another parser (see the parse folder for examples),
add the approriate DOM selectors and zIndex (so that the drawn overlay is on top of the board) and it'll likely work without much tweaking. Remember to add the new parser to the `siteParser` function in parser/index.js, where the key is the `window.location.host`.