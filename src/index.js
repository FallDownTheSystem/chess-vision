import { sleep } from './helpers';
import { siteParser } from './parser';
import { position, replay } from './game';
import { controlledSquares, drawControlledSquares } from './vision';
import { createOverlay } from './draw';

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
		console.log('Starting main loop');

		while (true) {
			await sleep(16.667);
			const parsedSide = parser.getSide();
			const moves = parser.parseMoves();
			const width = overlayElement.clientWidth;

			if (width === 0) {
				overlayElement = parser.getOverlay();
			}

			// If the number of moves, the mySide or the size of the board changes, redraw all the things!
			if (moves.length !== numOfMoves || mySide !== parsedSide || boardSize !== width) {
				numOfMoves = moves.length;
				mySide = parsedSide;
				boardSize = width;

				replay(moves);

				createOverlay('cv-overlay', overlayElement, mySide, parser.zIndex, false);
				createOverlay('cv-overlay-text', overlayElement, mySide, 99999, true);
				const squares = controlledSquares(position);
				drawControlledSquares(squares, mySide);
			}
		}
	} catch (e) {
		console.error(e);
	}
};

main();
