import { LichessParser } from './lichess';
import { ChessDotComParser } from './chessdotcom';
import { ChessArenaParser } from './chessarena';

export const siteParser = (host) => {
	switch (host) {
		case 'lichess.org':
			return new LichessParser();
		case 'www.chess.com':
			return new ChessDotComParser();
		case 'chessarena.com':
			return new ChessArenaParser();
		default:
			throw 'Unknown host';
	}
};

// function parseLAN(LAN, turn) {
// 	let moves = LAN.split('-');
// 	if (moves.length == 1) {
// 		moves = LAN.split('x');
// 	}

// 	[from, to] = moves;

// 	// Long castles (O-O-O)
// 	if (moves.length == 3) {
// 		if (turn == WHITE) {
// 			return { from: 'e1', to: 'c1' };
// 		}
// 		return { from: 'e8', to: 'c8' };
// 	}

// 	// Short castles
// 	if (from.toLowerCase() == 'o') {
// 		if (turn == WHITE) {
// 			return { from: 'e1', to: 'g1' };
// 		}
// 		return { from: 'e8', to: 'g8' };
// 	}

// 	return { from: from.slice(-2), to: to.slice(0, 2) };
// }
