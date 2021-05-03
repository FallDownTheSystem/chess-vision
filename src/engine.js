import { position, gameState } from './game';
import { WHITE, BLACK } from './helpers';

// eslint-disable-next-line no-undef
export const stockfish = STOCKFISH();

export let state = {
	score: 0,
	bestMove: null,
	bestMoveSAN: null,
	ponder: null,
	evalPercent: 50.0,
	mate: null,
	triggerUpdate: false,
	multiPVSquares: {},
	multiPV: localStorage.getItem('cv-multi-pv') || 1,
};

stockfish.postMessage('uci');

stockfish.postMessage('setoption name MultiPV value ' + state.multiPV);
stockfish.postMessage('isready');

stockfish.postMessage('ucinewgame');

export function playMove(fen, depth) {
	if (fen) {
		state.multiPVSquares = {};
		state.score = null;
		stockfish.postMessage(`position fen ${fen}`);
		stockfish.postMessage(`go depth ${depth}`);
	}
}

stockfish.onmessage = async function (event) {
	// console.log(event);
	if (!event) {
		return;
	}
	let args = event.split(' ');

	if (event.includes('bestmove')) {
		let index = args.findIndex(x => x == 'bestmove');
		let value = args[index + 1];
		if (value.includes('none')) {
			return;
		}
		state.bestMove = value;
		try {
			state.bestMoveSAN = position.notation(position.uci(state.bestMove));
		} catch {
			// Fuck it
		}
		// console.log(state.bestMove, state.bestMoveSAN, state.score, state.mate);
		state.triggerUpdate = true;
	}

	if (event.includes('ponder')) {
		let index = args.findIndex(x => x == 'ponder');
		let value = args[index + 1];
		if (value.includes('none') || !value) {
			return;
		}
		state.ponder = value;
		state.triggerUpdate = true;
	}

	if (event.includes('multipv')) {
		let index = args.findIndex(x => x == 'multipv');
		let value = args[index + 1];

		let moveIndex = args.findIndex(x => x == 'pv');
		let move = args[moveIndex + 1];

		state.multiPVSquares[value] = move;
		state.ponder = value;
	}

	if (event.includes('score')) {
		if (event.includes('cp')) {
			let score = parseInt(args[args.findIndex(x => x == 'cp') + 1]);
			if (state.score === null || score > state.score) {
				state.score = score;
			}
			state.mate = null;
		} else if (event.includes('mate')) {
			let index = args.findIndex(x => x == 'mate');
			let value = args[index + 1];
			state.score = gameState.mySide == position.turn() ? 9999 : -9999;
			console.log(position.turn());
			state.mate = parseInt(args[args.findIndex(x => x == 'mate') + 1]);
		}
	}
};
