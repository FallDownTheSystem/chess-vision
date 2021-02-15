import { WHITE, BLACK, cleanse } from '../helpers';

// analysisSelector: '.analyse__tools',

export class LichessParser {
	constructor() {
		this.moveSelector =
			'.buttons + * > *:nth-child(3n-1), .buttons + * > *:nth-child(3n), move > san, .puzzle__moves move';
		this.sideSelector = '.orientation-white';
		this.overlaySelector = '.cg-wrap';
		this.gameSelector = '.rmoves, .tview2, .ruser';
		this.zIndex = '1';
	}

	parseMoves() {
		const moves = [...document.querySelectorAll(this.moveSelector)]
			.map((x) => cleanse(x.innerText))
			.filter((x) => x !== '');

		return moves;
	}

	getSide() {
		return document.querySelector(this.sideSelector) !== null ? WHITE : BLACK;
	}

	getOverlay() {
		return document.querySelector(this.overlaySelector);
	}

	isReady() {
		return document.querySelector(this.gameSelector) !== null && this.getOverlay() != null;
	}
}
