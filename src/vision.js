import { WHITE, BLACK, getFiles, getRanks } from './helpers';
import { valueMap, squareValue, squareColor } from './game';
import { drawSquare, drawText, drawTextBelow } from './draw';
import { isEqual } from 'lodash-es';
import { state } from './engine';

export function controlledSquares(position) {
	let files = getFiles();
	let ranks = getRanks();

	let squares = {};

	for (const r of ranks) {
		for (const f of files) {
			const square = f + r;
			// Initialize the square
			squares[square] = {
				[WHITE]: [],
				[BLACK]: [],
			};

			findAttackers(position, squares, square, WHITE);
			findAttackers(position, squares, square, BLACK);
		}
	}
	return squares;
}

export function drawControlledSquares(squares, mySide, debug) {
	const opSide = mySide === WHITE ? BLACK : WHITE;

	for (const [square, attackers] of Object.entries(squares)) {
		let myAttackers = attackers[mySide];
		let myTotalValue = myAttackers.length ? attackValue(myAttackers) : 0;

		let opAttackers = attackers[opSide];
		let opponentTotalValue = opAttackers.length ? attackValue(opAttackers) : 0;

		// Neither controls the square, skip it
		if (!myTotalValue && !opponentTotalValue) {
			continue;
		}

		// Opponent controls the square
		if (!myTotalValue) {
			let color = 'hsla(350, 100%, 50%, 0.15)';
			drawSquare(square, { background: color });
		}

		// I control the square
		if (!opponentTotalValue) {
			let color = 'hsla(130, 100%, 50%, 0.15)';
			drawSquare(square, { background: color });
		}
		// Both are contesting the square, resolve who wins if it's in tension
		if (opponentTotalValue && myTotalValue) {
			let contestedValue = calculateContestedSquare(square, myAttackers, opAttackers, mySide);

			// hsl(220, 100%, 50%) for equal
			let color = 'hsla(220, 100%, 50%';

			if (contestedValue > 0) {
				// hsl(350, 100%, 50%) for it costs for me
				color = 'hsla(350, 100%, 50%';
			} else if (contestedValue < 0) {
				// hsl(130, 100%, 50%) for it costs more for the opponent
				color = 'hsla(130, 100%, 50%';
			}

			drawSquare(square, { background: `${color}, 0.25)`, border: `1px solid ${color}, 1)` });
		}
		drawTextBelow('cv-overlay', 'score', '-35px', state.score);
	}
}

function calculateContestedSquare(square, myAttackers, opAttackers, side) {
	let attackedSquareColor = squareColor(square);

	const mySide = side;
	const opSide = mySide === WHITE ? BLACK : WHITE;
	let myPieces = [...myAttackers];
	let opPieces = [...opAttackers];
	let myTotalCost = 0;
	let opTotalCost = 0;

	if (attackedSquareColor === mySide) {
		myPieces.unshift(square);
	}

	if (attackedSquareColor === opSide) {
		opPieces.unshift(square);
	}

	for (let i = 0; i < Math.max(myPieces.length, opPieces.length); i++) {
		const myPiece = myPieces.length > i ? myPieces[i] : null;
		let myCost = myPiece ? squareValue(myPiece) : 0;

		const opPiece = opPieces.length > i ? opPieces[i] : null;
		let opCost = opPiece ? squareValue(opPiece) : 0;

		// Trade
		if (attackedSquareColor !== null && myPiece && opPiece) {
			if (myAttackers.length > i) {
				opTotalCost += opCost;
			}
			if (opAttackers.length > i) {
				myTotalCost += myCost;
			}
		}
		// They capture
		if (attackedSquareColor === mySide && opPiece && !myPiece) {
			myTotalCost += myCost;
		}
		// I capture
		if (attackedSquareColor === opSide && !opPiece && myPiece) {
			opTotalCost += opCost;
		}

		// if the square is empty
		if (!attackedSquareColor) {
			// if I dont have attackers, they control it (control means having lower total value)
			if (!myPiece) {
				myTotalCost += opCost;
			}
			// if they dont have attackers, I control it
			if (!opPiece) {
				opTotalCost += myCost;
			}

			// if we both have attackers, the lower value controls it
			if (myPiece && opPiece) {
				// Make king the same cost as the other piece, so that the square is in tension/contested
				if (myCost === 100) {
					myCost = opCost;
				}
				if (opCost === 100) {
					opCost = myCost;
				}

				if (myCost < opCost) {
					opTotalCost += opCost;
					break;
				} else if (opCost < myCost) {
					myTotalCost += myCost;
					break;
				}
			}
		}
	}
	return myTotalCost - opTotalCost;
}

function isKingCheckedAfterMove(position, from, to, side) {
	const fromPiece = position.square(from);
	if (fromPiece.includes('k')) {
		return false;
	}
	position.square(from, '-');

	const toPiece = position.square(to);
	if (toPiece.includes('k')) {
		return false;
	}
	position.square(to, fromPiece);

	const isKingChecked = position.isAttacked(position.kingSquare(side), side === WHITE ? BLACK : WHITE);

	position.square(from, fromPiece);
	position.square(to, toPiece);

	return isKingChecked;
}

function findAttackers(position, squares, square, side) {
	let fen = position.fen();
	// We always sort the attackers after getting them, so that each 'wave' of xrays is in correct order
	let attackers = sortAttackers(position, position.getAttacks(square, side)).filter(
		x => !isKingCheckedAfterMove(position, x, square, side)
	);
	squares[square][side] = attackers;
	let previousAttackers = attackers;

	while (attackers.length > 0) {
		xray(position, attackers);
		attackers = sortAttackers(position, position.getAttacks(square, side)).filter(
			x => !isKingCheckedAfterMove(position, x, square, side)
		);
		if (isEqual(attackers, previousAttackers)) {
			break;
		}
		previousAttackers = attackers;
		// Deduplicate the attackers
		squares[square][side] = [...new Set(squares[square][side].concat(attackers))];
	}
	position.fen(fen);
}

function xray(position, attackers) {
	for (let attacker of attackers) {
		let piece = position.square(attacker);
		position.square(attacker, '-');
		if (!position.isLegal()) {
			position.square(attacker, piece);
		}
	}
}

function sortAttackers(position, attackers) {
	const sortedAttackers = [...attackers].sort((a, b) => {
		let value = valueMap[position.square(a).split('')[1]];
		let value2 = valueMap[position.square(b).split('')[1]];

		return value - value2;
	});
	return sortedAttackers;
}

function attackValue(attackers) {
	return attackers.reduce((a, b) => a + squareValue(b), 0);
}
