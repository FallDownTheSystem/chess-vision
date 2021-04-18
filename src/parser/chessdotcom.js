import { WHITE, BLACK, cleanse, getFiles, getRanks } from '../helpers';

// analysisSelector: '.with-analysis, .with-analysis-collapsed',

export class ChessDotComParser {
	constructor() {
		this.zIndex = '0';
	}

	parseMoves() {
		const moves = [...document.querySelectorAll('.move .node, .move-list-controls-move, .move-text-component')]
			.map((x) => cleanse(x.innerText))
			.filter((x) => x !== '');

		return moves;
	}

	getSide() {
		return document.querySelector('.clock-black .main-clock-bottom, .layout-bottom-player .move-time-dark, .board.flipped') !== null
			? BLACK
			: WHITE;
	}

	getOverlay() {
		return document.querySelector('chess-board.board, .board-layout-chessboard');
	}

	isReady() {
		return this.getOverlay() != null;
	}

	getFen(side) {
		let files = getFiles();
		let ranks = getRanks();
		let pieces = [...document.querySelectorAll('chess-board .piece')];
		let occupiedSquares = {};

		if (!pieces.length) {
			return null;
		}

		for (const pieceElement of pieces) {
			let classes = [...pieceElement.classList];

			let coloredPiece = classes.filter((x) => x.includes('w') || x.includes('b'))[0].split('');
			let color = coloredPiece[0];
			let piece = coloredPiece[1];
			if (color === 'w') {
				piece = piece.toUpperCase();
			}

			let position = classes.filter((x) => x.includes('square'))[0].split('-')[1];
			let file = files[position[0] - 1];
			let rank = position[1];
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
