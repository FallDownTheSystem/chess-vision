import { sleep, oppositeColor, opponentColor } from './helpers';
import { siteParser } from './parser';
import { position, replay, replayFen, gameState } from './game';
import { controlledSquares, drawControlledSquares } from './vision';
import { createOverlay, drawEvalBar, drawArrow, drawDepthSlider, drawECO } from './draw';
import { playMove, state } from './engine';
import { Shortcuts } from 'shortcuts';
import { eco } from './eco';

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

		gameState.overlaySelector = parser.getOverlay();
		gameState.mySide = parser.getSide();

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
				gameState.overlaySelector = parser.getOverlay();
			}

			// If the number of moves, the mySide or the size of the board changes, redraw all the things!
			if (
				gameState.triggerUpdate ||
				moves.length !== gameState.numOfMoves ||
				gameState.mySide !== parsedSide ||
				gameState.boardWidth !== width ||
				gameState.fen !== newFen ||
				state.triggerUpdate
			) {
				gameState.triggerUpdate = false;
				gameState.numOfMoves = moves.length;
				gameState.mySide = parsedSide;
				gameState.boardWidth = width;
				gameState.fen = newFen;
				if (gameState.numOfMoves) {
					replay(moves);
				} else if (gameState.fen) {
					replayFen(gameState.fen);
				}
				// Post position to the engine only if the engine didn't trigger the update
				if (!state.triggerUpdate) {
					playMove(position.fen(), depth);
				}

				createOverlay('cv-overlay', gameState.overlaySelector, gameState.mySide, parser.zIndex, false, false);
				let textOverlay = createOverlay('cv-overlay-text', gameState.overlaySelector, gameState.mySide, 99999, true, false);
				let overlayElement = createOverlay('cv-overlay-svg', gameState.overlaySelector, gameState.mySide, 10000, false, true);
				let positionFen = position.fen().slice(0, -4);
				if (positionFen in eco) {
					gameState.lastKnownPosition = eco[positionFen].name;
				}
				drawECO(textOverlay, 'cv-eco', gameState.lastKnownPosition);
				if (state.triggerUpdate) {
					// Eval bar should only be rendered if the engine updated its state
					drawEvalBar('cv-overlay', state.score, gameState.mySide, position.turn());
					if (gameState.drawDebug) {
						drawArrow(
							overlayElement,
							state.bestMove,
							opponentColor(position.turn(), gameState.mySide),
							gameState.boardWidth,
							gameState.mySide
						);
						drawArrow(
							overlayElement,
							state.ponder,
							opponentColor(oppositeColor(position.turn()), gameState.mySide),
							gameState.boardWidth,
							gameState.mySide
						);
						drawDepthSlider('cv-overlay', 'cv-depth', gameState.depth);

						document.getElementById('cv-depth').addEventListener('change', e => {
							depth = parseInt(e.target.value);
							console.log(gameState.depth);
						});
					}
				}

				state.triggerUpdate = false;

				if (gameState.numOfMoves || gameState.fen) {
					const squares = controlledSquares(position);
					drawControlledSquares(squares, gameState.mySide, gameState.drawDebug);
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
