import { position, gameState } from './game';
import { WHITE, BLACK } from './helpers';

// eslint-disable-next-line no-undef
export const stockfish = STOCKFISH();

export let state = {
	score: 0,
	bestMove: null,
	bestMoveSAN: null,
	ponder: null,
	lastEvent: '',
	evalPercent: 50.0,
	triggerUpdate: false,
	turn: WHITE,
	multiPVSquares: {},
	multiPV: localStorage.getItem('cv-multi-pv') || 1,
	calculating: false,
};

stockfish.postMessage('uci');

stockfish.postMessage('setoption name MultiPV value ' + state.multiPV);
stockfish.postMessage('isready');

stockfish.postMessage('ucinewgame');

export function playMove(fen, depth) {
	if (fen) {
		if (state.calculating) {
			console.log('Stopping calculation')
			stockfish.postMessage(`stop`);
		}
		console.log('Starting calculation')
		state.calculating = true;
		stockfish.postMessage(`position fen ${fen}`);
		stockfish.postMessage(`go depth ${depth}`);
	}
}

stockfish.onmessage = async function (event) {
	if (event.includes('bestmove') && state.lastEvent.includes('bestmove')) {
		return;
	}

	state.lastEvent = event;

	console.log(event);
	// console.log('Turn: ' + position.turn());
	// console.log('Side: ' + gameState.mySide);
	if (!event) {
		return;
	}
	let args = event.split(' ');

	if (event.includes('bestmove')) {
		state.calculating = false;
		console.log('No longer calculating')
		let index = args.findIndex(x => x == 'bestmove');
		let value = args[index + 1];
		if (value.includes('none')) {
			return;
		}
		state.bestMove = value;
		try {
			state.bestMoveSAN = position.notation(position.uci(state.bestMove));
			console.log(state.bestMoveSAN);
		} catch (err) {
			console.log(err);
			// Fuck it
		}
		state.turn = position.turn();
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
