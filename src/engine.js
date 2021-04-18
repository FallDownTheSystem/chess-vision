import { position } from './game';
import { WHITE, BLACK } from './helpers';

// eslint-disable-next-line no-undef
var stockfish = STOCKFISH();

export let state = {
	score: 0,
	bestMove: null,
	bestMoveSAN: null,
	evalPercent: 50.0,
	mate: null,
	triggerUpdate: false,
};

stockfish.postMessage('uci');
stockfish.postMessage('ucinewgame');

export function playMove(fen, depth) {
	if (fen) {
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
		state.bestMoveSAN = position.notation(position.uci(state.bestMove));
		// console.log(state.bestMove, state.bestMoveSAN, state.score, state.mate);
		state.triggerUpdate = true;
	}
	if (event.includes('score')) {
		if (event.includes('cp')) {
			state.score = parseInt(args[args.findIndex(x => x == 'cp') + 1]);
			state.mate = null;
		} else if (event.includes('mate')) {
			state.score = position.turn() == WHITE ? 9999 : -9999;
			state.mate = parseInt(args[args.findIndex(x => x == 'mate') + 1]);
		}
	}
};
