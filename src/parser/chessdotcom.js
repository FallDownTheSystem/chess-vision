import { WHITE, BLACK, cleanse } from '../helpers';

// analysisSelector: '.with-analysis, .with-analysis-collapsed',

export class ChessDotComParser {
	constructor() {
		this.moveSelector = '.move .node, .move-list-controls-move';
		this.sideSelector = '.clock-bottom.clock-black, .board.flipped';
		this.overlaySelector = 'chess-board.board, .board-layout-chessboard';
		this.gameSelector = '.computer-move-list, .move-list-component, .move-list-controls-component';
		this.zIndex = '0';
	}

	parseMoves() {
		const moves = [...document.querySelectorAll(this.moveSelector)]
			.map((x) => cleanse(x.innerText))
			.filter((x) => x !== '');

		return moves;
	}

	getSide() {
		return document.querySelector(this.sideSelector) !== null ? BLACK : WHITE;
	}

	getOverlay() {
		return document.querySelector(this.overlaySelector);
	}

	isReady() {
		return document.querySelector(this.gameSelector) !== null && this.getOverlay() != null;
	}
}
