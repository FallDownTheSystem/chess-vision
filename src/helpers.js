export const BLACK = 'b';
export const WHITE = 'w';

export function range(start, end) {
	return Array(end - start + 1)
		.fill()
		.map((_, idx) => start + idx);
}

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const ranks = range(1, 8);

export function getFiles() {
	return [...files];
}

export function getRanks() {
	return [...ranks];
}

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export const cleanse = x => {
	const chars = ['↵', '✓', '1-0', '0-1', '1/2-1/2', '½', '?', '\n', /\[+-][0-9.]+/];
	for (const c of chars) {
		x = x.replace(c, '');
	}
	return x.trim();
};

export function oppositeColor(turn) {
	return turn == WHITE ? BLACK : WHITE;
}

export function opponentColor(turn, side) {
	if (side == WHITE) {
		return turn == WHITE ? WHITE : BLACK;
	}
	return turn == WHITE ? BLACK : WHITE;
}

export function parseLAN(LAN, turn) {
	let moves = LAN.split('-');
	if (moves.length == 1) {
		moves = LAN.split('x');
	}

	let [from, to] = moves;

	// Long castles (O-O-O)
	if (moves.length == 3) {
		if (turn == WHITE) {
			return { from: 'e1', to: 'c1' };
		}
		return { from: 'e8', to: 'c8' };
	}

	// Short castles
	if (from.toLowerCase() == 'o') {
		if (turn == WHITE) {
			return { from: 'e1', to: 'g1' };
		}
		return { from: 'e8', to: 'g8' };
	}

	return { from: from.slice(-2), to: to.slice(0, 2) };
}
