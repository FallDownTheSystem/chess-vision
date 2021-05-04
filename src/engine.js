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
		stockfish.postMessage(`position fen ${fen}`);
		stockfish.postMessage(`go depth ${depth}`);
	}
}

stockfish.onmessage = async function (event) {
	// console.log(event);
	// console.log('Turn: ' + position.turn());
	// console.log('Side: ' + gameState.mySide);
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
		if (event.includes('cp') && event.includes('multipv 1')) {
			let score = parseInt(args[args.findIndex(x => x == 'cp') + 1]);
			state.score = score;
		} else if (event.includes('mate')) {
			let index = args.findIndex(x => x == 'mate');
			let value = args[index + 1];
			state.score = value * 9999;
		}
	}
};
