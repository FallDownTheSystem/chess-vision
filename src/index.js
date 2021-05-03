import { sleep, oppositeColor, opponentColor } from './helpers';
import { siteParser } from './parser';
import { position, replay, replayFen, gameState } from './game';
import { controlledSquares, drawControlledSquares } from './vision';
import { createOverlay, drawEvalBar, drawArrow, drawSlider, drawECO, drawSquare, drawTextBelow } from './draw';
import { playMove, state, stockfish } from './engine';
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
					gameState.drawDebug = !gameState.drawDebug;
					gameState.triggerUpdate = true;
				},
			},
		]);

		shortcuts.add([
			{
				shortcut: 'C C C E E E',
				handler: () => {
					gameState.drawCheat = !gameState.drawCheat;
					gameState.triggerUpdate = true;
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
			const width = gameState.overlaySelector.clientWidth;

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
					playMove(position.fen(), gameState.depth);
				}

				createOverlay('cv-overlay', gameState.overlaySelector, gameState.mySide, parser.zIndex, false, false);
				let textOverlay = createOverlay('cv-overlay-text', gameState.overlaySelector, gameState.mySide, 99999, true, false);
				let overlayElement = createOverlay('cv-overlay-svg', gameState.overlaySelector, gameState.mySide, 10000, false, true);
				let positionFen = position.fen().slice(0, -4);
				if (positionFen in eco) {
					gameState.lastKnownPosition = eco[positionFen].name;
				}
				drawECO(textOverlay, 'cv-eco', gameState.lastKnownPosition);

				if (gameState.numOfMoves || gameState.fen) {
					const squares = controlledSquares(position);
					drawControlledSquares(squares, gameState.mySide, gameState.drawDebug);
				} else {
					document.querySelector('#cv-overlay').style.border = '1px dashed hsl(140, 100%, 50%)';
				}

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
						drawSlider('cv-overlay', 'cv-depth', gameState.depth, 1, 16, 'calc(30% - 60px)');
						drawTextBelow('cv-overlay', 'cv-depth-text', 'calc(30% - 60px)', `Depth ${gameState.depth}`);

						document.getElementById('cv-depth').addEventListener('change', e => {
							gameState.depth = parseInt(e.target.value);
							console.log('Depth: ' + gameState.depth);
							localStorage.setItem('cv-depth', gameState.depth.toString());
							gameState.triggerUpdate = true;
						});
					}

					if (gameState.drawCheat) {
						for (var square of Object.values(state.multiPVSquares)) {
							//hsl(280, 100%, 50%)
							let color = 'hsl(280, 100%, 50%';
							drawSquare(square.slice(0, 2), { border: `2px solid ${color}, 1)` });
						}

						drawSlider('cv-overlay', 'cv-depth', gameState.depth, 1, 16, 'calc(30% - 60px)');
						drawTextBelow('cv-overlay', 'cv-depth-text', 'calc(30% - 60px)', `Depth ${gameState.depth}`);

						document.getElementById('cv-depth').addEventListener('change', e => {
							gameState.depth = parseInt(e.target.value);
							console.log('Depth: ' + gameState.depth);
							localStorage.setItem('cv-depth', gameState.depth.toString());
							gameState.triggerUpdate = true;
						});

						drawSlider('cv-overlay', 'cv-multi-pv', state.multiPV, 1, 6, 'calc(70% - 60px)');
						drawTextBelow('cv-overlay', 'cv-multi-pv-text', 'calc(70% - 60px)', `Multi PV ${state.multiPV}`);

						document.getElementById('cv-multi-pv').addEventListener('change', e => {
							state.multiPV = parseInt(e.target.value);
							stockfish.postMessage('setoption name MultiPV value ' + state.multiPV);
							stockfish.postMessage('isready');
							console.log('MultiPV: ' + state.multiPV);
							localStorage.setItem('cv-multi-pv', state.multiPV.toString());
							gameState.triggerUpdate = true;
						});
					}
				}

				state.triggerUpdate = false;
			}
		}
	} catch (e) {
		console.error(e);
	}
};

main();
