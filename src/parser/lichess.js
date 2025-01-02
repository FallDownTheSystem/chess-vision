import { WHITE, BLACK, cleanse, getFiles, getRanks } from '../helpers';

// analysisSelector: '.analyse__tools',

export class LichessParser {
	constructor() {
		this.moveSelector = '.buttons + * > *:nth-child(3n-1), .buttons + * > *:nth-child(3n), move > san, .puzzle__moves move, kwdb';
		this.sideSelector = '.orientation-white';
		this.overlaySelector = 'cg-board';
		this.gameSelector = 'cg-board';
		this.zIndex = '1';
	}

	parseMoves() {
		const moves = [...document.querySelectorAll(this.moveSelector)].map(x => cleanse(x.innerText)).filter(x => x !== '');

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

	getFen(side) {
		let files = getFiles();
		let ranks = getRanks();

		if (side === WHITE) {
			ranks.reverse();
		} else {
			files.reverse();
		}

		let pieces = [...document.querySelectorAll('cg-board piece')];
		let occupiedSquares = {};

		const pieceMap = {
			king: 'k',
			queen: 'q',
			rook: 'r',
			bishop: 'b',
			knight: 'n',
			pawn: 'p',
		};

		if (!pieces.length) {
			return null;
		}

		for (const pieceElement of pieces) {
			let classes = [...pieceElement.classList];

			if (classes.includes('dragging')) {
				return null;
			}

			let color = classes.includes('black') ? BLACK : WHITE;
			let piece = classes.filter(x => x != 'white' && x != 'black')[0];
			piece = pieceMap[piece];
			if (color === WHITE) {
				piece = piece.toUpperCase();
			}

			let squareSize = document.querySelector('cg-board').clientWidth / 8;
			let position = pieceElement.style.transform;
			let [x, y] = position.replace('translate(', '').replace(')', '').replaceAll('px', '').split(', ');
			x = Math.round(x / squareSize);
			y = Math.round(y / squareSize);
			let file = files[x];
			let rank = ranks[y];
			let square = file + rank;
			occupiedSquares[square] = piece;
		}

		// Castling rules
		let castles = [];

		if ('e1' in occupiedSquares && occupiedSquares['e1'] == 'K') {
			if ('a1' in occupiedSquares && occupiedSquares['a1'] == 'R') {
				castles.push('K');
			}
			if ('h1' in occupiedSquares && occupiedSquares['h1'] == 'R') {
				castles.push('Q');
			}
		}

		if ('e8' in occupiedSquares && occupiedSquares['e1'] == 'k') {
			if ('a8' in occupiedSquares && occupiedSquares['a8'] == 'r') {
				castles.push('q');
			}
			if ('h8' in occupiedSquares && occupiedSquares['h8'] == 'r') {
				castles.push('k');
			}
		}

		let fen = [];

		files = getFiles();
		ranks = getRanks();

		for (const r of ranks.reverse()) {
			let empty = 0;
			let row = '';
			for (const f of files) {
				const square = f + r;
				if (square in occupiedSquares) {
					if (empty > 0) {
						row += empty.toString();
						empty = 0;
					}
					row += occupiedSquares[square];
				} else {
					empty++;
				}
			}
			if (empty > 0) {
				row += empty.toString();
				empty = 0;
			}
			fen.push(row);
		}
		fen = fen.join('/');
		fen += ` ${side} ${castles.join('') || '-'} - 0 1`;

		return fen;
	}
}
