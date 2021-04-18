import { sleep } from './helpers';
import { siteParser } from './parser';
import { position, replay, replayFen } from './game';
import { controlledSquares, drawControlledSquares } from './vision';
import { createOverlay, drawEvalBar } from './draw';
import { playMove, state } from './engine';

console.log('Script is running');

const main = async () => {
	try {
		const parser = siteParser(window.location.host);
		// Wait for the necessary elements for the parser before continuing
		console.log('Waiting for game');
		while (true) {
			if (parser.isReady()) {
				break;
			}
			await sleep(500);
		}

		let numOfMoves = -1;
		let mySide = parser.getSide();
		let boardSize = 0;
		let overlayElement = parser.getOverlay();
		let fen = null;
		let drawDebug = false;
		let triggerUpdate = true;
		let evalPercentage = 50;

		document.onkeypress = function (e) {
			if (e.key == 'n') {
				drawDebug = !drawDebug;
				triggerUpdate = true;
			}
		};

		console.log('Starting main loop');

		while (true) {
			await sleep(16.667);
			const parsedSide = parser.getSide();
			const moves = parser.parseMoves();
			let newFen = null;
			if (typeof parser.getFen !== 'undefined') {
				newFen = parser.getFen(parsedSide);
			}
			const width = overlayElement.clientWidth;

			if (width === 0) {
				overlayElement = parser.getOverlay();
			}

			// If the number of moves, the mySide or the size of the board changes, redraw all the things!
			if (
				triggerUpdate ||
				moves.length !== numOfMoves ||
				mySide !== parsedSide ||
				boardSize !== width ||
				fen !== newFen ||
				state.triggerUpdate
			) {
				triggerUpdate = false;
				numOfMoves = moves.length;
				mySide = parsedSide;
				boardSize = width;
				fen = newFen;
				if (numOfMoves) {
					replay(moves);
				} else if (fen) {
					replayFen(fen);
				}
				// Post position to the engine only if the engine didn't trigger the update
				if (!state.triggerUpdate) {
					playMove(position.fen(), 8);
				}

				createOverlay('cv-overlay', overlayElement, mySide, parser.zIndex, false);
				createOverlay('cv-overlay-text', overlayElement, mySide, 99999, true);

				// Eval bar should only be rendered if the engine updated its state
				if (state.triggerUpdate) {
					drawEvalBar('cv-overlay', state.score, mySide, position.turn());
				}

				state.triggerUpdate = false;

				if (numOfMoves || fen) {
					const squares = controlledSquares(position);
					drawControlledSquares(squares, mySide, drawDebug);
				} else {
					document.querySelector('#cv-overlay').style.border = '1px dashed hsl(140, 100%, 50%)';
				}
			}
		}
	} catch (e) {
		console.error(e);
	}
};

main();
