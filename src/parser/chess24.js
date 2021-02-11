import { WHITE, BLACK, cleanse } from '../helpers';

// analysisSelector: '.with-analysis',

export class Chess24Parser {
	constructor() {
		this.moveSelector = '.move';
		this.sideSelector = '.bottom .playerInfo.black';
		this.overlaySelector = '.chess-board > .svg';
		this.gameSelector = '.Moves';
		this.zIndex = '10';
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
