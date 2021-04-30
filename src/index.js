import { sleep, oppositeColor, opponentColor } from './helpers';
import { siteParser } from './parser';
import { position, replay, replayFen } from './game';
import { controlledSquares, drawControlledSquares } from './vision';
import { createOverlay, drawEvalBar, drawArrow, drawDepthSlider, drawECO } from './draw';
import { playMove, state } from './engine';
import { Shortcuts } from 'shortcuts';
import { eco } from './eco';

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
		let boardWidth = 0;
		let overlaySelector = parser.getOverlay();
		let fen = null;
		let drawDebug = false;
		let triggerUpdate = true;
		let depth = 8;
		let lastKnownPosition = '';

		const shortcuts = new Shortcuts();

		shortcuts.add([
			{
				shortcut: 'D E B U G',
				handler: () => {
					drawDebug = !drawDebug;
					triggerUpdate = true;
				},
			},
		]);

		console.log('Starting main loop');

		while (true) {
			await sleep(16.667);
			const parsedSide = parser.getSide();
			const moves = parser.parseMoves();
			let newFen = null;
			if (typeof parser.getFen !== 'undefined') {
				newFen = parser.getFen(parsedSide);
			}
			const width = overlaySelector.clientWidth;

			if (width === 0) {
				overlaySelector = parser.getOverlay();
			}

			// If the number of moves, the mySide or the size of the board changes, redraw all the things!
			if (
				triggerUpdate ||
				moves.length !== numOfMoves ||
				mySide !== parsedSide ||
				boardWidth !== width ||
				fen !== newFen ||
				state.triggerUpdate
			) {
				triggerUpdate = false;
				numOfMoves = moves.length;
				mySide = parsedSide;
				boardWidth = width;
				fen = newFen;
				if (numOfMoves) {
					replay(moves);
				} else if (fen) {
					replayFen(fen);
				}
				// Post position to the engine only if the engine didn't trigger the update
				if (!state.triggerUpdate) {
					playMove(position.fen(), depth);
				}

				createOverlay('cv-overlay', overlaySelector, mySide, parser.zIndex, false, false);
				let textOverlay = createOverlay('cv-overlay-text', overlaySelector, mySide, 99999, true, false);
				let overlayElement = createOverlay('cv-overlay-svg', overlaySelector, mySide, 10000, false, true);
				let positionFen = position.fen().slice(0, -4);
				if (positionFen in eco) {
					lastKnownPosition = eco[positionFen].name;
				}
				drawECO(textOverlay, 'cv-eco', lastKnownPosition);
				if (state.triggerUpdate) {
					// Eval bar should only be rendered if the engine updated its state
					drawEvalBar('cv-overlay', state.score, mySide, position.turn());
					if (drawDebug) {
						drawArrow(overlayElement, state.bestMove, opponentColor(position.turn(), mySide), width, mySide);
						drawArrow(overlayElement, state.ponder, opponentColor(oppositeColor(position.turn()), mySide), width, mySide);
						drawDepthSlider('cv-overlay', 'cv-depth', depth);

						document.getElementById('cv-depth').addEventListener('change', e => {
							depth = parseInt(e.target.value);
							console.log(depth);
						});
					}
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
