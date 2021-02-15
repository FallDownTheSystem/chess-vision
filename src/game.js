import { WHITE, BLACK } from './helpers';
import kokopu from 'kokopu';

export const position = new kokopu.Position();

export const valueMap = {
	p: 1,
	b: 3,
	n: 3,
	r: 5,
	q: 9,
	k: 100,
};

export function replay(moves) {
	position.reset();
	for (const move of moves) {
		position.play(move);
	}
}

export function replayFen(fen) {
	position.fen(fen);
}

const history = [];

export function push(from, to) {
	const legalMoves = position.moves();
	if (legalMoves.map((m) => m.from + m.to).includes(from + to)) {
		let move = position.uci(from + to, false);
		position.play(move);
		history.push(position.fen());
		return true;
	}
	return false;
}

export function pop() {
	if (history.length === 0) {
		throw 'History already rewinded back to original state.';
	}
	const previousState = history.pop();
	position.fen(previousState);
}

export function clear() {
	if (history.length > 0) {
		position.fen(history[0]);
		history.length = 0;
	}
}

export function squareValue(square) {
	let coloredPiece = position.square(square);
	if (coloredPiece === '-') {
		return 0;
	}
	let piece = coloredPiece.split('')[1];
	let value = valueMap[piece];
	return value;
}

export function squarePiece(square) {
	let coloredPiece = position.square(square);
	if (coloredPiece === '-') {
		return null;
	}
	let piece = coloredPiece.split('')[0];
	return piece;
}

export function squareColor(square) {
	let coloredPiece = position.square(square);
	if (coloredPiece === '-') {
		return null;
	}
	let piece = coloredPiece.split('')[0];
	return piece;
}

export function hasALegalAttack(square, side) {
	let sidesTurn = position.turn() === side;
	let notMySquare = squareColor(square) !== side;
	let attacks = position.getAttacks(square, side);
	let attackIsLegal = position.moves().includes(attacks);
	return sidesTurn && notMySquare && attacks?.length > 0 && attackIsLegal;
}
