import { WHITE, BLACK, cleanse } from '../helpers';

// analysisSelector: '.analyse__tools',

const parseFideSAN = (x) => {
	let innerText = x.innerText;
	if (innerText.includes('0-0')) {
		innerText = innerText.replace(/0/g, 'O');
	}
	const img = x.querySelector('img');
	if (img == null) {
		return innerText;
	}
	const src = img.src.split('/');
	const piece = src[src.length - 1].replace('.svg', '').split('')[1];
	return piece === 'P' ? innerText : piece + innerText;
};

export class FideArenaParser {
	constructor() {
		this.moveSelector = '.notifications__move';
		this.sideSelector = '.orientation-white';
		this.overlaySelector = '.cg-board';
		this.gameSelector = '.notifications__table';
		this.zIndex = '101';
	}

	parseMoves() {
		const moves = [...document.querySelectorAll(this.moveSelector)]
			.map((x) => cleanse(parseFideSAN(x)))
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
