import { WHITE, BLACK, cleanse } from '../helpers';

export class ChessArenaParser {
	constructor() {
		this.moveContainerSelector = '[data-component="GameLayoutDashboardNotation"]';
		this.moveButtonSelector = 'button[id^="move_"]';
		this.whiteSideSelector = '[data-component="WhiteSideIcon"]';
		this.blackSideSelector = '[data-component="BlackSideIcon"]';
		this.overlaySelector = 'cg-board';
		this.gameSelector = '[data-component="GameLayoutDashboardNotation"]';
		this.zIndex = '101';
	}

	parseMoves() {
		const moves = [...document.querySelectorAll(`${this.moveContainerSelector} ${this.moveButtonSelector}`)]
			.map(moveBtn => {
				// First check if it's a castling move
				const castleText = moveBtn.children[0]?.textContent;
				if (castleText === 'O-O' || castleText === 'O-O-O') {
					return cleanse(castleText);
				}

				// Otherwise process normal piece moves
				const moveTextDiv = moveBtn.children[1];
				const moveText = moveTextDiv?.textContent;
				const pieceDiv = moveBtn.querySelector('[data-component="Chesspiece"]');
				const pieceType = pieceDiv?.getAttribute('data-type');

				let piece = '';
				if (pieceType) {
					const basicPiece = pieceType.replace(/Chesspiece|Stoke|Stroke/g, '');
					switch (basicPiece) {
						case 'Knight': piece = 'N'; break;
						case 'Bishop': piece = 'B'; break;
						case 'Rook': piece = 'R'; break;
						case 'Queen': piece = 'Q'; break;
						case 'King': piece = 'K'; break;
						case 'Pawn': piece = ''; break;
					}
				}

				return cleanse(piece + moveText);
			})
			.filter(x => x !== '');

		return moves;
	}

	getSide() {
		const whiteIcon = document.querySelector(this.whiteSideSelector);
		const blackIcon = document.querySelector(this.blackSideSelector);

		if (!whiteIcon || !blackIcon) {
			return WHITE;
		}

		const comparison = whiteIcon.compareDocumentPosition(blackIcon);

		if (comparison & Node.DOCUMENT_POSITION_FOLLOWING) {
			return BLACK;
		} else {
			return WHITE;
		}
	}

	getOverlay() {
		return document.querySelector(this.overlaySelector);
	}

	isReady() {
		return document.querySelector(this.gameSelector) !== null && this.getOverlay() != null;
	}
}