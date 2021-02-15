// ==UserScript==
// @name        Chess vision
// @namespace   FallDownTheSystem
// @version     0.1.0
// @author      FallDownTheSystem
// @match       *://lichess.org/*
// @match       *://www.chess.com/*
// @match       *://chess24.com/*
// @match       *://arena.myfide.net/*
// @inject-into content
// @grant       none
// ==/UserScript==
(function () {
	'use strict';

	const BLACK = 'b';
	const WHITE = 'w';

	function range(start, end) {
		return Array(end - start + 1)
			.fill()
			.map((_, idx) => start + idx);
	}

	const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
	const ranks = range(1, 8);

	function getFiles() {
		return [...files];
	}

	function getRanks() {
		return [...ranks];
	}

	const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

	const cleanse = (x) => {
		const chars = ['↵', '✓', '1-0', '0-1', '1/2-1/2', '\n', /\[+-][0-9.]+/];
		for (const c of chars) {
			x = x.replace(c, '');
		}
		return x.trim();
	};

	// analysisSelector: '.analyse__tools',

	class LichessParser {
		constructor() {
			this.moveSelector =
				'.buttons + * > *:nth-child(3n-1), .buttons + * > *:nth-child(3n), move > san, .puzzle__moves move';
			this.sideSelector = '.orientation-white';
			this.overlaySelector = '.cg-wrap';
			this.gameSelector = '.rmoves, .tview2, .ruser';
			this.zIndex = '1';
		}

		parseMoves() {
			const moves = [...document.querySelectorAll(this.moveSelector)]
				.map((x) => cleanse(x.innerText))
				.filter((x) => x !== '');

			return moves;
		}

		getSide() {
			return document.querySelector(this.sideSelector) !== null ? WHITE : BLACK;
		}

		getOverlay() {
			return document.querySelector(this.overlaySelector);
		}

		isReady() {
			return document.querySelector(this.gameSelector) !== null && this.getOverlay() != null;
		}
	}

	// analysisSelector: '.with-analysis, .with-analysis-collapsed',

	class ChessDotComParser {
		constructor() {
			this.zIndex = '0';
		}

		parseMoves() {
			const moves = [...document.querySelectorAll('.move .node, .move-list-controls-move')]
				.map((x) => cleanse(x.innerText))
				.filter((x) => x !== '');

			return moves;
		}

		getSide() {
			return document.querySelector('.clock-bottom.clock-black, .board.flipped') !== null ? BLACK : WHITE;
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

	// analysisSelector: '.with-analysis',

	class Chess24Parser {
		constructor() {
			this.moveSelector = '.move';
			this.sideSelector = '.bottom .playerInfo.black';
			this.overlaySelector = '.chess-board > .svg';
			this.gameSelector = '.Moves';
			this.zIndex = '10';
		}

		parseMoves() {
			const moves = [...document.querySelectorAll(this.moveSelector)]
				.map((x) => cleanse(x.innerText))
				.filter((x) => x !== '');

			return moves;
		}

		getSide() {
			return document.querySelector(this.sideSelector) !== null ? BLACK : WHITE;
		}

		getOverlay() {
			return document.querySelector(this.overlaySelector);
		}

		isReady() {
			return document.querySelector(this.gameSelector) !== null && this.getOverlay() != null;
		}
	}

	// analysisSelector: '.analyse__tools',

	const parseFideSAN = (x) => {
		let innerText = x.innerText;
		if (innerText.includes('0-0')) {
			innerText = innerText.replace(/0/g, 'O');
		}
		const img = x.querySelector('img');
		if (img == null) {
			return innerText;
		}
		const src = img.src.split('/');
		const piece = src[src.length - 1].replace('.svg', '').split('')[1];
		return piece === 'P' ? innerText : piece + innerText;
	};

	class FideArenaParser {
		constructor() {
			this.moveSelector = '.notifications__move';
			this.sideSelector = '.orientation-white';
			this.overlaySelector = '.cg-board';
			this.gameSelector = '.notifications__table';
			this.zIndex = '101';
		}

		parseMoves() {
			const moves = [...document.querySelectorAll(this.moveSelector)]
				.map((x) => cleanse(parseFideSAN(x)))
				.filter((x) => x !== '');

			return moves;
		}

		getSide() {
			return document.querySelector(this.sideSelector) !== null ? WHITE : BLACK;
		}

		getOverlay() {
			return document.querySelector(this.overlaySelector);
		}

		isReady() {
			return document.querySelector(this.gameSelector) !== null && this.getOverlay() != null;
		}
	}

	const siteParser = (host) => {
		switch (host) {
			case 'lichess.org':
				return new LichessParser();
			case 'www.chess.com':
				return new ChessDotComParser();
			case 'chess24.com':
				return new Chess24Parser();
			case 'arena.myfide.net':
				return new FideArenaParser();
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

	/******************************************************************************
	 *                                                                            *
	 *    This file is part of Kokopu, a JavaScript chess library.                *
	 *    Copyright (C) 2018-2021  Yoann Le Montagner <yo35 -at- melix.net>       *
	 *                                                                            *
	 *    This program is free software: you can redistribute it and/or           *
	 *    modify it under the terms of the GNU Lesser General Public License      *
	 *    as published by the Free Software Foundation, either version 3 of       *
	 *    the License, or (at your option) any later version.                     *
	 *                                                                            *
	 *    This program is distributed in the hope that it will be useful,         *
	 *    but WITHOUT ANY WARRANTY; without even the implied warranty of          *
	 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the            *
	 *    GNU Lesser General Public License for more details.                     *
	 *                                                                            *
	 *    You should have received a copy of the GNU Lesser General               *
	 *    Public License along with this program. If not, see                     *
	 *    <http://www.gnu.org/licenses/>.                                         *
	 *                                                                            *
	 ******************************************************************************/


	/**
	 * @module i18n
	 * @description This module defines the localizable strings used by the library.
	 */



	// Ordinal integers (from 1 to 8).
	var ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

	// FEN parsing error messages
	var WRONG_NUMBER_OF_FEN_FIELDS                = 'A FEN string must contain exactly 6 space-separated fields.';
	var WRONG_NUMBER_OF_SUBFIELDS_IN_BOARD_FIELD  = 'The 1st field of a FEN string must contain exactly 8 `/`-separated subfields.';
	var UNEXPECTED_CHARACTER_IN_BOARD_FIELD       = 'Unexpected character in the 1st field of the FEN string: `%1$s`.';
	var UNEXPECTED_END_OF_SUBFIELD_IN_BOARD_FIELD = 'The %1$s subfield of the FEN string 1st field is unexpectedly short.';
	var INVALID_TURN_FIELD                        = 'The 2nd field of a FEN string must be either `w` or `b`.';
	var INVALID_CASTLING_FIELD                    = 'The 3rd field of a FEN string must be either `-` or a list of characters among `K`, `Q`, `k` and `q` (in this order).';
	var INVALID_EN_PASSANT_FIELD                  = 'The 4th field of a FEN string must be either `-` or a square from the 3rd or 6th rank where en-passant is allowed.';
	var WRONG_RANK_IN_EN_PASSANT_FIELD            = 'The rank number indicated in the FEN string 4th field is inconsistent with respect to the 2nd field.';
	var INVALID_MOVE_COUNTING_FIELD               = 'The %1$s field of a FEN string must be a number.';

	// Notation & UCI parsing error messages
	var INVALID_UCI_NOTATION_SYNTAX         = 'The syntax of the UCI notation is invalid.';
	var ILLEGAL_UCI_MOVE                    = 'The UCI move is not legal.';
	var INVALID_MOVE_NOTATION_SYNTAX        = 'The syntax of the move notation is invalid.';
	var ILLEGAL_POSITION                    = 'The position is not legal.';
	var ILLEGAL_NO_KING_CASTLING            = 'Casting is not legal in the considered position as it has no king.';
	var ILLEGAL_QUEEN_SIDE_CASTLING         = 'Queen-side castling is not legal in the considered position.';
	var ILLEGAL_KING_SIDE_CASTLING          = 'King-side castling is not legal in the considered position.';
	var NO_PIECE_CAN_MOVE_TO                = 'No %1$s can move to %2$s.';
	var NO_PIECE_CAN_MOVE_TO_DISAMBIGUATION = 'No %1$s on the specified rank/file can move to %2$s.';
	var REQUIRE_DISAMBIGUATION              = 'Cannot determine uniquely which %1$s is supposed to move to %2$s.';
	var WRONG_DISAMBIGUATION_SYMBOL         = 'Wrong disambiguation symbol (expected: `%1$s`, observed: `%2$s`).';
	var TRYING_TO_CAPTURE_YOUR_OWN_PIECES   = 'Capturing its own pieces is not legal.';
	var INVALID_PIECE_SYMBOL                = 'Character `%1$s` is not a valid piece symbol.';
	var INVALID_PIECE_SYMBOL_COLOR          = 'Invalid color for piece symbol `%1$s`.';
	var INVALID_CAPTURING_PAWN_MOVE         = 'Invalid capturing pawn move.';
	var INVALID_NON_CAPTURING_PAWN_MOVE     = 'Invalid non-capturing pawn move.';
	var NOT_SAFE_FOR_WHITE_KING             = 'This move would put let the white king in check.';
	var NOT_SAFE_FOR_BLACK_KING             = 'This move would put let the black king in check.';
	var MISSING_PROMOTION                   = 'A promoted piece must be specified for this move.';
	var MISSING_PROMOTION_SYMBOL            = 'Character `=` is required to specify a promoted piece.';
	var INVALID_PROMOTED_PIECE              = '%1$s cannot be specified as a promoted piece.';
	var ILLEGAL_PROMOTION                   = 'Specifying a promoted piece is illegal for this move.';
	var ILLEGAL_NULL_MOVE                   = 'Cannot play a null-move in this position.';
	var MISSING_CAPTURE_SYMBOL              = 'Capture symbol `x` is missing.';
	var INVALID_CAPTURE_SYMBOL              = 'This move is not a capture move.';
	var WRONG_CHECK_CHECKMATE_SYMBOL        = 'Wrong check/checkmate symbol (expected: `%1$s`, observed: `%2$s`).';

	// PGN parsing error messages
	var INVALID_PGN_TOKEN               = 'Unrecognized character or group of characters.';
	var INVALID_MOVE_IN_PGN_TEXT        = 'Invalid move (%1$s). %2$s';
	var INVALID_FEN_IN_PGN_TEXT         = 'Invalid FEN string in the initial position header. %1$s';
	var UNEXPECTED_PGN_HEADER           = 'Unexpected PGN game header.';
	var MISSING_PGN_HEADER_ID           = 'Missing or invalid PGN game header ID.';
	var MISSING_PGN_HEADER_VALUE        = 'Missing or invalid PGN game header value.';
	var MISSING_END_OF_PGN_HEADER       = 'Missing or invalid end of PGN game header.';
	var UNEXPECTED_BEGIN_OF_VARIATION   = 'Unexpected begin of variation.';
	var UNEXPECTED_END_OF_VARIATION     = 'Unexpected end of variation.';
	var UNEXPECTED_END_OF_GAME          = 'Unexpected end of game: there are pending variations.';
	var UNEXPECTED_END_OF_TEXT          = 'Unexpected end of text: there is a pending game.';
	var INVALID_GAME_INDEX              = 'Game index %1$s is invalid (only %2$s game(s) found in the PGN data).';
	var UNKNOWN_VARIANT                 = 'Unknown chess game variant (%1$s).';
	var VARIANT_WITHOUT_FEN             = 'For non-standard game variant, the FEN header is mandatory.';

	var i18n = {
		ORDINALS: ORDINALS,
		WRONG_NUMBER_OF_FEN_FIELDS: WRONG_NUMBER_OF_FEN_FIELDS,
		WRONG_NUMBER_OF_SUBFIELDS_IN_BOARD_FIELD: WRONG_NUMBER_OF_SUBFIELDS_IN_BOARD_FIELD,
		UNEXPECTED_CHARACTER_IN_BOARD_FIELD: UNEXPECTED_CHARACTER_IN_BOARD_FIELD,
		UNEXPECTED_END_OF_SUBFIELD_IN_BOARD_FIELD: UNEXPECTED_END_OF_SUBFIELD_IN_BOARD_FIELD,
		INVALID_TURN_FIELD: INVALID_TURN_FIELD,
		INVALID_CASTLING_FIELD: INVALID_CASTLING_FIELD,
		INVALID_EN_PASSANT_FIELD: INVALID_EN_PASSANT_FIELD,
		WRONG_RANK_IN_EN_PASSANT_FIELD: WRONG_RANK_IN_EN_PASSANT_FIELD,
		INVALID_MOVE_COUNTING_FIELD: INVALID_MOVE_COUNTING_FIELD,
		INVALID_UCI_NOTATION_SYNTAX: INVALID_UCI_NOTATION_SYNTAX,
		ILLEGAL_UCI_MOVE: ILLEGAL_UCI_MOVE,
		INVALID_MOVE_NOTATION_SYNTAX: INVALID_MOVE_NOTATION_SYNTAX,
		ILLEGAL_POSITION: ILLEGAL_POSITION,
		ILLEGAL_NO_KING_CASTLING: ILLEGAL_NO_KING_CASTLING,
		ILLEGAL_QUEEN_SIDE_CASTLING: ILLEGAL_QUEEN_SIDE_CASTLING,
		ILLEGAL_KING_SIDE_CASTLING: ILLEGAL_KING_SIDE_CASTLING,
		NO_PIECE_CAN_MOVE_TO: NO_PIECE_CAN_MOVE_TO,
		NO_PIECE_CAN_MOVE_TO_DISAMBIGUATION: NO_PIECE_CAN_MOVE_TO_DISAMBIGUATION,
		REQUIRE_DISAMBIGUATION: REQUIRE_DISAMBIGUATION,
		WRONG_DISAMBIGUATION_SYMBOL: WRONG_DISAMBIGUATION_SYMBOL,
		TRYING_TO_CAPTURE_YOUR_OWN_PIECES: TRYING_TO_CAPTURE_YOUR_OWN_PIECES,
		INVALID_PIECE_SYMBOL: INVALID_PIECE_SYMBOL,
		INVALID_PIECE_SYMBOL_COLOR: INVALID_PIECE_SYMBOL_COLOR,
		INVALID_CAPTURING_PAWN_MOVE: INVALID_CAPTURING_PAWN_MOVE,
		INVALID_NON_CAPTURING_PAWN_MOVE: INVALID_NON_CAPTURING_PAWN_MOVE,
		NOT_SAFE_FOR_WHITE_KING: NOT_SAFE_FOR_WHITE_KING,
		NOT_SAFE_FOR_BLACK_KING: NOT_SAFE_FOR_BLACK_KING,
		MISSING_PROMOTION: MISSING_PROMOTION,
		MISSING_PROMOTION_SYMBOL: MISSING_PROMOTION_SYMBOL,
		INVALID_PROMOTED_PIECE: INVALID_PROMOTED_PIECE,
		ILLEGAL_PROMOTION: ILLEGAL_PROMOTION,
		ILLEGAL_NULL_MOVE: ILLEGAL_NULL_MOVE,
		MISSING_CAPTURE_SYMBOL: MISSING_CAPTURE_SYMBOL,
		INVALID_CAPTURE_SYMBOL: INVALID_CAPTURE_SYMBOL,
		WRONG_CHECK_CHECKMATE_SYMBOL: WRONG_CHECK_CHECKMATE_SYMBOL,
		INVALID_PGN_TOKEN: INVALID_PGN_TOKEN,
		INVALID_MOVE_IN_PGN_TEXT: INVALID_MOVE_IN_PGN_TEXT,
		INVALID_FEN_IN_PGN_TEXT: INVALID_FEN_IN_PGN_TEXT,
		UNEXPECTED_PGN_HEADER: UNEXPECTED_PGN_HEADER,
		MISSING_PGN_HEADER_ID: MISSING_PGN_HEADER_ID,
		MISSING_PGN_HEADER_VALUE: MISSING_PGN_HEADER_VALUE,
		MISSING_END_OF_PGN_HEADER: MISSING_END_OF_PGN_HEADER,
		UNEXPECTED_BEGIN_OF_VARIATION: UNEXPECTED_BEGIN_OF_VARIATION,
		UNEXPECTED_END_OF_VARIATION: UNEXPECTED_END_OF_VARIATION,
		UNEXPECTED_END_OF_GAME: UNEXPECTED_END_OF_GAME,
		UNEXPECTED_END_OF_TEXT: UNEXPECTED_END_OF_TEXT,
		INVALID_GAME_INDEX: INVALID_GAME_INDEX,
		UNKNOWN_VARIANT: UNKNOWN_VARIANT,
		VARIANT_WITHOUT_FEN: VARIANT_WITHOUT_FEN
	};

	function createCommonjsModule(fn) {
	  var module = { exports: {} };
		return fn(module, module.exports), module.exports;
	}

	/******************************************************************************
	 *                                                                            *
	 *    This file is part of Kokopu, a JavaScript chess library.                *
	 *    Copyright (C) 2018-2021  Yoann Le Montagner <yo35 -at- melix.net>       *
	 *                                                                            *
	 *    This program is free software: you can redistribute it and/or           *
	 *    modify it under the terms of the GNU Lesser General Public License      *
	 *    as published by the Free Software Foundation, either version 3 of       *
	 *    the License, or (at your option) any later version.                     *
	 *                                                                            *
	 *    This program is distributed in the hope that it will be useful,         *
	 *    but WITHOUT ANY WARRANTY; without even the implied warranty of          *
	 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the            *
	 *    GNU Lesser General Public License for more details.                     *
	 *                                                                            *
	 *    You should have received a copy of the GNU Lesser General               *
	 *    Public License along with this program. If not, see                     *
	 *    <http://www.gnu.org/licenses/>.                                         *
	 *                                                                            *
	 ******************************************************************************/

	var exception = createCommonjsModule(function (module, exports) {


	/**
	 * @module exception
	 * @description This module defines the exceptions used by the library.
	 */



	/**
	 * @class
	 * @classdesc Exception thrown when an invalid argument is passed to a function.
	 * @static
	 */
	var IllegalArgument = exports.IllegalArgument = function(functionName) {

		/**
		 * Name of the function that raises the exception.
		 * @member {string}
		 */
		this.functionName = functionName;
	};

	IllegalArgument.prototype.toString = function() {
		return 'Illegal argument in function ' + this.functionName;
	};



	/**
	 * @class
	 * @classdesc Exception thrown by the FEN parsing functions.
	 * @static
	 */
	var InvalidFEN = exports.InvalidFEN = function(fen, message) {

		/**
		 * FEN string that causes the error.
		 * @member {string}
		 */
		this.fen = fen;

		/**
		 * Human-readable message describing the error.
		 * @member {string}
		 */
		this.message = buildMessage(message, 2, arguments);
	};

	InvalidFEN.prototype.toString = function() {
		return toStringImpl('InvalidFEN', this.message);
	};



	/**
	 * @class
	 * @classdesc Exception thrown by the move notation parsing functions.
	 * @static
	 */
	var InvalidNotation = exports.InvalidNotation = function(fen, notation, message) {

		/**
		 * FEN representation of the position used to interpret the move notation.
		 * @member {string}
		 */
		this.fen = fen;

		/**
		 * Move notation that causes the error.
		 * @member {string}
		 */
		this.notation = notation;

		/**
		 * Human-readable message describing the error.
		 * @member {string}
		 */
		this.message = buildMessage(message, 3, arguments);
	};

	InvalidNotation.prototype.toString = function() {
		return toStringImpl('InvalidNotation', this.message);
	};


	/**
	 * @class
	 * @classdesc Exception thrown by the PGN parsing functions.
	 * @static
	 */
	var InvalidPGN = exports.InvalidPGN = function(pgn, index, lineNumber, message) {

		/**
		 * PGN string that causes the error.
		 * @member {string}
		 */
		this.pgn = pgn;

		/**
		 * Index (0-based) of the character in the PGN string where the parsing fails (or a negative value is no particular character is related to the error).
		 * @member {number}
		 */
		this.index = index;

		/**
		 * Index (1-based) of the line in the PGN string where the parsing fails (or a negative value is no particular character is related to the error).
		 */
		this.lineNumber = lineNumber;

		/**
		 * Human-readable message describing the error.
		 * @member {string}
		 */
		this.message = buildMessage(message, 4, arguments);
	};

	InvalidPGN.prototype.toString = function() {
		return toStringImpl('InvalidPGN', '[character=' + this.index + ' line=' + this.lineNumber + '] ' + this.message);
	};



	function buildMessage(message, offset, tokens) {
		for(var i = offset; i < tokens.length; ++i) {
			var re = new RegExp('%' + (i - offset + 1) + '\\$s');
			message = message.replace(re, tokens[i]);
		}
		return message;
	}


	function toStringImpl(exceptionName, message) {
		return exceptionName + ' -> ' + message;
	}
	});

	/******************************************************************************
	 *                                                                            *
	 *    This file is part of Kokopu, a JavaScript chess library.                *
	 *    Copyright (C) 2018-2021  Yoann Le Montagner <yo35 -at- melix.net>       *
	 *                                                                            *
	 *    This program is free software: you can redistribute it and/or           *
	 *    modify it under the terms of the GNU Lesser General Public License      *
	 *    as published by the Free Software Foundation, either version 3 of       *
	 *    the License, or (at your option) any later version.                     *
	 *                                                                            *
	 *    This program is distributed in the hope that it will be useful,         *
	 *    but WITHOUT ANY WARRANTY; without even the implied warranty of          *
	 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the            *
	 *    GNU Lesser General Public License for more details.                     *
	 *                                                                            *
	 *    You should have received a copy of the GNU Lesser General               *
	 *    Public License along with this program. If not, see                     *
	 *    <http://www.gnu.org/licenses/>.                                         *
	 *                                                                            *
	 ******************************************************************************/


	// Colors
	var WHITE$1 = 0;
	var BLACK$1 = 1;

	// Pieces
	var KING   = 0;
	var QUEEN  = 1;
	var ROOK   = 2;
	var BISHOP = 3;
	var KNIGHT = 4;
	var PAWN   = 5;

	// Colored pieces
	var WK =  0; var BK =  1;
	var WQ =  2; var BQ =  3;
	var WR =  4; var BR =  5;
	var WB =  6; var BB =  7;
	var WN =  8; var BN =  9;
	var WP = 10; var BP = 11;

	// Special square values
	var EMPTY = -1;
	var INVALID = -2;

	// Game result
	var WHITE_WINS = 0;
	var BLACK_WINS = 1;
	var DRAW = 2;
	var LINE = 3;

	// Game variant
	var REGULAR_CHESS = 0;
	var CHESS960 = 1;
	var NO_KING = 2;
	var WHITE_KING_ONLY = 3;
	var BLACK_KING_ONLY = 4;


	// -----------------------------------------------------------------------------
	// Conversion API constants (strings) <-> internal constants (integers)
	// -----------------------------------------------------------------------------

	var COLOR_SYMBOL    = 'wb';
	var PIECE_SYMBOL    = 'kqrbnp';
	var FIGURINE_SYMBOL = '\u2654\u265a\u2655\u265b\u2656\u265c\u2657\u265d\u2658\u265e\u2659\u265f';
	var RANK_SYMBOL     = '12345678';
	var FILE_SYMBOL     = 'abcdefgh';
	var RESULT_SYMBOL   = ['1-0', '0-1', '1/2-1/2', '*'];
	var VARIANT_SYMBOL  = ['regular', 'chess960', 'no-king', 'white-king-only', 'black-king-only'];

	var colorToString    = function(color  ) { return COLOR_SYMBOL   [color  ]; };
	var pieceToString    = function(piece  ) { return PIECE_SYMBOL   [piece  ]; };
	var figurineToString = function(cp     ) { return FIGURINE_SYMBOL[cp     ]; };
	var rankToString     = function(rank   ) { return RANK_SYMBOL    [rank   ]; };
	var fileToString     = function(file   ) { return FILE_SYMBOL    [file   ]; };
	var resultToString   = function(result ) { return RESULT_SYMBOL  [result ]; };
	var variantToString  = function(variant) { return VARIANT_SYMBOL [variant]; };

	var colorFromString    = function(color  ) { return COLOR_SYMBOL   .indexOf(color  ); };
	var pieceFromString    = function(piece  ) { return PIECE_SYMBOL   .indexOf(piece  ); };
	var figurineFromString = function(cp     ) { return FIGURINE_SYMBOL.indexOf(cp     ); };
	var rankFromString     = function(rank   ) { return RANK_SYMBOL    .indexOf(rank   ); };
	var fileFromString     = function(file   ) { return FILE_SYMBOL    .indexOf(file   ); };
	var resultFromString   = function(result ) { return RESULT_SYMBOL  .indexOf(result ); };
	var variantFromString  = function(variant) { return VARIANT_SYMBOL .indexOf(variant); };

	var squareToString = function(square) {
		return FILE_SYMBOL[square % 16] + RANK_SYMBOL[Math.floor(square / 16)];
	};

	var squareFromString = function(square) {
		if(!/^[a-h][1-8]$/.test(square)) {
			return -1;
		}
		var file = FILE_SYMBOL.indexOf(square[0]);
		var rank = RANK_SYMBOL.indexOf(square[1]);
		return rank*16 + file;
	};

	var coloredPieceToString = function(cp) {
		return COLOR_SYMBOL[cp % 2] + PIECE_SYMBOL[Math.floor(cp / 2)];
	};

	var coloredPieceFromString = function(cp) {
		if(!/^[wb][kqrbnp]$/.test(cp)) {
			return -1;
		}
		var color = COLOR_SYMBOL.indexOf(cp[0]);
		var piece = PIECE_SYMBOL.indexOf(cp[1]);
		return piece*2 + color;
	};


	// -----------------------------------------------------------------------------
	// Typedefs for documentation
	// -----------------------------------------------------------------------------

	/**
	 * Either `'w'` (white) or `'b'` (black).
	 * @typedef {string} Color
	 */

	/**
	 * One-character string identifying a type of piece: `'p'` (pawn), `'n'`, `'b'`, `'r'`, `'q'` or `'k'`.
	 * @typedef {string} Piece
	 */

	/**
	 * Two-character string identifying a colored piece: `'wk'` (white king), `'br'` (black rook), etc...
	 * @typedef {string} ColoredPiece
	 */

	/**
	 * `'-'` Symbol used to identify an empty square.
	 * @typedef {string} Empty
	 */

	/**
	 * Either a one-character string among `'a'`, `'b'`, ..., `'h'` (indicating the file on which *en-passant* is allowed),
	 * or `'-'` (indicating that *en-passant* is not allowed).
	 * @typedef {string} EnPassantFlag
	 */

	/**
	 * Two-character string identifying a castle: `'wq'` (white queen-side castle), `'wk'`, `'bq'` or `'bk'`.
	 * @typedef {string} Castle
	 */

	/**
	 * Two-character string identifying a castle with the Chess960 rules: `'wa'` (white castle with rook initially on the a-file),
	 * `'wb'`, `'wc'`, ..., `'bh'`.
	 * @typedef {string} Castle960
	 */

	/**
	 * Two-character string identifying a square: `'a1'`, `'a2'`, ..., `'h8'`.
	 * @typedef {string} Square
	 */

	/**
	 * Result of a chess game. Must be one of the following constant:
	 *  - `'1-0'` (white wins),
	 *  - `'1/2-1/2'` (draw),
	 *  - `'0-1'` (black wins),
	 *  - `'*'` (unfinished game, or undefined result).
	 *
	 * @typedef {string} GameResult
	 */

	/**
	 * Variant of chess. Must be one of the following constant:
	 *  - `'regular'` (regular chess rules),
	 *  - `'chess960'` ([Chess960](https://en.wikipedia.org/wiki/Chess960), also known as Fischer Random Chess).
	 *  - `'no-king'` (chess position without any king)
	 *  - `'white-king-only'` (chess position with no black king)
	 *  - `'black-king-only'` (chess position with no white king)
	 *
	 * Variants `'no-king'`, `'white-king-only'` and `'black-king-only'` do not correspond to "real" games. They are mainly provided
	 * to create games explaining a particular piece scheme, concept, or sequence of moves... with a reduced number of pieces.
	 *
	 * @typedef {string} GameVariant
	 */

	var basetypes = {
		WHITE: WHITE$1,
		BLACK: BLACK$1,
		KING: KING,
		QUEEN: QUEEN,
		ROOK: ROOK,
		BISHOP: BISHOP,
		KNIGHT: KNIGHT,
		PAWN: PAWN,
		WK: WK,
		BK: BK,
		WQ: WQ,
		BQ: BQ,
		WR: WR,
		BR: BR,
		WB: WB,
		BB: BB,
		WN: WN,
		BN: BN,
		WP: WP,
		BP: BP,
		EMPTY: EMPTY,
		INVALID: INVALID,
		WHITE_WINS: WHITE_WINS,
		BLACK_WINS: BLACK_WINS,
		DRAW: DRAW,
		LINE: LINE,
		REGULAR_CHESS: REGULAR_CHESS,
		CHESS960: CHESS960,
		NO_KING: NO_KING,
		WHITE_KING_ONLY: WHITE_KING_ONLY,
		BLACK_KING_ONLY: BLACK_KING_ONLY,
		colorToString: colorToString,
		pieceToString: pieceToString,
		figurineToString: figurineToString,
		rankToString: rankToString,
		fileToString: fileToString,
		resultToString: resultToString,
		variantToString: variantToString,
		colorFromString: colorFromString,
		pieceFromString: pieceFromString,
		figurineFromString: figurineFromString,
		rankFromString: rankFromString,
		fileFromString: fileFromString,
		resultFromString: resultFromString,
		variantFromString: variantFromString,
		squareToString: squareToString,
		squareFromString: squareFromString,
		coloredPieceToString: coloredPieceToString,
		coloredPieceFromString: coloredPieceFromString
	};

	/******************************************************************************
	 *                                                                            *
	 *    This file is part of Kokopu, a JavaScript chess library.                *
	 *    Copyright (C) 2018-2021  Yoann Le Montagner <yo35 -at- melix.net>       *
	 *                                                                            *
	 *    This program is free software: you can redistribute it and/or           *
	 *    modify it under the terms of the GNU Lesser General Public License      *
	 *    as published by the Free Software Foundation, either version 3 of       *
	 *    the License, or (at your option) any later version.                     *
	 *                                                                            *
	 *    This program is distributed in the hope that it will be useful,         *
	 *    but WITHOUT ANY WARRANTY; without even the implied warranty of          *
	 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the            *
	 *    GNU Lesser General Public License for more details.                     *
	 *                                                                            *
	 *    You should have received a copy of the GNU Lesser General               *
	 *    Public License along with this program. If not, see                     *
	 *    <http://www.gnu.org/licenses/>.                                         *
	 *                                                                            *
	 ******************************************************************************/






	/**
	 * Execute the given callback on each of the 64 squares.
	 *
	 * @param {function(Square)} callback
	 */
	var forEachSquare = function(callback) {
		for(var rank=0; rank<8; ++rank) {
			for(var file=0; file<8; ++file) {
				callback(basetypes.squareToString(rank * 16 + file));
			}
		}
	};


	/**
	 * Return the color of a square.
	 *
	 * @param {Square} square
	 * @returns {Color}
	 */
	var squareColor = function(square) {
		square = basetypes.squareFromString(square);
		if(square < 0) {
			throw new exception.IllegalArgument('squareColor()');
		}
		return Math.floor(square/16) % 2 === square % 2 ? 'b' : 'w';
	};


	/**
	 * Return the coordinates of a square.
	 *
	 * @param {Square} square
	 * @returns {{rank: number, file: number}} The `rank` and `file` fields have the same meaning as in {@link coordinatesToSquare}.
	 */
	var squareToCoordinates = function(square) {
		square = basetypes.squareFromString(square);
		if(square < 0) {
			throw new exception.IllegalArgument('squareToCoordinates()');
		}
		return { rank:Math.floor(square/16), file:square%16 };
	};


	/**
	 * Return the square corresponding to the given coordinates.
	 *
	 * @param {number} file `0` for file A, `1` for file B, ..., `7` for file H.
	 * @param {number} rank `0` for the first rank, ..., `7` for the eighth rank.
	 * @returns {Square}
	 * @throws {exception.IllegalArgument} If either `file` or `rank` is not between 0 and 7 (inclusive).
	 */
	var coordinatesToSquare = function(file, rank) {
		if(file<0 || file>=8 || rank<0 || rank>= 8) {
			throw new exception.IllegalArgument('coordinatesToSquare()');
		}
		return basetypes.fileToString(file) + basetypes.rankToString(rank);
	};

	var util = {
		forEachSquare: forEachSquare,
		squareColor: squareColor,
		squareToCoordinates: squareToCoordinates,
		coordinatesToSquare: coordinatesToSquare
	};

	/******************************************************************************
	 *                                                                            *
	 *    This file is part of Kokopu, a JavaScript chess library.                *
	 *    Copyright (C) 2018-2021  Yoann Le Montagner <yo35 -at- melix.net>       *
	 *                                                                            *
	 *    This program is free software: you can redistribute it and/or           *
	 *    modify it under the terms of the GNU Lesser General Public License      *
	 *    as published by the Free Software Foundation, either version 3 of       *
	 *    the License, or (at your option) any later version.                     *
	 *                                                                            *
	 *    This program is distributed in the hope that it will be useful,         *
	 *    but WITHOUT ANY WARRANTY; without even the implied warranty of          *
	 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the            *
	 *    GNU Lesser General Public License for more details.                     *
	 *                                                                            *
	 *    You should have received a copy of the GNU Lesser General               *
	 *    Public License along with this program. If not, see                     *
	 *    <http://www.gnu.org/licenses/>.                                         *
	 *                                                                            *
	 ******************************************************************************/






	var CASTLING_FLAG   = 0x01;
	var EN_PASSANT_FLAG = 0x02;
	var CAPTURE_FLAG    = 0x04;
	var PROMOTION_FLAG  = 0x08;


	var make = function(from, to, color, movingPiece, capturedPiece) {
		var flags = capturedPiece >= 0 ? CAPTURE_FLAG : 0x00;
		var movingColoredPiece = movingPiece*2 + color;
		return new MoveDescriptor(flags, from, to, movingColoredPiece, movingColoredPiece, capturedPiece, -1, -1);
	};


	var makeCastling = function(from, to, rookFrom, rookTo, color) {
		var movingKing = basetypes.KING*2 + color;
		var movingRook = basetypes.ROOK*2 + color;
		return new MoveDescriptor(CASTLING_FLAG, from, to, movingKing, movingKing, movingRook, rookFrom, rookTo);
	};


	var makeEnPassant = function(from, to, enPassantSquare, color) {
		var flags = EN_PASSANT_FLAG | CAPTURE_FLAG;
		var movingPawn = basetypes.PAWN*2 + color;
		var capturedPawn = basetypes.PAWN*2 + 1 - color;
		return new MoveDescriptor(flags, from, to, movingPawn, movingPawn, capturedPawn, enPassantSquare, -1);
	};


	var makePromotion = function(from, to, color, promotion, capturedPiece) {
		var flags = PROMOTION_FLAG | (capturedPiece >= 0 ? CAPTURE_FLAG : 0x00);
		var movingPawn = basetypes.PAWN*2 + color;
		var finalPiece = promotion*2 + color;
		return new MoveDescriptor(flags, from, to, movingPawn, finalPiece, capturedPiece, -1, -1);
	};


	/**
	 * @class
	 * @classdesc Describe a legal chess move, with its characteristics.
	 *
	 * @description This constructor is not exposed in the public Kokopu API. Only internal objects and functions
	 *              are allowed to instantiate {@link MoveDescriptor} objects.
	 */
	function MoveDescriptor(flags, from, to, movingPiece, finalPiece, optionalPiece, optionalSquare1, optionalSquare2) {
		this._type            = flags          ;
		this._from            = from           ;
		this._to              = to             ;
		this._movingPiece     = movingPiece    ;
		this._finalPiece      = finalPiece     ;
		this._optionalPiece   = optionalPiece  ; // Captured piece in case of capture, moving rook in case of castling.
		this._optionalSquare1 = optionalSquare1; // Rook-from or en-passant square.
		this._optionalSquare2 = optionalSquare2; // Rook-to.
	}


	/**
	 * Whether the given object is a {@link MoveDescriptor} or not.
	 *
	 * @param {Object} obj
	 * @returns {boolean}
	 */
	var isMoveDescriptor = function(obj) {
		return obj instanceof MoveDescriptor;
	};


	MoveDescriptor.prototype.toString = function() {
		var result = basetypes.squareToString(this._from) + basetypes.squareToString(this._to);
		if(this.isPromotion()) {
			result += this.promotion().toUpperCase();
		}
		else if(this.isCastling()) {
			result += 'O';
		}
		return result;
	};


	/**
	 * Whether or not the current move is a castling move.
	 *
	 * @returns {boolean}
	 */
	MoveDescriptor.prototype.isCastling = function() {
		return (this._type & CASTLING_FLAG) !== 0;
	};


	/**
	 * Whether or not the current move is a *en-passant* move.
	 *
	 * @returns {boolean}
	 */
	MoveDescriptor.prototype.isEnPassant = function() {
		return (this._type & EN_PASSANT_FLAG) !== 0;
	};


	/**
	 * Whether or not the current move is a capture (either a regular capture or a *en-passant* capture).
	 *
	 * @returns {boolean}
	 */
	MoveDescriptor.prototype.isCapture = function() {
		return (this._type & CAPTURE_FLAG) !== 0;
	};


	/**
	 * Whether or not the current move is a promotion.
	 *
	 * @returns {boolean}
	 */
	MoveDescriptor.prototype.isPromotion = function() {
		return (this._type & PROMOTION_FLAG) !== 0;
	};


	/**
	 * Origin square of the moving piece. In case of castling, this is the origin square of the king.
	 *
	 * @returns {Square}
	 */
	MoveDescriptor.prototype.from = function() {
		return basetypes.squareToString(this._from);
	};


	/**
	 * Destination square of the moving piece. In case of castling, this is the destination square of the king.
	 *
	 * @returns {Square}
	 */
	MoveDescriptor.prototype.to = function() {
		return basetypes.squareToString(this._to);
	};


	/**
	 * Color of the moving piece.
	 *
	 * @returns {Color}
	 */
	MoveDescriptor.prototype.color = function() {
		return basetypes.colorToString(this._movingPiece % 2);
	};


	/**
	 * Type of the moving piece. In case of castling, the moving piece is considered to be the king.
	 *
	 * @returns {Piece}
	 */
	MoveDescriptor.prototype.movingPiece = function() {
		return basetypes.pieceToString(Math.floor(this._movingPiece / 2));
	};


	/**
	 * Color and type of the moving piece. In case of castling, the moving piece is considered to be the king.
	 *
	 * @returns {ColoredPiece}
	 */
	MoveDescriptor.prototype.movingColoredPiece = function() {
		return basetypes.coloredPieceToString(this._movingPiece);
	};


	/**
	 * Type of the captured piece.
	 *
	 * @returns {Piece}
	 * @throws {module:exception.IllegalArgument} If the current move is not a capture (see {@link MoveDescriptor#isCapture}).
	 */
	MoveDescriptor.prototype.capturedPiece = function() {
		if(!this.isCapture()) { throw new exception.IllegalArgument('MoveDescriptor#capturedPiece()'); }
		return basetypes.pieceToString(Math.floor(this._optionalPiece / 2));
	};


	/**
	 * Color and type of the captured piece.
	 *
	 * @returns {ColoredPiece}
	 * @throws {module:exception.IllegalArgument} If the current move is not a capture (see {@link MoveDescriptor#isCapture}).
	 */
	MoveDescriptor.prototype.capturedColoredPiece = function() {
		if(!this.isCapture()) { throw new exception.IllegalArgument('MoveDescriptor#capturedColoredPiece()'); }
		return basetypes.coloredPieceToString(this._optionalPiece);
	};


	/**
	 * Origin square of the rook, in case of a castling move.
	 *
	 * @returns {Square}
	 * @throws {module:exception.IllegalArgument} If the current move is not a castling move (see {@link MoveDescriptor#isCastling}).
	 */
	MoveDescriptor.prototype.rookFrom = function() {
		if(!this.isCastling()) { throw new exception.IllegalArgument('MoveDescriptor#rookFrom()'); }
		return basetypes.squareToString(this._optionalSquare1);
	};


	/**
	 * Destination square of the rook, in case of a castling move.
	 *
	 * @returns {Square}
	 * @throws {module:exception.IllegalArgument} If the current move is not a castling move (see {@link MoveDescriptor#isCastling}).
	 */
	MoveDescriptor.prototype.rookTo = function() {
		if(!this.isCastling()) { throw new exception.IllegalArgument('MoveDescriptor#rookTo()'); }
		return basetypes.squareToString(this._optionalSquare2);
	};


	/**
	 * Square containing the captured pawn, in case of a *en-passant* move.
	 *
	 * @returns {Square}
	 * @throws {module:exception.IllegalArgument} If the current move is not a *en-passant* move (see {@link MoveDescriptor#isEnPassant}).
	 */
	MoveDescriptor.prototype.enPassantSquare = function() {
		if(!this.isEnPassant()) { throw new exception.IllegalArgument('MoveDescriptor#enPassantSquare()'); }
		return basetypes.squareToString(this._optionalSquare1);
	};


	/**
	 * Type of the promoted piece, in case of a promotion.
	 *
	 * @returns {Piece}
	 * @throws {module:exception.IllegalArgument} If the current move is not a promotion (see {@link MoveDescriptor#isPromotion}).
	 */
	MoveDescriptor.prototype.promotion = function() {
		if(!this.isPromotion()) { throw new exception.IllegalArgument('MoveDescriptor#promotion()'); }
		return basetypes.pieceToString(Math.floor(this._finalPiece / 2));
	};


	/**
	 * Color and type of the promoted piece, in case of a promotion.
	 *
	 * @returns {ColoredPiece}
	 * @throws {module:exception.IllegalArgument} If the current move is not a promotion (see {@link MoveDescriptor#isPromotion}).
	 */
	MoveDescriptor.prototype.coloredPromotion = function() {
		if(!this.isPromotion()) { throw new exception.IllegalArgument('MoveDescriptor#coloredPromotion()'); }
		return basetypes.coloredPieceToString(this._finalPiece);
	};

	var movedescriptor = {
		make: make,
		makeCastling: makeCastling,
		makeEnPassant: makeEnPassant,
		makePromotion: makePromotion,
		isMoveDescriptor: isMoveDescriptor
	};

	/******************************************************************************
	 *                                                                            *
	 *    This file is part of Kokopu, a JavaScript chess library.                *
	 *    Copyright (C) 2018-2021  Yoann Le Montagner <yo35 -at- melix.net>       *
	 *                                                                            *
	 *    This program is free software: you can redistribute it and/or           *
	 *    modify it under the terms of the GNU Lesser General Public License      *
	 *    as published by the Free Software Foundation, either version 3 of       *
	 *    the License, or (at your option) any later version.                     *
	 *                                                                            *
	 *    This program is distributed in the hope that it will be useful,         *
	 *    but WITHOUT ANY WARRANTY; without even the implied warranty of          *
	 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the            *
	 *    GNU Lesser General Public License for more details.                     *
	 *                                                                            *
	 *    You should have received a copy of the GNU Lesser General               *
	 *    Public License along with this program. If not, see                     *
	 *    <http://www.gnu.org/licenses/>.                                         *
	 *                                                                            *
	 ******************************************************************************/



	var EMPTY$1 = basetypes.EMPTY;
	var INVALID$1 = basetypes.INVALID;


	var makeEmpty = function(variant) {
		return {

			// Board state
			board: [
				EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1,
				EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1,
				EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1,
				EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1,
				EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1,
				EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1,
				EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1,
				EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1
			],

			// Flags
			turn: basetypes.WHITE,
			castling: [0, 0],
			enPassant: -1,
			variant: variant,

			// Computed attributes
			legal: variant === basetypes.NO_KING,
			king: [-1, -1]
		};
	};


	var makeInitial = function() {
		return {

			// Board state
			board: [
				basetypes.WR, basetypes.WN, basetypes.WB, basetypes.WQ, basetypes.WK, basetypes.WB, basetypes.WN, basetypes.WR, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1,
				basetypes.WP, basetypes.WP, basetypes.WP, basetypes.WP, basetypes.WP, basetypes.WP, basetypes.WP, basetypes.WP, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1,
				EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1,
				EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1,
				EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1,
				EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1,
				basetypes.BP, basetypes.BP, basetypes.BP, basetypes.BP, basetypes.BP, basetypes.BP, basetypes.BP, basetypes.BP, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1,
				basetypes.BR, basetypes.BN, basetypes.BB, basetypes.BQ, basetypes.BK, basetypes.BB, basetypes.BN, basetypes.BR
			],

			// Flags
			turn: basetypes.WHITE,
			castling: [129 /* (1 << A-file) | (1 << H-file) */, 129],
			enPassant: -1,
			variant: basetypes.REGULAR_CHESS,

			// Computed attributes
			legal: true,
			king: [4 /* e1 */, 116 /* e8 */]
		};
	};


	/**
	 * Chess960 initial position, following the numbering scheme proposed by Reinhard Scharnagl (see for instance https://chess960.net/start-positions/).
	 */
	var make960FromScharnagl = function(scharnaglCode) {
		var info = decodeScharnagl(scharnaglCode);
		var r1 = info.scheme.map(function(piece) { return piece*2 + basetypes.WHITE; });
		var r8 = info.scheme.map(function(piece) { return piece*2 + basetypes.BLACK; });
		return {

			// Board state
			board: [
				r1[0], r1[1], r1[2], r1[3], r1[4], r1[5], r1[6], r1[7], INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1,
				basetypes.WP, basetypes.WP, basetypes.WP, basetypes.WP, basetypes.WP, basetypes.WP, basetypes.WP, basetypes.WP, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1,
				EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1,
				EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1,
				EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1,
				EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, EMPTY$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1,
				basetypes.BP, basetypes.BP, basetypes.BP, basetypes.BP, basetypes.BP, basetypes.BP, basetypes.BP, basetypes.BP, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1, INVALID$1,
				r8[0], r8[1], r8[2], r8[3], r8[4], r8[5], r8[6], r8[7]
			],

			// Flags
			turn: basetypes.WHITE,
			castling: [info.castling, info.castling],
			enPassant: -1,
			variant: basetypes.CHESS960,

			// Computed attributes
			legal: true,
			king: [info.kingFile, 112 + info.kingFile]
		};
	};


	function decodeScharnagl(scharnaglCode) {
		var scheme = [-1, -1, -1, -1, -1, -1, -1, -1];
		var castling = 0;
		var kingFile = -1;

		function forEachEmpty(fun) {
			var emptyIndex = 0;
			for(var file = 0; file < 8; ++file) {
				if(scheme[file] >= 0) { continue; }

				fun(file, emptyIndex);
				++emptyIndex;
			}
		}

		function setAt(piece, target1, target2) {
			forEachEmpty(function(file, emptyIndex) {
				if(emptyIndex === target1 || emptyIndex === target2) {
					scheme[file] = piece;
				}
			});
		}

		// Light-square bishop
		scheme[(scharnaglCode % 4) * 2 + 1] = basetypes.BISHOP;
		scharnaglCode = Math.floor(scharnaglCode / 4);

		// Dark-square bishop
		scheme[(scharnaglCode % 4) * 2] = basetypes.BISHOP;
		scharnaglCode = Math.floor(scharnaglCode / 4);

		// Queen
		setAt(basetypes.QUEEN, scharnaglCode % 6, -1);
		scharnaglCode = Math.floor(scharnaglCode / 6);

		// Knights
		switch(scharnaglCode) {
			case 0: setAt(basetypes.KNIGHT, 0, 1); break;
			case 1: setAt(basetypes.KNIGHT, 0, 2); break;
			case 2: setAt(basetypes.KNIGHT, 0, 3); break;
			case 3: setAt(basetypes.KNIGHT, 0, 4); break;
			case 4: setAt(basetypes.KNIGHT, 1, 2); break;
			case 5: setAt(basetypes.KNIGHT, 1, 3); break;
			case 6: setAt(basetypes.KNIGHT, 1, 4); break;
			case 7: setAt(basetypes.KNIGHT, 2, 3); break;
			case 8: setAt(basetypes.KNIGHT, 2, 4); break;
			case 9: setAt(basetypes.KNIGHT, 3, 4); break;
		}

		// Rooks and king
		forEachEmpty(function(file, emptyIndex) {
			if(emptyIndex === 1) {
				scheme[file] = basetypes.KING;
				kingFile = file;
			}
			else {
				scheme[file] = basetypes.ROOK;
				castling |= 1 << file;
			}
		});

		return {
			scheme: scheme,
			castling: castling,
			kingFile: kingFile
		};
	}


	var makeCopy = function(position) {
		return {
			board    : position.board.slice(),
			turn     : position.turn,
			castling : position.castling.slice(),
			enPassant: position.enPassant,
			variant  : position.variant,
			legal    : position.legal,
			king     : position.king.slice()
		};
	};

	var impl = {
		makeEmpty: makeEmpty,
		makeInitial: makeInitial,
		make960FromScharnagl: make960FromScharnagl,
		makeCopy: makeCopy
	};

	/******************************************************************************
	 *                                                                            *
	 *    This file is part of Kokopu, a JavaScript chess library.                *
	 *    Copyright (C) 2018-2021  Yoann Le Montagner <yo35 -at- melix.net>       *
	 *                                                                            *
	 *    This program is free software: you can redistribute it and/or           *
	 *    modify it under the terms of the GNU Lesser General Public License      *
	 *    as published by the Free Software Foundation, either version 3 of       *
	 *    the License, or (at your option) any later version.                     *
	 *                                                                            *
	 *    This program is distributed in the hope that it will be useful,         *
	 *    but WITHOUT ANY WARRANTY; without even the implied warranty of          *
	 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the            *
	 *    GNU Lesser General Public License for more details.                     *
	 *                                                                            *
	 *    You should have received a copy of the GNU Lesser General               *
	 *    Public License along with this program. If not, see                     *
	 *    <http://www.gnu.org/licenses/>.                                         *
	 *                                                                            *
	 ******************************************************************************/








	var FEN_PIECE_SYMBOL = 'KkQqRrBbNnPp';


	/**
	 * Return a human-readable string representing the position. This string is multi-line,
	 * and is intended to be displayed in a fixed-width font (similarly to an ASCII-art picture).
	 */
	var ascii = function(position) {

		// Board scanning
		var result = '+---+---+---+---+---+---+---+---+\n';
		for(var r=7; r>=0; --r) {
			for(var f=0; f<8; ++f) {
				var cp = position.board[r*16 + f];
				result += '| ' + (cp < 0 ? ' ' : FEN_PIECE_SYMBOL[cp]) + ' ';
			}
			result += '|\n';
			result += '+---+---+---+---+---+---+---+---+\n';
		}

		// Flags
		result += basetypes.colorToString(position.turn) + ' ' + castlingToString(position) + ' ' + enPassantToString(position);
		if(position.variant !== basetypes.REGULAR_CHESS) {
			result += ' (' + basetypes.variantToString(position.variant) + ')';
		}

		return result;
	};


	var getFEN = function(position, fiftyMoveClock, fullMoveNumber) {
		var result = '';

		// Board scanning
		for(var r=7; r>=0; --r) {
			var emptyCount = 0;
			for(var f=0; f<8; ++f) {
				var cp = position.board[r*16 + f];
				if(cp < 0) {
					++emptyCount;
				}
				else {
					if(emptyCount > 0) {
						result += emptyCount;
						emptyCount = 0;
					}
					result += FEN_PIECE_SYMBOL[cp];
				}
			}
			if(emptyCount > 0) {
				result += emptyCount;
			}
			if(r > 0) {
				result += '/';
			}
		}

		// Flags + additional move counters
		result += ' ' + basetypes.colorToString(position.turn) + ' ' + castlingToString(position) + ' ' + enPassantToString(position);
		result += ' ' + fiftyMoveClock + ' ' + fullMoveNumber;

		return result;
	};


	function castlingToString(position) {
		if(position.variant === basetypes.CHESS960) {
			var whiteFlags = '';
			var blackFlags = '';
			for(var file = 0; file < 8; ++file) {
				if(position.castling[basetypes.WHITE] & 1 << file) { whiteFlags += basetypes.fileToString(file); }
				if(position.castling[basetypes.BLACK] & 1 << file) { blackFlags += basetypes.fileToString(file); }
			}
			return whiteFlags === '' && blackFlags === '' ? '-' : whiteFlags.toUpperCase() + blackFlags;
		}
		else {
			var result = '';
			if(position.castling[basetypes.WHITE] & 1<<7) { result += 'K'; }
			if(position.castling[basetypes.WHITE] & 1<<0) { result += 'Q'; }
			if(position.castling[basetypes.BLACK] & 1<<7) { result += 'k'; }
			if(position.castling[basetypes.BLACK] & 1<<0) { result += 'q'; }
			return result === '' ? '-' : result;
		}
	}


	function enPassantToString(position) {
		return position.enPassant < 0 ? '-' : basetypes.fileToString(position.enPassant) + (position.turn===basetypes.WHITE ? '6' : '3');
	}


	var parseFEN = function(variant, fen, strict) {

		// Trim the input string and split it into 6 fields.
		fen = fen.replace(/^\s+|\s+$/g, '');
		var fields = fen.split(/\s+/);
		if(fields.length !== 6) {
			throw new exception.InvalidFEN(fen, i18n.WRONG_NUMBER_OF_FEN_FIELDS);
		}

		// The first field (that represents the board) is split in 8 sub-fields.
		var rankFields = fields[0].split('/');
		if(rankFields.length !== 8) {
			throw new exception.InvalidFEN(fen, i18n.WRONG_NUMBER_OF_SUBFIELDS_IN_BOARD_FIELD);
		}

		// Initialize the position
		var position = impl.makeEmpty(variant);
		position.legal = null;

		// Board parsing
		for(var r=7; r>=0; --r) {
			var rankField = rankFields[7-r];
			var i = 0;
			var f = 0;
			while(i<rankField.length && f<8) {
				var s = rankField[i];
				var cp = FEN_PIECE_SYMBOL.indexOf(s);

				// The current character is in the range [1-8] -> skip the corresponding number of squares.
				if(/^[1-8]$/.test(s)) {
					f += parseInt(s, 10);
				}

				// The current character corresponds to a colored piece symbol -> set the current square accordingly.
				else if(cp >= 0) {
					position.board[r*16 + f] = cp;
					++f;
				}

				// Otherwise -> parsing error.
				else {
					throw new exception.InvalidFEN(fen, i18n.UNEXPECTED_CHARACTER_IN_BOARD_FIELD, s);
				}

				// Increment the character counter.
				++i;
			}

			// Ensure that the current sub-field deals with all the squares of the current rank.
			if(i !== rankField.length || f !== 8) {
				throw new exception.InvalidFEN(fen, i18n.UNEXPECTED_END_OF_SUBFIELD_IN_BOARD_FIELD, i18n.ORDINALS[7-r]);
			}
		}

		// Turn parsing
		position.turn = basetypes.colorFromString(fields[1]);
		if(position.turn < 0) {
			throw new exception.InvalidFEN(fen, i18n.INVALID_TURN_FIELD);
		}

		// Castling rights parsing
		position.castling = variant === basetypes.CHESS960 ? castlingFromStringXFEN(fields[2], strict, position.board) :
			castlingFromStringFEN(fields[2], strict);
		if(position.castling === null) {
			throw new exception.InvalidFEN(fen, i18n.INVALID_CASTLING_FIELD);
		}

		// En-passant rights parsing
		var enPassantField = fields[3];
		if(enPassantField !== '-') {
			if(!/^[a-h][36]$/.test(enPassantField)) {
				throw new exception.InvalidFEN(fen, i18n.INVALID_EN_PASSANT_FIELD);
			}
			if(strict && ((enPassantField[1]==='3' && position.turn===basetypes.WHITE) || (enPassantField[1]==='6' && position.turn===basetypes.BLACK))) {
				throw new exception.InvalidFEN(fen, i18n.WRONG_RANK_IN_EN_PASSANT_FIELD);
			}
			position.enPassant = basetypes.fileFromString(enPassantField[0]);
		}

		// Move counting flags parsing
		var moveCountingRegExp = strict ? /^(?:0|[1-9][0-9]*)$/ : /^[0-9]+$/;
		if(!moveCountingRegExp.test(fields[4])) {
			throw new exception.InvalidFEN(fen, i18n.INVALID_MOVE_COUNTING_FIELD, i18n.ORDINALS[4]);
		}
		if(!moveCountingRegExp.test(fields[5])) {
			throw new exception.InvalidFEN(fen, i18n.INVALID_MOVE_COUNTING_FIELD, i18n.ORDINALS[5]);
		}
		return { position: position, fiftyMoveClock: parseInt(fields[4], 10), fullMoveNumber: parseInt(fields[5], 10) };
	};


	function castlingFromStringFEN(castling, strict) {
		var res = [0, 0];
		if(castling === '-') {
			return res;
		}
		if(!(strict ? /^K?Q?k?q?$/ : /^[KQkq]*$/).test(castling)) {
			return null;
		}
		if(castling.indexOf('K') >= 0) { res[basetypes.WHITE] |= 1<<7; }
		if(castling.indexOf('Q') >= 0) { res[basetypes.WHITE] |= 1<<0; }
		if(castling.indexOf('k') >= 0) { res[basetypes.BLACK] |= 1<<7; }
		if(castling.indexOf('q') >= 0) { res[basetypes.BLACK] |= 1<<0; }
		return res;
	}


	function castlingFromStringXFEN(castling, strict, board) {
		var result = [0, 0];
		if(castling === '-') {
			return result;
		}
		if(!(strict ? /^[A-H]{0,2}[a-h]{0,2}$/ : /^[A-Ha-h]*|[KQkq]*$/).test(castling)) {
			return null;
		}

		function searchQueenSideRook(color) {
			var targetRook = basetypes.ROOK * 2 + color;
			var targetKing = basetypes.KING * 2 + color;
			for(var sq = 112*color; sq < 112*color + 8; ++sq) {
				if(board[sq] === targetRook) {
					return sq % 8;
				}
				else if(board[sq] === targetKing) {
					break;
				}
			}
			return 0;
		}

		function searchKingSideRook(color) {
			var targetRook = basetypes.ROOK * 2 + color;
			var targetKing = basetypes.KING * 2 + color;
			for(var sq = 112*color + 7; sq >= 112*color; --sq) {
				if(board[sq] === targetRook) {
					return sq % 8;
				}
				else if(board[sq] === targetKing) {
					break;
				}
			}
			return 7;
		}

		if(castling.indexOf('K') >= 0) { result[basetypes.WHITE] |= 1 << searchKingSideRook (basetypes.WHITE); }
		if(castling.indexOf('Q') >= 0) { result[basetypes.WHITE] |= 1 << searchQueenSideRook(basetypes.WHITE); }
		if(castling.indexOf('k') >= 0) { result[basetypes.BLACK] |= 1 << searchKingSideRook (basetypes.BLACK); }
		if(castling.indexOf('q') >= 0) { result[basetypes.BLACK] |= 1 << searchQueenSideRook(basetypes.BLACK); }

		for(var file = 0; file < 8; ++file) {
			var s = basetypes.fileToString(file);
			if(castling.indexOf(s.toUpperCase()) >= 0) { result[basetypes.WHITE] |= 1 << file; }
			if(castling.indexOf(s              ) >= 0) { result[basetypes.BLACK] |= 1 << file; }
		}
		return result;
	}

	var fen = {
		ascii: ascii,
		getFEN: getFEN,
		parseFEN: parseFEN
	};

	/******************************************************************************
	 *                                                                            *
	 *    This file is part of Kokopu, a JavaScript chess library.                *
	 *    Copyright (C) 2018-2021  Yoann Le Montagner <yo35 -at- melix.net>       *
	 *                                                                            *
	 *    This program is free software: you can redistribute it and/or           *
	 *    modify it under the terms of the GNU Lesser General Public License      *
	 *    as published by the Free Software Foundation, either version 3 of       *
	 *    the License, or (at your option) any later version.                     *
	 *                                                                            *
	 *    This program is distributed in the hope that it will be useful,         *
	 *    but WITHOUT ANY WARRANTY; without even the implied warranty of          *
	 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the            *
	 *    GNU Lesser General Public License for more details.                     *
	 *                                                                            *
	 *    You should have received a copy of the GNU Lesser General               *
	 *    Public License along with this program. If not, see                     *
	 *    <http://www.gnu.org/licenses/>.                                         *
	 *                                                                            *
	 ******************************************************************************/

	var attacks = createCommonjsModule(function (module, exports) {





	// Attack directions per colored piece.
	var ATTACK_DIRECTIONS = exports.ATTACK_DIRECTIONS = [
		[-17, -16, -15, -1, 1, 15, 16, 17], // king/queen
		[-17, -16, -15, -1, 1, 15, 16, 17], // king/queen
		[-17, -16, -15, -1, 1, 15, 16, 17], // king/queen
		[-17, -16, -15, -1, 1, 15, 16, 17], // king/queen
		[-16, -1, 1, 16], // rook
		[-16, -1, 1, 16], // rook
		[-17, -15, 15, 17], // bishop
		[-17, -15, 15, 17], // bishop
		[-33, -31, -18, -14, 14, 18, 31, 33], // knight
		[-33, -31, -18, -14, 14, 18, 31, 33], // knight
		[15, 17], // white pawn
		[-17, -15] // black pawn
	];



	// -----------------------------------------------------------------------------
	// isAttacked
	// -----------------------------------------------------------------------------

	/**
	 * Check if any piece of the given color attacks a given square.
	 */
	exports.isAttacked = function(position, square, attackerColor) {
		return isAttackedByNonSliding(position, square, basetypes.KING*2 + attackerColor) ||
			isAttackedByNonSliding(position, square, basetypes.KNIGHT*2 + attackerColor) ||
			isAttackedByNonSliding(position, square, basetypes.PAWN*2 + attackerColor) ||
			isAttackedBySliding(position, square, basetypes.ROOK*2 + attackerColor, basetypes.QUEEN*2 + attackerColor) ||
			isAttackedBySliding(position, square, basetypes.BISHOP*2 + attackerColor, basetypes.QUEEN*2 + attackerColor);
	};


	function isAttackedByNonSliding(position, square, nonSlidingAttacker) {
		var directions = ATTACK_DIRECTIONS[nonSlidingAttacker];
		for(var i=0; i<directions.length; ++i) {
			var sq = square - directions[i];
			if((sq & 0x88) === 0 && position.board[sq] === nonSlidingAttacker) {
				return true;
			}
		}
		return false;
	}


	function isAttackedBySliding(position, square, slidingAttacker, queenAttacker) {
		var directions = ATTACK_DIRECTIONS[slidingAttacker];
		for(var i=0; i<directions.length; ++i) {
			var sq = square;
			while(true) {
				sq -= directions[i];
				if((sq & 0x88)===0) {
					var cp = position.board[sq];
					if(cp === basetypes.EMPTY) { continue; }
					else if(cp === slidingAttacker || cp===queenAttacker) { return true; }
				}
				break;
			}
		}
		return false;
	}



	// -----------------------------------------------------------------------------
	// getAttacks
	// -----------------------------------------------------------------------------

	/**
	 * Return the squares from which a piece of the given color attacks a given square.
	 */
	exports.getAttacks = function(position, square, attackerColor) {
		var result = [];
		findNonSlidingAttacks(position, square, result, basetypes.KING*2 + attackerColor);
		findNonSlidingAttacks(position, square, result, basetypes.KNIGHT*2 + attackerColor);
		findNonSlidingAttacks(position, square, result, basetypes.PAWN*2 + attackerColor);
		findSlidingAttacks(position, square, result, basetypes.ROOK*2 + attackerColor, basetypes.QUEEN*2 + attackerColor);
		findSlidingAttacks(position, square, result, basetypes.BISHOP*2 + attackerColor, basetypes.QUEEN*2 + attackerColor);
		return result;
	};


	function findNonSlidingAttacks(position, square, result, nonSlidingAttacker) {
		var directions = ATTACK_DIRECTIONS[nonSlidingAttacker];
		for(var i=0; i<directions.length; ++i) {
			var sq = square - directions[i];
			if((sq & 0x88) === 0 && position.board[sq] === nonSlidingAttacker) {
				result.push(sq);
			}
		}
	}


	function findSlidingAttacks(position, square, result, slidingAttacker, queenAttacker) {
		var directions = ATTACK_DIRECTIONS[slidingAttacker];
		for(var i=0; i<directions.length; ++i) {
			var sq = square;
			while(true) {
				sq -= directions[i];
				if((sq & 0x88) === 0) {
					var cp = position.board[sq];
					if(cp === basetypes.EMPTY) { continue; }
					else if(cp === slidingAttacker || cp === queenAttacker) { result.push(sq); }
				}
				break;
			}
		}
	}
	});

	/******************************************************************************
	 *                                                                            *
	 *    This file is part of Kokopu, a JavaScript chess library.                *
	 *    Copyright (C) 2018-2021  Yoann Le Montagner <yo35 -at- melix.net>       *
	 *                                                                            *
	 *    This program is free software: you can redistribute it and/or           *
	 *    modify it under the terms of the GNU Lesser General Public License      *
	 *    as published by the Free Software Foundation, either version 3 of       *
	 *    the License, or (at your option) any later version.                     *
	 *                                                                            *
	 *    This program is distributed in the hope that it will be useful,         *
	 *    but WITHOUT ANY WARRANTY; without even the implied warranty of          *
	 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the            *
	 *    GNU Lesser General Public License for more details.                     *
	 *                                                                            *
	 *    You should have received a copy of the GNU Lesser General               *
	 *    Public License along with this program. If not, see                     *
	 *    <http://www.gnu.org/licenses/>.                                         *
	 *                                                                            *
	 ******************************************************************************/

	var legality = createCommonjsModule(function (module, exports) {






	/**
	 * Check whether the given position is legal or not.
	 *
	 * A position is considered to be legal if all the following conditions are met:
	 *
	 *  1. There is exactly one white king and one black king on the board (or more generally,
		     the number of kings on the board matches the game variant of the position).
	 *  2. The player that is not about to play is not check.
	 *  3. There are no pawn on rows 1 and 8.
	 *  4. For each colored castle flag set, there is a rook and a king on the
	 *     corresponding initial squares.
	 *  5. The pawn situation is consistent with the en-passant flag if it is set.
	 *     For instance, if it is set to the 'e' column and black is about to play,
	 *     the squares e2 and e3 must be empty, and there must be a white pawn on e4.
	 */
	exports.isLegal = function(position) {
		refreshLegalFlagAndKingSquares(position);
		return position.legal;
	};


	/**
	 * Refresh the legal flag of the given position if it is set to null
	 * (which means that the legality state of the position is unknown).
	 *
	 * Together with the legal flag, the reference to the squares where the white and
	 * black kings lie is updated by this function.
	 */
	var refreshLegalFlagAndKingSquares = exports.refreshLegalFlagAndKingSquares = function(position) {
		if(position.legal !== null) {
			return;
		}
		position.legal = false;

		// Condition (1)
		var whiteKingOK = refreshKingSquare(position, basetypes.WHITE);
		var blackKingOK = refreshKingSquare(position, basetypes.BLACK);
		if(!whiteKingOK || !blackKingOK) {
			return;
		}

		// Condition (2)
		if(position.king[1-position.turn] >= 0 && attacks.isAttacked(position, position.king[1-position.turn], position.turn)) {
			return;
		}

		// Condition (3)
		for(var c=0; c<8; ++c) {
			var cp1 = position.board[c];
			var cp8 = position.board[112 + c];
			if(cp1 === basetypes.WP || cp8 === basetypes.WP || cp1 === basetypes.BP || cp8 === basetypes.BP) {
				return;
			}
		}

		// Condition (4)
		var isCastlingFlagLegalFun = position.variant === basetypes.CHESS960 ? isCastlingFlagLegalForChess960 : isCastlingFlagLegalForRegularChess;
		for(var color=0; color<2; ++color) {
			if(!isCastlingFlagLegalFun(position, color)) {
				return;
			}
		}

		// Condition (5)
		if(position.enPassant >= 0) {
			var square2 = (6-position.turn*5)*16 + position.enPassant;
			var square3 = (5-position.turn*3)*16 + position.enPassant;
			var square4 = (4-position.turn  )*16 + position.enPassant;
			if(!(position.board[square2]===basetypes.EMPTY && position.board[square3]===basetypes.EMPTY && position.board[square4]===basetypes.PAWN*2+1-position.turn)) {
				return;
			}
		}

		// At this point, all the conditions (1) to (5) hold, so the position can be flagged as legal.
		position.legal = true;
	};


	/**
	 * Detect the kings of the given color that are present on the chess board.
	 */
	function refreshKingSquare(position, color) {
		var target = basetypes.KING*2 + color;
		position.king[color] = -1;
		for(var sq=0; sq<120; sq += (sq & 0x7)===7 ? 9 : 1) {
			if(position.board[sq] === target) {

				// If the targeted king is detected on the square sq, two situations may occur:
				// 1) No king was detected on the previously visited squares: then the current
				//    square is saved, and loop over the next board squares goes on.
				if(position.king[color] < 0) {
					position.king[color] = sq;
				}

				// 2) Another king was detected on the previously visited squares: then the buffer position.king[color]
				//    is set to the invalid state (-1), and the loop is interrupted.
				else {
					position.king[color] = -1;
					return false;
				}
			}
		}
		return position.variant === basetypes.NO_KING || position.variant === basetypes.BLACK_KING_ONLY - color ? position.king[color] < 0 : position.king[color] >= 0;
	}


	function isCastlingFlagLegalForRegularChess(position, color) {
		var skipOO  = (position.castling[color] & 0x80) === 0;
		var skipOOO = (position.castling[color] & 0x01) === 0;
		var rookHOK = skipOO              || position.board[7 + 112*color] === basetypes.ROOK*2 + color;
		var rookAOK = skipOOO             || position.board[0 + 112*color] === basetypes.ROOK*2 + color;
		var kingOK  = (skipOO && skipOOO) || position.board[4 + 112*color] === basetypes.KING*2 + color;
		return kingOK && rookAOK && rookHOK;
	}


	function isCastlingFlagLegalForChess960(position, color) {
		var files = [];
		for(var file=0; file<8; ++file) {
			if((position.castling[color] & 1 << file) === 0) {
				continue;
			}

			// Ensure there is a rook on each square for which the corresponding file flag is set.
			if(position.board[file + 112*color] !== basetypes.ROOK*2 + color) {
				return;
			}
			files.push(file);
		}

		// Additional check on the king position, depending on the number of file flags.
		switch(files.length) {
			case 0: return true;

			// 1 possible castle -> ensure the king is on the initial rank.
			case 1: return position.king[color] >= 112*color && position.king[color] <= 7 + 112*color;

			// 2 possible castles -> ensure the king is between the two rooks.
			case 2: return position.king[color] > files[0] + 112*color && position.king[color] < files[1] + 112*color;

			default: return false;
		}
	}
	});

	/******************************************************************************
	 *                                                                            *
	 *    This file is part of Kokopu, a JavaScript chess library.                *
	 *    Copyright (C) 2018-2021  Yoann Le Montagner <yo35 -at- melix.net>       *
	 *                                                                            *
	 *    This program is free software: you can redistribute it and/or           *
	 *    modify it under the terms of the GNU Lesser General Public License      *
	 *    as published by the Free Software Foundation, either version 3 of       *
	 *    the License, or (at your option) any later version.                     *
	 *                                                                            *
	 *    This program is distributed in the hope that it will be useful,         *
	 *    but WITHOUT ANY WARRANTY; without even the implied warranty of          *
	 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the            *
	 *    GNU Lesser General Public License for more details.                     *
	 *                                                                            *
	 *    You should have received a copy of the GNU Lesser General               *
	 *    Public License along with this program. If not, see                     *
	 *    <http://www.gnu.org/licenses/>.                                         *
	 *                                                                            *
	 ******************************************************************************/

	var movegeneration = createCommonjsModule(function (module, exports) {








	/* eslint-disable no-mixed-spaces-and-tabs, indent */

	// Displacement lookup per square index difference.
	var /* const */ DISPLACEMENT_LOOKUP = [
	 204,    0,    0,    0,    0,    0,    0,   60,    0,    0,    0,    0,    0,    0,  204,    0,
		 0,  204,    0,    0,    0,    0,    0,   60,    0,    0,    0,    0,    0,  204,    0,    0,
		 0,    0,  204,    0,    0,    0,    0,   60,    0,    0,    0,    0,  204,    0,    0,    0,
		 0,    0,    0,  204,    0,    0,    0,   60,    0,    0,    0,  204,    0,    0,    0,    0,
		 0,    0,    0,    0,  204,    0,    0,   60,    0,    0,  204,    0,    0,    0,    0,    0,
		 0,    0,    0,    0,    0,  204,  768,   60,  768,  204,    0,    0,    0,    0,    0,    0,
		 0,    0,    0,    0,    0,  768, 2255, 2111, 2255,  768,    0,    0,    0,    0,    0,    0,
		60,   60,   60,   60,   60,   60,   63,    0,   63,   60,   60,   60,   60,   60,   60,    0,
		 0,    0,    0,    0,    0,  768, 1231, 1087, 1231,  768,    0,    0,    0,    0,    0,    0,
		 0,    0,    0,    0,    0,  204,  768,   60,  768,  204,    0,    0,    0,    0,    0,    0,
		 0,    0,    0,    0,  204,    0,    0,   60,    0,    0,  204,    0,    0,    0,    0,    0,
		 0,    0,    0,  204,    0,    0,    0,   60,    0,    0,    0,  204,    0,    0,    0,    0,
		 0,    0,  204,    0,    0,    0,    0,   60,    0,    0,    0,    0,  204,    0,    0,    0,
		 0,  204,    0,    0,    0,    0,    0,   60,    0,    0,    0,    0,    0,  204,    0,    0,
	 204,    0,    0,    0,    0,    0,    0,   60,    0,    0,    0,    0,    0,    0,  204,    0
	];

	// Sliding direction
	var /* const */ SLIDING_DIRECTION = [
		-17,   0,   0,   0,   0,   0,   0, -16,   0,   0,   0,   0,   0,   0, -15,   0,
			0, -17,   0,   0,   0,   0,   0, -16,   0,   0,   0,   0,   0, -15,   0,   0,
			0,   0, -17,   0,   0,   0,   0, -16,   0,   0,   0,   0, -15,   0,   0,   0,
			0,   0,   0, -17,   0,   0,   0, -16,   0,   0,   0, -15,   0,   0,   0,   0,
			0,   0,   0,   0, -17,   0,   0, -16,   0,   0, -15,   0,   0,   0,   0,   0,
			0,   0,   0,   0,   0, -17,   0, -16,   0, -15,   0,   0,   0,   0,   0,   0,
			0,   0,   0,   0,   0,   0, -17, -16, -15,   0,   0,   0,   0,   0,   0,   0,
		 -1,  -1,  -1,  -1,  -1,  -1,  -1,   0,   1,   1,   1,   1,   1,   1,   1,   0,
			0,   0,   0,   0,   0,   0,  15,  16,  17,   0,   0,   0,   0,   0,   0,   0,
			0,   0,   0,   0,   0,  15,   0,  16,   0,  17,   0,   0,   0,   0,   0,   0,
			0,   0,   0,   0,  15,   0,   0,  16,   0,   0,  17,   0,   0,   0,   0,   0,
			0,   0,   0,  15,   0,   0,   0,  16,   0,   0,   0,  17,   0,   0,   0,   0,
			0,   0,  15,   0,   0,   0,   0,  16,   0,   0,   0,   0,  17,   0,   0,   0,
			0,  15,   0,   0,   0,   0,   0,  16,   0,   0,   0,   0,   0,  17,   0,   0,
		 15,   0,   0,   0,   0,   0,   0,  16,   0,   0,   0,   0,   0,   0,  17,   0
	];

	/* eslint-enable no-mixed-spaces-and-tabs, indent */


	function isKingToMoveAttacked(position) {
		return position.king[position.turn] >= 0 && attacks.isAttacked(position, position.king[position.turn], 1-position.turn);
	}


	exports.isCheck = function(position) {
		return legality.isLegal(position) && isKingToMoveAttacked(position);
	};


	exports.isCheckmate = function(position) {
		return legality.isLegal(position) && !hasMove(position) && isKingToMoveAttacked(position);
	};


	exports.isStalemate = function(position) {
		return legality.isLegal(position) && !hasMove(position) && !isKingToMoveAttacked(position);
	};


	var hasMove = exports.hasMove = function(position) {
		function MoveFound() {}
		try {
			generateMoves(position, function(descriptor) {
				if(descriptor) { throw new MoveFound(); }
			});
			return false;
		}
		catch(err) {
			if(err instanceof MoveFound) { return true; }
			else { throw err; }
		}
	};


	exports.moves = function(position) {
		var res = [];
		generateMoves(position, function(descriptor, generatePromotions) {
			if(descriptor) {
				if(generatePromotions) {
					res.push(movedescriptor.makePromotion(descriptor._from, descriptor._to, position.turn, basetypes.QUEEN , descriptor._optionalPiece));
					res.push(movedescriptor.makePromotion(descriptor._from, descriptor._to, position.turn, basetypes.ROOK  , descriptor._optionalPiece));
					res.push(movedescriptor.makePromotion(descriptor._from, descriptor._to, position.turn, basetypes.BISHOP, descriptor._optionalPiece));
					res.push(movedescriptor.makePromotion(descriptor._from, descriptor._to, position.turn, basetypes.KNIGHT, descriptor._optionalPiece));
				}
				else {
					res.push(descriptor);
				}
			}
		});
		return res;
	};


	/**
	 * Generate all the legal moves of the given position.
	 */
	function generateMoves(position, fun) {

		// Ensure that the position is legal.
		if(!legality.isLegal(position)) { return; }

		// For all potential 'from' square...
		for(var from=0; from<120; from += (from & 0x7)===7 ? 9 : 1) {

			// Nothing to do if the current square does not contain a piece of the right color.
			var fromContent = position.board[from];
			var movingPiece = Math.floor(fromContent / 2);
			if(fromContent < 0 || fromContent%2 !== position.turn) {
				continue;
			}

			// Generate moves for pawns
			if(movingPiece === basetypes.PAWN) {

				// Capturing moves
				var attackDirections = attacks.ATTACK_DIRECTIONS[fromContent];
				for(var i=0; i<attackDirections.length; ++i) {
					var to = from + attackDirections[i];
					if((to & 0x88) === 0) {
						var toContent = position.board[to];
						if(toContent >= 0 && toContent%2 !== position.turn) { // regular capturing move
							fun(isKingSafeAfterMove(position, from, to, -1), to<8 || to>=112);
						}
						else if(toContent < 0 && to === (5-position.turn*3)*16 + position.enPassant) { // en-passant move
							fun(isKingSafeAfterMove(position, from, to, (4-position.turn)*16 + position.enPassant), false);
						}
					}
				}

				// Non-capturing moves
				var moveDirection = 16 - position.turn*32;
				var to = from + moveDirection;
				if(position.board[to] < 0) {
					fun(isKingSafeAfterMove(position, from, to, -1), to<8 || to>=112);

					// 2-square pawn move
					var firstSquareOfRow = (1 + position.turn*5) * 16;
					if(from>=firstSquareOfRow && from<firstSquareOfRow+8) {
						to += moveDirection;
						if(position.board[to] < 0) {
							fun(isKingSafeAfterMove(position, from, to, -1), false);
						}
					}
				}
			}

			// Generate moves for non-sliding non-pawn pieces
			else if(movingPiece===basetypes.KNIGHT || movingPiece===basetypes.KING) {
				var directions = attacks.ATTACK_DIRECTIONS[fromContent];
				for(var i=0; i<directions.length; ++i) {
					var to = from + directions[i];
					if((to & 0x88) === 0) {
						var toContent = position.board[to];
						if(toContent < 0 || toContent%2 !== position.turn) {
							fun(isKingSafeAfterMove(position, from, to, -1), false);
						}
					}
				}
			}

			// Generate moves for sliding pieces
			else {
				var directions = attacks.ATTACK_DIRECTIONS[fromContent];
				for(var i=0; i<directions.length; ++i) {
					for(var to = from + directions[i]; (to & 0x88) === 0; to += directions[i]) {
						var toContent = position.board[to];
						if(toContent < 0 || toContent%2 !== position.turn) {
							fun(isKingSafeAfterMove(position, from, to, -1), false);
						}
						if(toContent >= 0) { break; }
					}
				}
			}

			// Generate castling moves
			if(movingPiece === basetypes.KING && position.castling[position.turn] !== 0) {
				fun(isCastlingLegal(position, from, 2 + 112*position.turn), false);
				fun(isCastlingLegal(position, from, 6 + 112*position.turn), false);
			}
		}
	}


	/**
	 * Check whether the current player king is in check after moving from `from` to `to`.
	 *
	 * This function implements the verification steps (7) to (9) as defined in {@link #isMoveLegal}
	 *
	 * @param {number} enPassantSquare Index of the square where the "en-passant" taken pawn lies if any, `-1` otherwise.
	 * @returns {boolean|MoveDescriptor} The move descriptor if the move is legal, `false` otherwise.
	 */
	var isKingSafeAfterMove = exports.isKingSafeAfterMove = function(position, from, to, enPassantSquare) {
		var fromContent   = position.board[from];
		var toContent     = position.board[to  ];
		var movingPiece   = Math.floor(fromContent / 2);
		var kingSquare    = movingPiece===basetypes.KING ? to : position.king[position.turn];
		var kingIsInCheck = false;

		if(kingSquare >= 0) {

			// Step (7) -> Execute the displacement (castling moves are processed separately).
			position.board[to  ] = fromContent;
			position.board[from] = basetypes.EMPTY;
			if(enPassantSquare >= 0) {
				position.board[enPassantSquare] = basetypes.EMPTY;
			}

			// Step (8) -> Is the king safe after the displacement?
			kingIsInCheck = attacks.isAttacked(position, kingSquare, 1-position.turn);

			// Step (9) -> Reverse the displacement.
			position.board[from] = fromContent;
			position.board[to  ] = toContent;
			if(enPassantSquare >= 0) {
				position.board[enPassantSquare] = basetypes.PAWN*2 + 1-position.turn;
			}
		}

		// Final result
		if(kingIsInCheck) {
			return false;
		}
		else {
			if(enPassantSquare >= 0) {
				return movedescriptor.makeEnPassant(from, to, enPassantSquare, position.turn);
			}
			else {
				return movedescriptor.make(from, to, position.turn, movingPiece, toContent);
			}
		}
	};


	/**
	 * Delegated method for checking whether a castling move is legal or not.
	 */
	var isCastlingLegal = exports.isCastlingLegal = function(position, from, to) {

		// Origin and destination squares of the rook involved in the move.
		var castleFile = -1;
		var rookTo = -1;
		if(to === 2 + position.turn*112) {
			castleFile = position.variant === basetypes.CHESS960 ? findCastleFile(position.castling[position.turn], from % 16, -1) : 0;
			rookTo = 3 + 112*position.turn;
		}
		else if(to === 6 + position.turn*112) {
			castleFile = position.variant === basetypes.CHESS960 ? findCastleFile(position.castling[position.turn], from % 16, 1) : 7;
			rookTo = 5 + 112*position.turn;
		}
		else {
			return false;
		}

		// Ensure that the given underlying castling is allowed.
		if(position.variant === basetypes.CHESS960) {
			if(castleFile === -1) { return false; }
		}
		else {
			if((position.castling[position.turn] & 1<<castleFile) === 0) { return false; }
		}

		var rookFrom = castleFile + position.turn*112;

		// Ensure that each square on the trajectory is empty.
		for(var sq = Math.min(from, to, rookFrom, rookTo); sq <= Math.max(from, to, rookFrom, rookTo); ++sq) {
			if(sq !== from && sq !== rookFrom && position.board[sq] !== basetypes.EMPTY) { return false; }
		}

		// The origin and destination squares of the king, and the square between them must not be attacked.
		var byWho = 1 - position.turn;
		for(var sq = Math.min(from, to); sq <= Math.max(from, to); ++sq) {
			if(attacks.isAttacked(position, sq, byWho)) { return false; }
		}

		// The move is legal -> generate the move descriptor.
		return movedescriptor.makeCastling(from, to, rookFrom, rookTo, position.turn);
	};


	function findCastleFile(castlingFlag, kingFile, offset) {
		for(var file = kingFile + offset; file >= 0 && file < 8; file += offset) {
			if((castlingFlag & 1 << file) !== 0) { return file; }
		}
		return -1;
	}


	/**
	 * Core algorithm to determine whether a move is legal or not. The verification flow is the following:
	 *
	 *  1. Ensure that the position itself is legal.
	 *  2. Ensure that the origin square contains a piece (denoted as the moving-piece)
	 *     whose color is the same than the color of the player about to play.
	 *  4. Ensure that the displacement is geometrically correct, with respect to the moving piece.
	 *  5. Check the content of the destination square.
	 *  6. For the sliding pieces (and in case of a 2-square pawn move), ensure that there is no piece
	 *     on the trajectory.
	 *
	 * The move is almost ensured to be legal at this point. The last condition to check
	 * is whether the king of the current player will be in check after the move or not.
	 *
	 *  7. Execute the displacement from the origin to the destination square, in such a way that
	 *     it can be reversed. Only the state of the board is updated at this point.
	 *  8. Look for king attacks.
	 *  9. Reverse the displacement.
	 *
	 * Castling moves fail at step (4). They are taken out of this flow and processed
	 * by the dedicated method `isLegalCastling()`.
	 */
	exports.isMoveLegal = function(position, from, to) {

		// Step (1)
		if(!legality.isLegal(position)) { return false; }

		// Step (2)
		var fromContent = position.board[from];
		var toContent   = position.board[to  ];
		var movingPiece = Math.floor(fromContent / 2);
		if(fromContent < 0 || fromContent%2 !== position.turn) { return false; }

		// Miscellaneous variables
		var displacement = to - from + 119;
		var enPassantSquare = -1; // square where a pawn is taken if the move is "en-passant"
		var isTwoSquarePawnMove = false;
		var isPromotion = movingPiece===basetypes.PAWN && (to<8 || to>=112);

		// Compute the move descriptor corresponding to castling, if applicable.
		var castlingDescriptor = false;
		if(movingPiece === basetypes.KING && position.castling[position.turn] !== 0) {
			castlingDescriptor = isCastlingLegal(position, from, to);
		}

		// Step (4)
		if((DISPLACEMENT_LOOKUP[displacement] & 1 << fromContent) === 0) {
			if(movingPiece === basetypes.PAWN && displacement === 151-position.turn*64) {
				var firstSquareOfRow = (1 + position.turn*5) * 16;
				if(from < firstSquareOfRow || from >= firstSquareOfRow+8) { return false; }
				isTwoSquarePawnMove = true;
			}
			else {
				return castlingDescriptor;
			}
		}

		// Step (5) -> check the content of the destination square
		if(movingPiece === basetypes.PAWN) {
			if(displacement === 135-position.turn*32 || isTwoSquarePawnMove) { // non-capturing pawn move
				if(toContent !== basetypes.EMPTY) { return false; }
			}
			else if(toContent === basetypes.EMPTY) { // en-passant pawn move
				if(position.enPassant < 0 || to !== (5-position.turn*3)*16 + position.enPassant) { return false; }
				enPassantSquare = (4-position.turn)*16 + position.enPassant;
			}
			else { // regular capturing pawn move
				if(toContent%2 === position.turn) { return false; }
			}
		}
		else { // piece move
			if(toContent >= 0 && toContent%2 === position.turn) { return castlingDescriptor; }
		}

		// Step (6) -> For sliding pieces, ensure that there is nothing between the origin and the destination squares.
		if(movingPiece === basetypes.BISHOP || movingPiece === basetypes.ROOK || movingPiece === basetypes.QUEEN) {
			var direction = SLIDING_DIRECTION[displacement];
			for(var sq=from + direction; sq !== to; sq += direction) {
				if(position.board[sq] !== basetypes.EMPTY) { return false; }
			}
		}
		else if(isTwoSquarePawnMove) { // two-square pawn moves also require this test.
			if(position.board[(from + to) / 2] !== basetypes.EMPTY) { return false; }
		}

		// Steps (7) to (9) are delegated to `isKingSafeAfterMove`.
		var descriptor = isKingSafeAfterMove(position, from, to, enPassantSquare);
		if(descriptor && isPromotion) {
			return {
				type: 'promotion',
				build: function(promotion) {
					return promotion !== basetypes.PAWN && promotion !== basetypes.KING ?
						movedescriptor.makePromotion(descriptor._from, descriptor._to, descriptor._movingPiece % 2, promotion, descriptor._optionalPiece) :
						false;
				}
			};
		}
		else if(descriptor && castlingDescriptor) {
			return {
				type: 'castle960',
				build: function(type) {
					return type ? castlingDescriptor : descriptor;
				}
			};
		}
		else if(descriptor) {
			return descriptor;
		}
		else if(castlingDescriptor) {
			return castlingDescriptor;
		}
		else {
			return false;
		}
	};


	/**
	 * Play the move corresponding to the given descriptor.
	 */
	exports.play = function(position, descriptor) {

		// Update the board.
		position.board[descriptor._from] = basetypes.EMPTY; // WARNING: update `from` before `to` in case both squares are actually the same!
		if(descriptor.isEnPassant()) {
			position.board[descriptor._optionalSquare1] = basetypes.EMPTY;
		}
		else if(descriptor.isCastling()) {
			position.board[descriptor._optionalSquare1] = basetypes.EMPTY;
			position.board[descriptor._optionalSquare2] = descriptor._optionalPiece;
		}
		position.board[descriptor._to] = descriptor._finalPiece;

		var movingPiece = Math.floor(descriptor._movingPiece / 2);

		// Update the castling flags.
		if(movingPiece === basetypes.KING) {
			position.castling[position.turn] = 0;
		}
		if(descriptor._from <    8) { position.castling[basetypes.WHITE] &= ~(1 <<  descriptor._from    ); }
		if(descriptor._to   <    8) { position.castling[basetypes.WHITE] &= ~(1 <<  descriptor._to      ); }
		if(descriptor._from >= 112) { position.castling[basetypes.BLACK] &= ~(1 << (descriptor._from%16)); }
		if(descriptor._to   >= 112) { position.castling[basetypes.BLACK] &= ~(1 << (descriptor._to  %16)); }

		// Update the en-passant flag.
		position.enPassant = -1;
		if(movingPiece === basetypes.PAWN && Math.abs(descriptor._from - descriptor._to)===32) {
			var otherPawn = descriptor._movingPiece ^ 0x01;
			var squareBefore = descriptor._to - 1;
			var squareAfter = descriptor._to + 1;
			if(((squareBefore & 0x88) === 0 && position.board[squareBefore] === otherPawn) ||
				((squareAfter & 0x88) === 0 && position.board[squareAfter]===otherPawn)) {
				position.enPassant = descriptor._to % 16;
			}
		}

		// Update the computed flags.
		if(movingPiece === basetypes.KING) {
			position.king[position.turn] = descriptor._to;
		}

		// Toggle the turn flag.
		position.turn = 1 - position.turn;
	};


	/**
	 * Determine if a null-move (i.e. switching the player about to play) can be play in the current position.
	 * A null-move is possible if the position is legal and if the current player about to play is not in check.
	 */
	var isNullMoveLegal = exports.isNullMoveLegal = function(position) {
		return legality.isLegal(position) && !isKingToMoveAttacked(position);
	};


	/**
	 * Play a null-move on the current position if it is legal.
	 */
	exports.playNullMove = function(position) {
		if(isNullMoveLegal(position)) {
			position.turn = 1 - position.turn;
			position.enPassant = -1;
			return true;
		}
		else {
			return false;
		}
	};
	});

	/******************************************************************************
	 *                                                                            *
	 *    This file is part of Kokopu, a JavaScript chess library.                *
	 *    Copyright (C) 2018-2021  Yoann Le Montagner <yo35 -at- melix.net>       *
	 *                                                                            *
	 *    This program is free software: you can redistribute it and/or           *
	 *    modify it under the terms of the GNU Lesser General Public License      *
	 *    as published by the Free Software Foundation, either version 3 of       *
	 *    the License, or (at your option) any later version.                     *
	 *                                                                            *
	 *    This program is distributed in the hope that it will be useful,         *
	 *    but WITHOUT ANY WARRANTY; without even the implied warranty of          *
	 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the            *
	 *    GNU Lesser General Public License for more details.                     *
	 *                                                                            *
	 *    You should have received a copy of the GNU Lesser General               *
	 *    Public License along with this program. If not, see                     *
	 *    <http://www.gnu.org/licenses/>.                                         *
	 *                                                                            *
	 ******************************************************************************/














	/**
	 * Convert the given move descriptor to standard algebraic notation.
	 */
	var getNotation = function(position, descriptor, pieceStyle) {
		var res = '';

		// Castling move
		if(descriptor.isCastling()) {
			res = descriptor._to % 16 === 6 ? 'O-O' : 'O-O-O';
		}

		// Pawn move
		else if(Math.floor(descriptor._movingPiece / 2) === basetypes.PAWN) {
			if(descriptor.isCapture()) {
				res += basetypes.fileToString(descriptor._from % 16) + 'x';
			}
			res += basetypes.squareToString(descriptor._to);
			if(descriptor.isPromotion()) {
				res += '=' + getPieceSymbol(descriptor._finalPiece, pieceStyle);
			}
		}

		// Non-pawn move
		else {
			res += getPieceSymbol(descriptor._movingPiece, pieceStyle);
			res += getDisambiguationSymbol(position, descriptor._from, descriptor._to);
			if(descriptor.isCapture()) {
				res += 'x';
			}
			res += basetypes.squareToString(descriptor._to);
		}

		// Check/checkmate detection and final result.
		res += getCheckCheckmateSymbol(position, descriptor);
		return res;
	};


	/**
	 * Return a string representing the given chess piece according to the given style.
	 */
	function getPieceSymbol(coloredPiece, pieceStyle) {
		switch(pieceStyle) {
			case 'figurine':
				return basetypes.figurineToString(coloredPiece);
			case 'standard':
			default:
				return basetypes.pieceToString(Math.floor(coloredPiece / 2)).toUpperCase();
		}
	}


	/**
	 * Return the check/checkmate symbol to use for a move.
	 */
	function getCheckCheckmateSymbol(position, descriptor) {
		var nextPosition = impl.makeCopy(position);
		movegeneration.play(nextPosition, descriptor);
		return movegeneration.isCheck(nextPosition) ? (movegeneration.hasMove(nextPosition) ? '+' : '#') : '';
	}


	/**
	 * Return the disambiguation symbol to use for a move from `from` to `to`.
	 */
	function getDisambiguationSymbol(position, from, to) {
		var attackers = attacks.getAttacks(position, to, position.turn).filter(function(sq) { return position.board[sq]===position.board[from]; });

		// Disambiguation is not necessary if there less than 2 attackers.
		if(attackers.length < 2) {
			return '';
		}

		var foundNotPined = false;
		var foundOnSameRank = false;
		var foundOnSameFile = false;
		var rankFrom = Math.floor(from / 16);
		var fileFrom = from % 16;
		for(var i=0; i<attackers.length; ++i) {
			var sq = attackers[i];
			if(sq === from || isPinned(position, sq, to)) { continue; }

			foundNotPined = true;
			if(rankFrom === Math.floor(sq / 16)) { foundOnSameRank = true; }
			if(fileFrom === sq % 16) { foundOnSameFile = true; }
		}

		if(foundOnSameFile) {
			return foundOnSameRank ? basetypes.squareToString(from) : basetypes.rankToString(rankFrom);
		}
		else {
			return foundNotPined ? basetypes.fileToString(fileFrom) : '';
		}
	}


	/**
	 * Whether the piece on the given square is pinned or not.
	 */
	function isPinned(position, sq, aimingAtSq) {
		var kingSquare = position.king[position.turn];
		if(kingSquare < 0) {
			return false;
		}

		var vector = Math.abs(kingSquare - sq);
		if(vector === 0) {
			return false;
		}
		var aimingAtVector = Math.abs(aimingAtSq - sq);

		var pinnerQueen  = basetypes.QUEEN  * 2 + 1 - position.turn;
		var pinnerRook   = basetypes.ROOK   * 2 + 1 - position.turn;
		var pinnerBishop = basetypes.BISHOP * 2 + 1 - position.turn;

		// Potential pinning on file or rank.
		if(vector < 8) {
			return aimingAtVector >= 8 && pinningLoockup(position, kingSquare, sq, kingSquare < sq ? 1 : -1, pinnerRook, pinnerQueen);
		}
		else if(vector % 16 === 0) {
			return aimingAtVector % 16 !==0 && pinningLoockup(position, kingSquare, sq, kingSquare < sq ? 16 : -16, pinnerRook, pinnerQueen);
		}

		// Potential pinning on diagonal.
		else if(vector % 15 === 0) {
			return aimingAtVector % 15 !==0 && pinningLoockup(position, kingSquare, sq, kingSquare < sq ? 15 : -15, pinnerBishop, pinnerQueen);
		}
		else if(vector % 17 === 0) {
			return aimingAtVector % 17 !==0 && pinningLoockup(position, kingSquare, sq, kingSquare < sq ? 17 : -17, pinnerBishop, pinnerQueen);
		}

		// No pinning for sure.
		else {
			return false;
		}
	}

	function pinningLoockup(position, kingSquare, targetSquare, direction, pinnerColoredPiece1, pinnerColoredPiece2) {
		for(var sq = kingSquare + direction; sq !== targetSquare; sq += direction) {
			if(position.board[sq] !== basetypes.EMPTY) {
				return false;
			}
		}
		for(var sq = targetSquare + direction; (sq & 0x88) === 0; sq += direction) {
			if(position.board[sq] !== basetypes.EMPTY) {
				return position.board[sq] === pinnerColoredPiece1 || position.board[sq] === pinnerColoredPiece2;
			}
		}
		return false;
	}


	/**
	 * Parse a move notation for the given position.
	 *
	 * @returns {MoveDescriptor}
	 * @throws InvalidNotation
	 */
	var parseNotation = function(position, notation, strict, pieceStyle) {

		// General syntax
		var m = /^(?:(O-O-O)|(O-O)|([A-Z\u2654-\u265f])([a-h])?([1-8])?(x)?([a-h][1-8])|(?:([a-h])(x)?)?([a-h][1-8])(?:(=)?([A-Z\u2654-\u265f]))?)([+#])?$/.exec(notation);
		if(m === null) {
			throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.INVALID_MOVE_NOTATION_SYNTAX);
		}

		// Ensure that the position is legal.
		if(!legality.isLegal(position)) {
			throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.ILLEGAL_POSITION);
		}

		// CASTLING
		// m[1] -> O-O-O
		// m[2] -> O-O

		// NON-PAWN MOVE
		// m[3] -> moving piece
		// m[4] -> file disambiguation
		// m[5] -> rank disambiguation
		// m[6] -> x (capture symbol)
		// m[7] -> to

		// PAWN MOVE
		// m[ 8] -> from column (only for captures)
		// m[ 9] -> x (capture symbol)
		// m[10] -> to
		// m[11] -> = (promotion symbol)
		// m[12] -> promoted piece

		// OTHER
		// m[13] -> +/# (check/checkmate symbol)

		var descriptor = null;

		// Parse castling moves
		if(m[1] || m[2]) {
			var from = position.king[position.turn];
			if(from < 0) {
				throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.ILLEGAL_NO_KING_CASTLING);
			}

			var to = (m[2] ? 6 : 2) + position.turn*112;
			descriptor = movegeneration.isCastlingLegal(position, from, to);
			if(!descriptor) {
				var message = m[2] ? i18n.ILLEGAL_KING_SIDE_CASTLING : i18n.ILLEGAL_QUEEN_SIDE_CASTLING;
				throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, message);
			}
		}

		// Non-pawn move
		else if(m[3]) {
			var movingPiece = parsePieceSymbol(position, notation, m[3], strict, pieceStyle);
			var to = basetypes.squareFromString(m[7]);
			var toContent = position.board[to];

			// Cannot take your own pieces!
			if(toContent >= 0 && toContent % 2 === position.turn) {
				throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.TRYING_TO_CAPTURE_YOUR_OWN_PIECES);
			}

			// Find the "from"-square candidates
			var attackers = attacks.getAttacks(position, to, position.turn).filter(function(sq) { return position.board[sq] === movingPiece*2 + position.turn; });

			// Apply disambiguation
			if(m[4]) {
				var fileFrom = basetypes.fileFromString(m[4]);
				attackers = attackers.filter(function(sq) { return sq%16 === fileFrom; });
			}
			if(m[5]) {
				var rankFrom = basetypes.rankFromString(m[5]);
				attackers = attackers.filter(function(sq) { return Math.floor(sq/16) === rankFrom; });
			}
			if(attackers.length===0) {
				var message = (m[4] || m[5]) ? i18n.NO_PIECE_CAN_MOVE_TO_DISAMBIGUATION : i18n.NO_PIECE_CAN_MOVE_TO;
				throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, message, m[3], m[7]);
			}

			// Compute the move descriptor for each remaining "from"-square candidate
			for(var i=0; i<attackers.length; ++i) {
				var currentDescriptor = movegeneration.isKingSafeAfterMove(position, attackers[i], to, -1);
				if(currentDescriptor) {
					if(descriptor !== null) {
						throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.REQUIRE_DISAMBIGUATION, m[3], m[7]);
					}
					descriptor = currentDescriptor;
				}
			}
			if(descriptor === null) {
				var message = position.turn===basetypes.WHITE ? i18n.NOT_SAFE_FOR_WHITE_KING : i18n.NOT_SAFE_FOR_BLACK_KING;
				throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, message);
			}

			// STRICT-MODE -> check the disambiguation symbol.
			if(strict) {
				var expectedDS = getDisambiguationSymbol(position, descriptor._from, to);
				var observedDS = (m[4] ? m[4] : '') + (m[5] ? m[5] : '');
				if(expectedDS !== observedDS) {
					throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.WRONG_DISAMBIGUATION_SYMBOL, expectedDS, observedDS);
				}
			}
		}

		// Pawn move
		else if(m[10]) {
			var to = basetypes.squareFromString(m[10]);
			if(m[8]) {
				descriptor = getPawnCaptureDescriptor(position, notation, basetypes.fileFromString(m[8]), to);
			}
			else {
				descriptor = getPawnAdvanceDescriptor(position, notation, to);
			}

			// Ensure that the pawn move do not let a king in check.
			if(!descriptor) {
				var message = position.turn===basetypes.WHITE ? i18n.NOT_SAFE_FOR_WHITE_KING : i18n.NOT_SAFE_FOR_BLACK_KING;
				throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, message);
			}

			// Detect promotions
			if(to<8 || to>=112) {
				if(!m[12]) {
					throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.MISSING_PROMOTION);
				}
				var promotion = parsePieceSymbol(position, notation, m[12], strict, pieceStyle);
				if(promotion === basetypes.PAWN || promotion === basetypes.KING) {
					throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.INVALID_PROMOTED_PIECE, m[12]);
				}
				descriptor = movedescriptor.makePromotion(descriptor._from, descriptor._to, descriptor._movingPiece % 2, promotion, descriptor._optionalPiece);

				// STRICT MODE -> do not forget the `=` character!
				if(strict && !m[11]) {
					throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.MISSING_PROMOTION_SYMBOL);
				}
			}

			// Detect illegal promotion attempts!
			else if(m[12]) {
				throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.ILLEGAL_PROMOTION);
			}
		}

		// STRICT MODE
		if(strict) {
			if(descriptor.isCapture() !== (m[6] || m[9])) {
				var message = descriptor.isCapture() ? i18n.MISSING_CAPTURE_SYMBOL : i18n.INVALID_CAPTURE_SYMBOL;
				throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, message);
			}
			var expectedCCS = getCheckCheckmateSymbol(position, descriptor);
			var observedCCS = m[13] ? m[13] : '';
			if(expectedCCS !== observedCCS) {
				throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.WRONG_CHECK_CHECKMATE_SYMBOL, expectedCCS, observedCCS);
			}
		}

		// Final result
		return descriptor;
	};


	/**
	 * Delegate function for piece symbol parsing.
	 */
	function parsePieceSymbol(position, notation, coloredPiece, strict, pieceStyle) {
		switch(pieceStyle) {

			case 'figurine':
				var coloredPiece = basetypes.figurineFromString(coloredPiece);
				if(piece < 0) {
					throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.INVALID_PIECE_SYMBOL, coloredPiece);
				}
				if(strict && coloredPiece % 2 !== position.turn) {
					throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.INVALID_PIECE_SYMBOL_COLOR, coloredPiece);
				}
				return Math.floor(coloredPiece / 2);

			case 'standard':
			default:
				var piece = basetypes.pieceFromString(coloredPiece.toLowerCase());
				if(piece < 0) {
					throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.INVALID_PIECE_SYMBOL, coloredPiece);
				}
				return piece;
		}
	}


	/**
	 * Delegate function for capture pawn move parsing.
	 *
	 * @returns {boolean|MoveDescriptor}
	 */
	function getPawnCaptureDescriptor(position, notation, columnFrom, to) {

		// Ensure that `to` is not on the 1st row.
		var from = to - 16 + position.turn*32;
		if((from & 0x88) !== 0) {
			throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.INVALID_CAPTURING_PAWN_MOVE);
		}

		// Compute the "from"-square.
		var columnTo = to % 16;
		if(columnTo - columnFrom === 1) { from -= 1; }
		else if(columnTo - columnFrom === -1) { from += 1; }
		else {
			throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.INVALID_CAPTURING_PAWN_MOVE);
		}

		// Check the content of the "from"-square
		if(position.board[from] !== basetypes.PAWN*2+position.turn) {
			throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.INVALID_CAPTURING_PAWN_MOVE);
		}

		// Check the content of the "to"-square
		var toContent = position.board[to];
		if(toContent < 0) {
			if(to === (5-position.turn*3)*16 + position.enPassant) { // detecting "en-passant" captures
				return movegeneration.isKingSafeAfterMove(position, from, to, (4-position.turn)*16 + position.enPassant);
			}
		}
		else if(toContent % 2 !== position.turn) { // detecting regular captures
			return movegeneration.isKingSafeAfterMove(position, from, to, -1);
		}

		throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.INVALID_CAPTURING_PAWN_MOVE);
	}


	/**
	 * Delegate function for non-capturing pawn move parsing.
	 *
	 * @returns {boolean|MoveDescriptor}
	 */
	function getPawnAdvanceDescriptor(position, notation, to) {

		// Ensure that `to` is not on the 1st row.
		var offset = 16 - position.turn*32;
		var from = to - offset;
		if((from & 0x88) !== 0) {
			throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.INVALID_NON_CAPTURING_PAWN_MOVE);
		}

		// Check the content of the "to"-square
		if(position.board[to] >= 0) {
			throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.INVALID_NON_CAPTURING_PAWN_MOVE);
		}

		// Check the content of the "from"-square
		var expectedFromContent = basetypes.PAWN*2+position.turn;
		if(position.board[from] === expectedFromContent) {
			return movegeneration.isKingSafeAfterMove(position, from, to, -1);
		}

		// Look for two-square pawn moves
		else if(position.board[from] < 0) {
			from -= offset;
			var firstSquareOfRow = (1 + position.turn*5) * 16;
			if(from >= firstSquareOfRow && from < firstSquareOfRow+8 && position.board[from] === expectedFromContent) {
				return movegeneration.isKingSafeAfterMove(position, from, to, -1);
			}
		}

		throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.INVALID_NON_CAPTURING_PAWN_MOVE);
	}

	var notation = {
		getNotation: getNotation,
		parseNotation: parseNotation
	};

	/******************************************************************************
	 *                                                                            *
	 *    This file is part of Kokopu, a JavaScript chess library.                *
	 *    Copyright (C) 2018-2021  Yoann Le Montagner <yo35 -at- melix.net>       *
	 *                                                                            *
	 *    This program is free software: you can redistribute it and/or           *
	 *    modify it under the terms of the GNU Lesser General Public License      *
	 *    as published by the Free Software Foundation, either version 3 of       *
	 *    the License, or (at your option) any later version.                     *
	 *                                                                            *
	 *    This program is distributed in the hope that it will be useful,         *
	 *    but WITHOUT ANY WARRANTY; without even the implied warranty of          *
	 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the            *
	 *    GNU Lesser General Public License for more details.                     *
	 *                                                                            *
	 *    You should have received a copy of the GNU Lesser General               *
	 *    Public License along with this program. If not, see                     *
	 *    <http://www.gnu.org/licenses/>.                                         *
	 *                                                                            *
	 ******************************************************************************/










	/**
	 * Convert the given move descriptor to UCI notation.
	 */
	var getNotation$1 = function(position, descriptor, forceKxR) {
		var res = descriptor.from();

		if(descriptor.isCastling()) {
			res += forceKxR || position.variant === basetypes.CHESS960 ? descriptor.rookFrom() : descriptor.to();
		}
		else {
			res += descriptor.to();
		}

		if(descriptor.isPromotion()) {
			res += descriptor.promotion();
		}

		return res;
	};


	/**
	 * Parse a UCI notation for the given position.
	 *
	 * @returns {MoveDescriptor}
	 * @throws InvalidNotation
	 */
	var parseNotation$1 = function(position, notation, strict) {

		// General syntax
		var m = /^([a-h][1-8])([a-h][1-8])([qrbn]?)$/.exec(notation);
		if(m === null) {
			throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.INVALID_UCI_NOTATION_SYNTAX);
		}

		// Ensure that the position is legal (this is also done in `moveGeneration.isMoveLegal(..)`, but performing this check beforehand
		// allows to fill the exception with an error message that is more explicit).
		if(!legality.isLegal(position)) {
			throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.ILLEGAL_POSITION);
		}

		// m[1] - from
		// m[2] - to
		// m[3] - promotion piece

		var from = basetypes.squareFromString(m[1]);
		var to = basetypes.squareFromString(m[2]);
		var kxrSubstitutionApplied = false;
		var expectedRookFrom = null; // non-null only if KxR substitution has been applied.

		// If KxR is detected (and allowed), try to replace
		if((position.variant === basetypes.CHESS960 || !strict) && position.board[from] !== basetypes.EMPTY && position.board[to] !== basetypes.EMPTY && position.board[from]%2 === position.board[to]%2) {
			var fromPiece = Math.floor(position.board[from] / 2);
			var toPiece = Math.floor(position.board[to] / 2);
			if(fromPiece === basetypes.KING && toPiece === basetypes.ROOK) {
				kxrSubstitutionApplied = true;
				expectedRookFrom = to;
				to = position.turn * 112 + (from < to ? 6 : 2);
			}
		}

		// Perform move analysis.
		var result = movegeneration.isMoveLegal(position, from, to);

		// No legal move.
		if(!result) {
			throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.ILLEGAL_UCI_MOVE);
		}

		// Manage promotion.
		if(result.type === 'promotion') {
			if(m[3] === '') { // A promotion piece must be provided in case of promotion move.
				throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.ILLEGAL_UCI_MOVE);
			}
			result = result.build(basetypes.pieceFromString(m[3]));
		}
		else if(m[3] !== '') { // Throw if a promotion piece is provided while no promotion happens.
			throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.ILLEGAL_UCI_MOVE);
		}

		// Manage the castling-move ambiguity that could arise in chess960.
		if(result.type === 'castle960') {
			result = result.build(kxrSubstitutionApplied);
		}

		// Manage KxR substitution.
		if(result.isCastling()) {
			if(position.variant === basetypes.CHESS960 && !kxrSubstitutionApplied) { // KxR substitution is mandatory for castling moves in Chess960.
				throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.ILLEGAL_UCI_MOVE);
			}
			if(kxrSubstitutionApplied && expectedRookFrom !== result._optionalSquare1) { // If KxR substitution has been applied, ensure that the rook-from square is what it is supposed to be.
				throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.ILLEGAL_UCI_MOVE);
			}
		}
		else if(kxrSubstitutionApplied) { // If KxR substitution has been applied, a castling move must be found.
			throw new exception.InvalidNotation(fen.getFEN(position, 0, 1), notation, i18n.ILLEGAL_UCI_MOVE);
		}

		return result;
	};

	var uci = {
		getNotation: getNotation$1,
		parseNotation: parseNotation$1
	};

	/******************************************************************************
	 *                                                                            *
	 *    This file is part of Kokopu, a JavaScript chess library.                *
	 *    Copyright (C) 2018-2021  Yoann Le Montagner <yo35 -at- melix.net>       *
	 *                                                                            *
	 *    This program is free software: you can redistribute it and/or           *
	 *    modify it under the terms of the GNU Lesser General Public License      *
	 *    as published by the Free Software Foundation, either version 3 of       *
	 *    the License, or (at your option) any later version.                     *
	 *                                                                            *
	 *    This program is distributed in the hope that it will be useful,         *
	 *    but WITHOUT ANY WARRANTY; without even the implied warranty of          *
	 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the            *
	 *    GNU Lesser General Public License for more details.                     *
	 *                                                                            *
	 *    You should have received a copy of the GNU Lesser General               *
	 *    Public License along with this program. If not, see                     *
	 *    <http://www.gnu.org/licenses/>.                                         *
	 *                                                                            *
	 ******************************************************************************/

	var position = createCommonjsModule(function (module, exports) {
















	// -----------------------------------------------------------------------------
	// Constructor & reset/clear
	// -----------------------------------------------------------------------------

	/**
	 * @class
	 * @classdesc Represent a chess position, i.e. the state of a 64-square chessboard with a few additional
	 *            information (who is about to play, castling rights, en-passant rights).
	 *
	 * @description
	 * This constructor can be invoked with different types of arguments:
	 * ```
	 * new kokopu.Position('regular');                  //  1 -> Usual starting position.
	 * new kokopu.Position('regular', 'start');         //  2 -> Same as 1.
	 * new kokopu.Position('regular', 'empty');         //  3 -> Empty board.
	 * new kokopu.Position('no-king', 'empty');         //  4 -> Empty board, configured to be considered as legal without any king.
	 * new kokopu.Position('white-king-only', 'empty'); //  5 -> Empty board, configured to be considered as legal with no black king.
	 * new kokopu.Position('black-king-only', 'empty'); //  6 -> Empty board, configured to be considered as legal with no white king.
	 * new kokopu.Position('chess960', 'empty');        //  7 -> Empty board, configured for Chess960.
	 * new kokopu.Position('chess960', scharnaglCode);  //  8 -> One of the Chess960 starting position (`scharnaglCode` is a number between 0 and 959 inclusive).
	 * new kokopu.Position(variant, fenString);         //  9 -> Parse the given FEN string, assuming the given game variant.
	 * new kokopu.Position(anotherPosition);            // 10 -> Make a copy of `anotherPosition`.
	 * ```
	 * Please note that the argument `'regular'` can be omitted in forms 1, 2, 3. In particular, the constructor can be invoked
	 * with no argument, as in `new kokopu.Position()`: in this case, a new `Position` initialized to the usual starting position
	 * is instantiated (as in forms 1 and 2).
	 *
	 * In form 9, `variant` must be one of the game variant proposed in {@link GameVariant}. The `variant` argument can be omitted,
	 * as in `new kokopu.Position(fenString)`: in this case, the usual chess rules are assumed (as if `variant` where set to `'regular'`).
	 * If `variant` is set to `'chess960'`, then the X-FEN syntax can be used for `fenString'`.
	 *
	 * In form 10, `anotherPosition` must be another {@link Position} object.
	 *
	 * @throws {module:exception.InvalidFEN} If the input parameter is not a valid FEN string (can be thrown only in cases 6 and 7).
	 *
	 * @see FEN notation: {@link https://en.wikipedia.org/wiki/Forsyth–Edwards_Notation}
	 * @see Chess960 (aka. Fischer Random Chess): {@link https://en.wikipedia.org/wiki/Chess960}
	 * @see Chess960 starting positions: {@link https://chess960.net/start-positions/}
	 * @see X-FEN notation: {@link https://en.wikipedia.org/wiki/X-FEN}
	 */
	var Position = exports.Position = function() {

		// Copy constructor
		if(arguments[0] instanceof Position) {
			this._impl = impl.makeCopy(arguments[0]._impl);
		}

		// Special constructor codes
		else if(arguments.length === 0 || arguments[0] === 'start' || (arguments[0] === 'regular' && (arguments.length === 1 || arguments[1] === 'start'))) {
			this._impl = impl.makeInitial();
		}
		else if(arguments[0] === 'empty' || (arguments[0] === 'regular' && arguments[1] === 'empty')) {
			this._impl = impl.makeEmpty(basetypes.REGULAR_CHESS);
		}
		else if(arguments[0] === 'chess960' && arguments[1] === 'empty') {
			this._impl = impl.makeEmpty(basetypes.CHESS960);
		}
		else if(arguments[0] === 'chess960' && typeof arguments[1] === 'number' && arguments[1] >= 0 && arguments[1] <= 959) {
			this._impl = impl.make960FromScharnagl(arguments[1]);
		}
		else if(arguments[0] === 'no-king' && arguments[1] === 'empty') {
			this._impl = impl.makeEmpty(basetypes.NO_KING);
		}
		else if(arguments[0] === 'white-king-only' && arguments[1] === 'empty') {
			this._impl = impl.makeEmpty(basetypes.WHITE_KING_ONLY);
		}
		else if(arguments[0] === 'black-king-only' && arguments[1] === 'empty') {
			this._impl = impl.makeEmpty(basetypes.BLACK_KING_ONLY);
		}

		// FEN parsing
		else if(typeof arguments[0] === 'string') {
			var variant = basetypes.variantFromString(arguments[0]);
			if(variant >= 0) {
				if(typeof arguments[1] === 'string') {
					this._impl = fen.parseFEN(variant, arguments[1], false).position;
				}
				else {
					throw new exception.IllegalArgument('Position()');
				}
			}
			else {
				this._impl = fen.parseFEN(basetypes.REGULAR_CHESS, arguments[0], false).position;
			}
		}

		// Wrong argument scheme
		else {
			throw new exception.IllegalArgument('Position()');
		}
	};


	/**
	 * Set the position to the empty state.
	 *
	 * @param {GameVariant} [variant=`'regular'`] Chess game variant to use.
	 */
	Position.prototype.clear = function(variant) {
		if(arguments.length === 0) {
			this._impl = impl.makeEmpty(basetypes.REGULAR_CHESS);
		}
		else {
			var v = basetypes.variantFromString(variant);
			if(v < 0) {
				throw new exception.IllegalArgument('Position#clear()');
			}
			this._impl = impl.makeEmpty(v);
		}
	};


	/**
	 * Set the position to the starting state.
	 */
	Position.prototype.reset = function() {
		this._impl = impl.makeInitial();
	};


	/**
	 * Set the position to one of the Chess960 starting position.
	 *
	 * @param {number} scharnaglCode Must be between 0 and 959 inclusive (see {@link https://chess960.net/start-positions/}
	 *        or {@link https://www.chessprogramming.org/Reinhard_Scharnagl} for more details).
	 */
	Position.prototype.reset960 = function(scharnaglCode) {
		this._impl = impl.make960FromScharnagl(scharnaglCode);
	};



	// -----------------------------------------------------------------------------
	// FEN & ASCII conversion
	// -----------------------------------------------------------------------------


	/**
	 * Return a human-readable string representing the position. This string is multi-line,
	 * and is intended to be displayed in a fixed-width font (similarly to an ASCII-art picture).
	 *
	 * @returns {string} Human-readable representation of the position.
	 */
	Position.prototype.ascii = function() {
		return fen.ascii(this._impl);
	};


	/**
	 * Get the FEN representation of the current {@link Position}).
	 *
	 * @param {{fiftyMoveClock:number, fullMoveNumber:number}} [options] If not provided the `fiftyMoveClock`
	 *        and the `fullMoveNumber` fields of the returned FEN string are set respectively to 0 and 1.
	 *
	 *//**
	 *
	 * Parse the given FEN string and set the position accordingly.
	 *
	 * @param {string} fen
	 * @param {boolean} [strict=false] If `true`, only perfectly formatted FEN strings are accepted.
	 * @returns {{fiftyMoveClock:number, fullMoveNumber:number}}
	 * @throws {module:exception.InvalidFEN} If the given string cannot be parsed as a valid FEN string.
	 */
	Position.prototype.fen = function() {
		if(arguments.length === 0) {
			return fen.getFEN(this._impl, 0, 1);
		}
		else if(arguments.length === 1 && typeof arguments[0] === 'object') {
			var fiftyMoveClock = (typeof arguments[0].fiftyMoveClock === 'number') ? arguments[0].fiftyMoveClock : 0;
			var fullMoveNumber = (typeof arguments[0].fullMoveNumber === 'number') ? arguments[0].fullMoveNumber : 1;
			return fen.getFEN(this._impl, fiftyMoveClock, fullMoveNumber);
		}
		else if(arguments.length === 1 && typeof arguments[0] === 'string') {
			var result = fen.parseFEN(this._impl.variant, arguments[0], false);
			this._impl = result.position;
			return { fiftyMoveClock: result.fiftyMoveClock, fullMoveNumber: result.fullMoveNumber };
		}
		else if(arguments.length >= 2 && typeof arguments[0] === 'string' && typeof arguments[1] === 'boolean') {
			var result = fen.parseFEN(this._impl.variant, arguments[0], arguments[1]);
			this._impl = result.position;
			return { fiftyMoveClock: result.fiftyMoveClock, fullMoveNumber: result.fullMoveNumber };
		}
		else {
			throw new exception.IllegalArgument('Position#fen()');
		}
	};



	// -----------------------------------------------------------------------------
	// Accessors
	// -----------------------------------------------------------------------------


	/**
	 * Get the {@link GameVariant} in use.
	 *
	 * @returns {GameVariant}
	 */
	Position.prototype.variant = function() {
		return basetypes.variantToString(this._impl.variant);
	};


	/**
	 * Get the content of a square.
	 *
	 * @param {Square} square
	 * @returns {ColoredPiece|Empty}
	 *
	 *//**
	 *
	 * Set the content of a square.
	 *
	 * @param {Square} square
	 * @param {ColoredPiece|Empty} value
	 */
	Position.prototype.square = function(square, value) {
		square = basetypes.squareFromString(square);
		if(square < 0) {
			throw new exception.IllegalArgument('Position#square()');
		}

		if(arguments.length === 1) {
			var cp = this._impl.board[square];
			return cp < 0 ? '-' : basetypes.coloredPieceToString(cp);
		}
		else if(value === '-') {
			this._impl.board[square] = basetypes.EMPTY;
			this._impl.legal = null;
		}
		else {
			var cp = basetypes.coloredPieceFromString(value);
			if(cp < 0) {
				throw new exception.IllegalArgument('Position#square()');
			}
			this._impl.board[square] = cp;
			this._impl.legal = null;
		}
	};


	/**
	 * Get the turn flag (i.e. who is about to play).
	 *
	 * @returns {Color}
	 *
	 *//**
	 *
	 * Set the turn flag (i.e. who is about to play).
	 *
	 * @param {Color} value
	 */
	Position.prototype.turn = function(value) {
		if(arguments.length === 0) {
			return basetypes.colorToString(this._impl.turn);
		}
		else {
			var turn = basetypes.colorFromString(value);
			if(turn < 0) {
				throw new exception.IllegalArgument('Position#turn()');
			}
			this._impl.turn = turn;
			this._impl.legal = null;
		}
	};


	/**
	 * Get a castle flag (i.e. whether or not the corresponding castle is allowed or not).
	 *
	 * @param {Castle|Castle960} castle Must be {@link Castle960} if the {@link Position} is configured for Chess960, or {@link Castle} otherwise.
	 * @returns {boolean}
	 *
	 *//**
	 *
	 * Set a castle flag (i.e. whether or not the corresponding castle is allowed or not).
	 *
	 * @param {Castle|Castle960} castle Must be {@link Castle960} if the {@link Position} is configured for Chess960, or {@link Castle} otherwise.
	 * @param {boolean} value
	 */
	Position.prototype.castling = function(castle, value) {
		if(!(this._impl.variant === basetypes.CHESS960 ? /^[wb][a-h]$/ : /^[wb][qk]$/).test(castle)) {
			throw new exception.IllegalArgument('Position#castling()');
		}
		var color = basetypes.colorFromString(castle[0]);
		var file = this._impl.variant === basetypes.CHESS960 ? basetypes.fileFromString(castle[1]) : castle[1]==='k' ? 7 : 0;

		if(arguments.length === 1) {
			return (this._impl.castling[color] & 1 << file) !== 0;
		}
		else if(value) {
			this._impl.castling[color] |= 1 << file;
			this._impl.legal = null;
		}
		else {
			this._impl.castling[color] &= ~(1 << file);
			this._impl.legal = null;
		}
	};


	/**
	 * Get the *en-passant* flag (i.e. the file on which *en-passant* is allowed, if any).
	 *
	 * @returns {EnPassantFlag}
	 *
	 *//**
	 *
	 * Set the *en-passant* flag (i.e. the file on which *en-passant* is allowed, if any).
	 *
	 * @param {EnPassantFlag} value
	 */
	Position.prototype.enPassant = function(value) {
		if(arguments.length === 0) {
			return this._impl.enPassant < 0 ? '-' : basetypes.fileToString(this._impl.enPassant);
		}
		else if(value === '-') {
			this._impl.enPassant = -1;
			this._impl.legal = null;
		}
		else {
			var enPassant = basetypes.fileFromString(value);
			if(enPassant < 0) {
				throw new exception.IllegalArgument('Position#enPassant()');
			}
			this._impl.enPassant = enPassant;
			this._impl.legal = null;
		}
	};



	// -----------------------------------------------------------------------------
	// Attacks
	// -----------------------------------------------------------------------------


	/**
	 * Check if any piece of the given color attacks a given square.
	 *
	 * @param {Square} square
	 * @param {Color} byWho
	 * @returns {boolean}
	 */
	Position.prototype.isAttacked = function(square, byWho) {
		square = basetypes.squareFromString(square);
		byWho = basetypes.colorFromString(byWho);
		if(square < 0 || byWho < 0) {
			throw new exception.IllegalArgument('Position#isAttacked()');
		}
		return attacks.isAttacked(this._impl, square, byWho);
	};


	/**
	 * Return the squares from which a piece of the given color attacks a given square.
	 *
	 * @param {Square} square
	 * @param {Color} byWho
	 * @returns {Square[]}
	 */
	Position.prototype.getAttacks = function(square, byWho) {
		square = basetypes.squareFromString(square);
		byWho = basetypes.colorFromString(byWho);
		if(square < 0 || byWho < 0) {
			throw new exception.IllegalArgument('Position#getAttacks()');
		}
		return attacks.getAttacks(this._impl, square, byWho).map(basetypes.squareToString);
	};



	// -----------------------------------------------------------------------------
	// Legality
	// -----------------------------------------------------------------------------


	/**
	 * Check whether the current position is legal or not.
	 *
	 * A position is considered to be legal if all the following conditions are met:
	 *
	 *  1. There is exactly one white king and one black king on the board.
	 *  2. The player that is not about to play is not in check.
	 *  3. There are no pawn on ranks 1 and 8.
	 *  4. For each colored castle flag set, there is a rook and a king on the
	 *     corresponding initial squares.
	 *  5. The pawn situation is consistent with the *en-passant* flag if it is set.
	 *     For instance, if it is set to the "e" file and black is about to play,
	 *     the squares e2 and e3 must be empty, and there must be a white pawn on e4.
	 *
	 * @returns {boolean}
	 */
	Position.prototype.isLegal = function() {
		return legality.isLegal(this._impl);
	};


	/**
	 * Return the square on which is located the king of the given color.
	 *
	 * @param {Color} color
	 * @returns {Square|boolean} Square where is located the searched king. `false` is returned
	 *          if there is no king of the given color, or if the are 2 such kings or more.
	 */
	Position.prototype.kingSquare = function(color) {
		color = basetypes.colorFromString(color);
		if(color < 0) {
			throw new exception.IllegalArgument('Position#kingSquare()');
		}
		legality.refreshLegalFlagAndKingSquares(this._impl);
		var square = this._impl.king[color];
		return square < 0 ? false : basetypes.squareToString(square);
	};



	// -----------------------------------------------------------------------------
	// Move generation
	// -----------------------------------------------------------------------------


	/**
	 * Return `true` if the player that is about to play is in check. If the position is not legal (see {@link Position#isLegal}),
	 * the returned value is always `false`.
	 *
	 * @returns {boolean}
	 */
	Position.prototype.isCheck = function() {
		return movegeneration.isCheck(this._impl);
	};


	/**
	 * Return `true` if the player that is about to play is checkmated. If the position is not legal (see {@link Position#isLegal}),
	 * the returned value is always `false`.
	 *
	 * @returns {boolean}
	 */
	Position.prototype.isCheckmate = function() {
		return movegeneration.isCheckmate(this._impl);
	};


	/**
	 * Return `true` if the player that is about to play is stalemated. If the position is not legal (see {@link Position#isLegal}),
	 * the returned value is always `false`.
	 *
	 * @returns {boolean}
	 */
	Position.prototype.isStalemate = function() {
		return movegeneration.isStalemate(this._impl);
	};


	/**
	 * Whether at least one legal move exists in the current position or not. If the position is not legal (see {@link Position#isLegal}),
	 * the returned value is always `false`.
	 *
	 * @returns {boolean}
	 */
	Position.prototype.hasMove = function() {
		return movegeneration.hasMove(this._impl);
	};


	/**
	 * Return the list of all legal moves in the current position. An empty list is returned if the position itself is not legal
	 * (see {@link Position#isLegal}).
	 *
	 * @returns {MoveDescriptor[]}
	 */
	Position.prototype.moves = function() {
		return movegeneration.moves(this._impl);
	};


	/**
	 * Check whether a move is legal or not, and return the corresponding {@link MoveDescriptor} if it is legal.
	 *
	 * Depending on the situation, the method returns:
	 *   - `false` if it is not possible to move from `from` to `to` (either because the move itself is not legal, or because the underlying
	 *     position is not legal).
	 *   - a function that returns a {@link MoveDescriptor} otherwise. When there is only one possible move between the given squares
	 *     `from` and `to` (i.e. in most cases), this function must be invoked with no argument. When there is a "move ambiguity"
	 *     (i.e. squares `from` and `to` are not sufficient to fully describe a move), an argument must be passed to the this function
	 *     in order to discriminate between the possible moves. A field `status` is added to the function in order to indicate whether
	 *     there is a move ambiguity or not.
	 *
	 * A code interpreting the result returned by {@link Position#isMoveLegal} would typically look like this:
	 *
	 * ```
	 * var result = position.isMoveLegal(from, to);
	 * if(!result) {
	 *   // The move "from -> to" is not legal.
	 * }
	 * else {
	 *   switch(result.status) {
	 *
	 *     case 'regular':
	 *       // The move "from -> to" is legal, and the corresponding move descriptor is `result()`.
	 *       break;
	 *
	 *     case 'promotion':
	 *       // The move "from -> to" is legal, but it corresponds to a promotion,
	 *       // so the promoted piece must be specified. The corresponding move descriptors
	 *       // are `result('q')`, `result('r')`, `result('b')` and `result('n')`.
	 *       break;
	 *
	 *     case 'castle960':
	 *       // The move "from -> to" is legal, but it corresponds either to a castling move
	 *       // or to a regular king move (this case can only happen at Chess960).
	 *       // The corresponding move descriptors are `result('castle')` and `result('king')`.
	 *       break;
	 *
	 *     default:
	 *       // This case is not supposed to happen.
	 *       break;
	 *   }
	 * }
	 * ```
	 *
	 * @param {Square} from
	 * @param {Square} to
	 * @returns {boolean|function}
	 */
	Position.prototype.isMoveLegal = function(from, to) {
		from = basetypes.squareFromString(from);
		to = basetypes.squareFromString(to);
		if(from < 0 || to < 0) {
			throw new exception.IllegalArgument('Position#isMoveLegal()');
		}
		var result = movegeneration.isMoveLegal(this._impl, from, to);

		// No legal move.
		if(!result) {
			return false;
		}

		// Only one legal move (no ambiguity).
		else if(movedescriptor.isMoveDescriptor(result)) {
			return makeFactory('regular', function() { return result; });
		}

		// Several legal moves -> ambiguity.
		else {
			switch(result.type) {

				case 'promotion':
					return makeFactory('promotion', function(promotion) {
						promotion = basetypes.pieceFromString(promotion);
						if(promotion >= 0) {
							var builtMoveDescriptor = result.build(promotion);
							if(builtMoveDescriptor) {
								return builtMoveDescriptor;
							}
						}
						throw new exception.IllegalArgument('Position#isMoveLegal()');
					});

				case 'castle960':
					return makeFactory('castle960', function(type) {
						switch(type) {
							case 'king': return result.build(false);
							case 'castle': return result.build(true);
							default: throw new exception.IllegalArgument('Position#isMoveLegal()');
						}
					});

				default: // This case is not supposed to happen.
					throw new exception.IllegalArgument('Position#isMoveLegal()');
			}
		}
	};


	function makeFactory(status, factory) {
		factory.status = status;
		return factory;
	}


	/**
	 * Play the given move if it is legal.
	 *
	 * WARNING: when a {@link MoveDescriptor} is passed to this method, this {@link MoveDescriptor} must have been issued by one of the
	 * {@link Position#moves} / {@link Position#isMoveLegal} / {@link Position#notation} methods of the current {@link Position}.
	 * Trying to invoke {@link Position#play} with a {@link MoveDescriptor} generated by another {@link Position} object would result
	 * in an undefined behavior.
	 *
	 * @param {string|MoveDescriptor} move
	 * @returns {boolean} `true` if the move has been played, `false` if the move is not legal or if the string passed to the method
	 *          cannot be interpreted as a valid SAN move notation (see {@link Position#notation}).
	 */
	Position.prototype.play = function(move) {
		if(typeof move === 'string') {
			try {
				movegeneration.play(this._impl, notation.parseNotation(this._impl, move, false));
				return true;
			}
			catch(err) {
				if(err instanceof exception.InvalidNotation) {
					return false;
				}
				else {
					throw err;
				}
			}
		}
		else if(movedescriptor.isMoveDescriptor(move)) {
			movegeneration.play(this._impl, move);
			return true;
		}
		else {
			throw new exception.IllegalArgument('Position#play()');
		}
	};


	/**
	 * Determine whether a null-move (i.e. switching the player about to play) can be play in the current position.
	 *
	 * A null-move is possible if the position is legal and if the current player about to play is not in check.
	 *
	 * @returns {boolean}
	 */
	Position.prototype.isNullMoveLegal = function() {
		return movegeneration.isNullMoveLegal(this._impl);
	};


	/**
	 * Play a null-move on the current position if it is legal.
	 *
	 * @returns {boolean} `true` if the move has actually been played, `false` otherwise.
	 */
	Position.prototype.playNullMove = function() {
		return movegeneration.playNullMove(this._impl);
	};



	// -----------------------------------------------------------------------------
	// Algebraic notation
	// -----------------------------------------------------------------------------


	/**
	 * Return the standard algebraic notation corresponding to the given move descriptor.
	 *
	 * @param {MoveDescriptor} moveDescriptor
	 * @returns {string}
	 *
	 *//**
	 *
	 * Parse the given string as standard algebraic notation and return the corresponding move descriptor.
	 *
	 * @param {string} move
	 * @param {boolean} [strict=false] If `true`, only perfectly formatted SAN moves are accepted. If `false`, "small errors" in the input
	 *        such as a missing capture character, an unnecessary disambiguation symbol... do not interrupt the parsing.
	 * @returns {MoveDescriptor}
	 * @throws {module:exception.InvalidNotation} If the move parsing fails or if the parsed move would correspond to an illegal move.
	 */
	Position.prototype.notation = function() {
		if(arguments.length === 1 && movedescriptor.isMoveDescriptor(arguments[0])) {
			return notation.getNotation(this._impl, arguments[0], 'standard');
		}
		else if(arguments.length === 1 && typeof arguments[0] === 'string') {
			return notation.parseNotation(this._impl, arguments[0], false, 'standard');
		}
		else if(arguments.length >= 2 && typeof arguments[0] === 'string' && typeof arguments[1] === 'boolean') {
			return notation.parseNotation(this._impl, arguments[0], arguments[1], 'standard');
		}
		else {
			throw new exception.IllegalArgument('Position#notation()');
		}
	};


	/**
	 * Return the figurine algebraic notation corresponding to the given move descriptor (figurine algebraic notation is the same as standard algebraic notation,
	 * except that chess pieces are represented with their respective unicode character, instead of the first letter of their English name).
	 *
	 * @param {MoveDescriptor} moveDescriptor
	 * @returns {string}
	 *
	 *//**
	 *
	 * Parse the given string as figurine algebraic notation and return the corresponding move descriptor (figurine algebraic notation is the same as standard algebraic notation,
	 * except that chess pieces are represented with their respective unicode character, instead of the first letter of their English name).
	 *
	 * @param {string} move
	 * @param {boolean} [strict=false] If `true`, only perfectly formatted FAN moves are accepted. If `false`, "small errors" in the input
	 *        such as a missing capture character, an unnecessary disambiguation symbol... do not interrupt the parsing.
	 * @returns {MoveDescriptor}
	 * @throws {module:exception.InvalidNotation} If the move parsing fails or if the parsed move would correspond to an illegal move.
	 */
	Position.prototype.figurineNotation = function() {
		if(arguments.length === 1 && movedescriptor.isMoveDescriptor(arguments[0])) {
			return notation.getNotation(this._impl, arguments[0], 'figurine');
		}
		else if(arguments.length === 1 && typeof arguments[0] === 'string') {
			return notation.parseNotation(this._impl, arguments[0], false, 'figurine');
		}
		else if(arguments.length >= 2 && typeof arguments[0] === 'string' && typeof arguments[1] === 'boolean') {
			return notation.parseNotation(this._impl, arguments[0], arguments[1], 'figurine');
		}
		else {
			throw new exception.IllegalArgument('Position#figurineNotation()');
		}
	};



	// -----------------------------------------------------------------------------
	// UCI
	// -----------------------------------------------------------------------------


	/**
	 * Return the UCI notation corresponding to the given move descriptor.
	 *
	 * Examples of UCI notation: `'e2e4'`, `'b8c6'`, `'e7e8q'` (promotion)... For more details, please refer to:
	 * - {@link https://en.wikipedia.org/wiki/Universal_Chess_Interface}
	 * - {@link https://www.chessprogramming.org/UCI}
	 * - {@link https://www.shredderchess.com/download/div/uci.zip}
	 *
	 * @param {MoveDescriptor} moveDescriptor
	 * @param {boolean} [forceKxR=false] If `true`, castling moves are encoded as "king-take-rook", i.e. for instance white king-side castling will be `'e1h1'`
	 *        (instead of `'e1g1'` in UCI standard). If `false`, castling move encoding follows the UCI standard for normal chess games (e.g. `'e1g1'`).
	 *        For Chess960 games, the "king-take-rook" style is always used, whatever the value of this flag.
	 * @returns {string}
	 *
	 *//**
	 *
	 * Parse the given string as UCI notation and return the corresponding move descriptor.
	 *
	 * @param {string} move
	 * @param {boolean} [strict=false] If `true`, "king-take-rook"-encoded castling moves (i.e. for instance `'e1h1'` for white king-side castling)
	 *        are rejected in case of normal chess games. If `false`, both "king-take-rook"-encoded and UCI-standard-encoded castling moves (e.g. `'e1g1'`)
	 *        are accepted. For Chess960 games, only the "king-take-rook" style is accepted, whatever the value of this flag.
	 * @returns {MoveDescriptor}
	 * @throws {module:exception.InvalidNotation} If the move parsing fails or if the parsed move would correspond to an illegal move.
	 */
	Position.prototype.uci = function() {
		if(arguments.length === 1 && movedescriptor.isMoveDescriptor(arguments[0])) {
			return uci.getNotation(this._impl, arguments[0], false);
		}
		else if(arguments.length === 2 && movedescriptor.isMoveDescriptor(arguments[0]) && typeof arguments[1] === 'boolean') {
			return uci.getNotation(this._impl, arguments[0], arguments[1]);
		}
		else if(arguments.length === 1 && typeof arguments[0] === 'string') {
			return uci.parseNotation(this._impl, arguments[0], false);
		}
		else if(arguments.length >= 2 && typeof arguments[0] === 'string' && typeof arguments[1] === 'boolean') {
			return uci.parseNotation(this._impl, arguments[0], arguments[1]);
		}
		else {
			throw new exception.IllegalArgument('Position#uci()');
		}
	};
	});

	/******************************************************************************
	 *                                                                            *
	 *    This file is part of Kokopu, a JavaScript chess library.                *
	 *    Copyright (C) 2018-2021  Yoann Le Montagner <yo35 -at- melix.net>       *
	 *                                                                            *
	 *    This program is free software: you can redistribute it and/or           *
	 *    modify it under the terms of the GNU Lesser General Public License      *
	 *    as published by the Free Software Foundation, either version 3 of       *
	 *    the License, or (at your option) any later version.                     *
	 *                                                                            *
	 *    This program is distributed in the hope that it will be useful,         *
	 *    but WITHOUT ANY WARRANTY; without even the implied warranty of          *
	 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the            *
	 *    GNU Lesser General Public License for more details.                     *
	 *                                                                            *
	 *    You should have received a copy of the GNU Lesser General               *
	 *    Public License along with this program. If not, see                     *
	 *    <http://www.gnu.org/licenses/>.                                         *
	 *                                                                            *
	 ******************************************************************************/

	var game = createCommonjsModule(function (module, exports) {






	var Position = position.Position;



	// -----------------------------------------------------------------------------
	// Game
	// -----------------------------------------------------------------------------

	/**
	 * @class
	 * @classdesc Chess game, with the move history, the position at each step of the game,
	 *            the comments and annotations (if any), the result of the game,
	 *            and some meta-data such as the name of the players, the date of the game,
	 *            the name of the tournament, etc...
	 */
	var Game = exports.Game = function() {
		this._playerName  = [undefined, undefined];
		this._playerElo   = [undefined, undefined];
		this._playerTitle = [undefined, undefined];
		this._event     = undefined;
		this._round     = undefined;
		this._date      = undefined;
		this._site      = undefined;
		this._annotator = undefined;
		this._result    = basetypes.LINE;

		this._initialPosition = new Position();
		this._fullMoveNumber = 1;
		this._mainVariationInfo = createVariationInfo(true);
	};


	/**
	 * Get the player name.
	 *
	 * @param {Color} color
	 * @returns {string?}
	 *
	 *//**
	 *
	 * Set the player name.
	 *
	 * @param {Color} color
	 * @param {string?} value
	 */
	Game.prototype.playerName = function(color, value) {
		color = basetypes.colorFromString(color);
		if(color < 0) { throw new exception.IllegalArgument('Game#playerName()'); }
		if(arguments.length === 1) { return this._playerName[color]; }
		else { this._playerName[color] = value; }
	};


	/**
	 * Get the player elo.
	 *
	 * @param {Color} color
	 * @returns {string?}
	 *
	 *//**
	 *
	 * Set the player elo.
	 *
	 * @param {Color} color
	 * @param {string?} value
	 */
	Game.prototype.playerElo = function(color, value) {
		color = basetypes.colorFromString(color);
		if(color < 0) { throw new exception.IllegalArgument('Game#playerElo()'); }
		if(arguments.length === 1) { return this._playerElo[color]; }
		else { this._playerElo[color] = value; }
	};


	/**
	 * Get the player title.
	 *
	 * @param {Color} color
	 * @returns {string?}
	 *
	 *//**
	 *
	 * Set the player title.
	 *
	 * @param {Color} color
	 * @param {string?} value
	 */
	Game.prototype.playerTitle = function(color, value) {
		color = basetypes.colorFromString(color);
		if(color < 0) { throw new exception.IllegalArgument('Game#playerTitle()'); }
		if(arguments.length === 1) { return this._playerTitle[color]; }
		else { this._playerTitle[color] = value; }
	};


	/**
	 * Get the event.
	 *
	 * @returns {string?}
	 *
	 *//**
	 *
	 * Set the event.
	 *
	 * @param {string?} value
	 */
	Game.prototype.event = function(value) {
		if(arguments.length === 0) { return this._event; }
		else { this._event = value; }
	};


	/**
	 * Get the round.
	 *
	 * @returns {string?}
	 *
	 *//**
	 *
	 * Set the round.
	 *
	 * @param {string?} value
	 */
	Game.prototype.round = function(value) {
		if(arguments.length === 0) { return this._round; }
		else { this._round = value; }
	};


	/**
	 * Get the date of the game.
	 *
	 * @returns {Date|{year:number, month:number}|{year:number}|undefined} Depending on what is defined, the method returns
	 *          the whole date, or just the year and the month, or just the year, or `undefined`.
	 *
	 *//**
	 *
	 * Set the date of the game.
	 *
	 * @param {Date|{year:number, month:number}|{year:number}|undefined} value
	 */
	Game.prototype.date = function(value) {
		if(arguments.length === 0) {
			return this._date;
		}
		else if(value === undefined || value === null) {
			this._date = undefined;
		}
		else if(value instanceof Date) {
			this._date = value;
		}
		else if(typeof value === 'object' && typeof value.year === 'number' && typeof value.month === 'number') {
			this._date = { year: value.year, month: value.month };
		}
		else if(typeof value === 'object' && typeof value.year === 'number' && (value.month === undefined || value.month === null)) {
			this._date = { year: value.year };
		}
		else {
			throw new exception.IllegalArgument('Game#date()');
		}
	};


	/**
	 * Get where the game takes place.
	 *
	 * @returns {string?}
	 *
	 *//**
	 *
	 * Set where the game takes place.
	 *
	 * @param {string?} value
	 */
	Game.prototype.site = function(value) {
		if(arguments.length === 0) { return this._site; }
		else { this._site = value; }
	};


	/**
	 * Get the name of the annotator.
	 *
	 * @returns {string?}
	 *
	 *//**
	 *
	 * Set the name of the annotator.
	 *
	 * @param {string?} value
	 */
	Game.prototype.annotator = function(value) {
		if(arguments.length === 0) { return this._annotator; }
		else { this._annotator = value; }
	};


	/**
	 * Get the result of the game.
	 *
	 * @returns {GameResult}
	 *
	 *//**
	 *
	 * Set the result of the game.
	 *
	 * @param {GameResult} value
	 */
	Game.prototype.result = function(value) {
		if(arguments.length === 0) {
			return basetypes.resultToString(this._result);
		}
		else {
			var result = basetypes.resultFromString(value);
			if(result < 0) {
				throw new exception.IllegalArgument('Game#result()');
			}
			this._result = result;
		}
	};


	/**
	 * Get the {@link GameVariant} of the game.
	 *
	 * @returns {GameVariant}
	 */
	Game.prototype.variant = function() {
		return this._initialPosition.variant();
	};


	/**
	 * Get the initial position of the game.
	 *
	 * @returns {Position}
	 *
	 *//**
	 *
	 * Set the initial position of the game.
	 *
	 * WARNING: this resets the main variation.
	 *
	 * @param {Position} initialPosition
	 * @param {number} [fullMoveNumber=1]
	 */
	Game.prototype.initialPosition = function(initialPosition, fullMoveNumber) {
		if(arguments.length === 0) {
			return this._initialPosition;
		}
		else {
			if(!(initialPosition instanceof Position)) {
				throw new exception.IllegalArgument('Game#initialPosition()');
			}
			if(arguments.length === 1) {
				fullMoveNumber = 1;
			}
			else if(typeof fullMoveNumber !== 'number') {
				throw new exception.IllegalArgument('Game#initialPosition()');
			}
			this._initialPosition = initialPosition;
			this._fullMoveNumber = fullMoveNumber;
			this._mainVariationInfo = createVariationInfo(true);
		}
	};


	/**
	 * The main variation of the game.
	 *
	 * @returns {Variation}
	 */
	Game.prototype.mainVariation = function() {
		return new Variation(this._mainVariationInfo, this._fullMoveNumber, this._initialPosition, true);
	};



	// -----------------------------------------------------------------------------
	// Node
	// -----------------------------------------------------------------------------

	/**
	 * @param {MoveDescriptor} moveDescriptor
	 * @returns {object}
	 * @ignore
	 */
	function createNodeInfo(moveDescriptor) {
		return {

			// `moveDescriptor` is `undefined` in case of a null-move.
			moveDescriptor: moveDescriptor,

			// Next move and alternative variations.
			next: undefined,
			variations: [],

			// Annotations and comments associated to the underlying move.
			nags: {},
			tags: {},
			comment: undefined,
			isLongComment: false
		};
	}


	/**
	 * @class
	 * @classdesc Represent one move in the tree structure formed by a chess game with multiple variations.
	 *
	 * @description This constructor is not exposed in the public Kokopu API. Only internal objects and functions
	 *              are allowed to instantiate {@link Node} objects.
	 */
	function Node(info, parentVariation, fullMoveNumber, positionBefore) {
		this._info = info;
		this._parentVariation = parentVariation;
		this._fullMoveNumber = fullMoveNumber;
		this._positionBefore = positionBefore;
	}


	/**
	 * Play the move descriptor encoded in the given node info structure, or play null-move if no move descriptor is defined.
	 *
	 * @param {Position} position
	 * @param {object} info
	 * @ignore
	 */
	function applyMoveDescriptor(position, info) {
		if(info.moveDescriptor === undefined) {
			position.playNullMove();
		}
		else {
			position.play(info.moveDescriptor);
		}
	}


	/**
	 * Regenerate `_positionBefore` if necessary on the given node.
	 *
	 * @param {Node} node
	 * @returns {Position}
	 * @ignore
	 */
	function rebuildPositionBeforeIfNecessary(node) {
		if(!node._positionBefore) {
			node._positionBefore = new Position(node._parentVariation._initialPosition);
			var currentInfo = node._parentVariation._info.first;
			while(currentInfo !== node._info) {
				if(currentInfo === undefined) {
					throw new exception.IllegalArgument('The current node is invalid.');
				}
				applyMoveDescriptor(node._positionBefore, currentInfo);
				currentInfo = currentInfo.next;
			}
		}
		return node._positionBefore;
	}


	/**
	 * SAN representation of the move associated to the current node.
	 *
	 * @returns {string}
	 */
	Node.prototype.notation = function() {
		return this._info.moveDescriptor === undefined ? '--' : rebuildPositionBeforeIfNecessary(this).notation(this._info.moveDescriptor);
	};


	/**
	 * SAN-like representation of the move associated to the current node.
	 *
	 * @returns {string} Chess pieces are represented with their respective unicode character, instead of the first letter of their English name.
	 */
	Node.prototype.figurineNotation = function() {
		return this._info.moveDescriptor === undefined ? '--' : rebuildPositionBeforeIfNecessary(this).figurineNotation(this._info.moveDescriptor);
	};


	/**
	 * Chess position before the current move.
	 *
	 * @returns {Position}
	 */
	Node.prototype.positionBefore = function() {
		return new Position(rebuildPositionBeforeIfNecessary(this));
	};


	/**
	 * Chess position obtained after the current move.
	 *
	 * @returns {Position}
	 */
	Node.prototype.position = function() {
		var position = this.positionBefore();
		if(this._info.moveDescriptor === undefined) {
			position.playNullMove();
		}
		else {
			position.play(this._info.moveDescriptor);
		}
		return position;
	};


	/**
	 * Full-move number. It starts at 1, and is incremented after each black move.
	 *
	 * @returns {number}
	 */
	Node.prototype.fullMoveNumber = function() {
		return this._fullMoveNumber;
	};


	/**
	 * Color the side corresponding to the current move.
	 *
	 * @returns {Color}
	 */
	Node.prototype.moveColor = function() {
		return rebuildPositionBeforeIfNecessary(this).turn();
	};


	/**
	 * Compute the "position-before" and "full-move-number" applicable to the node after the given one.
	 *
	 * @param {Node} node
	 * @returns {{positionBefore:Position, fullMoveNumber:number}}
	 * @ignore
	 */
	function computePositionBeforeAndFullMoveNumberForNextNode(node) {

		// Compute the position-before applicable on the next node.
		var positionBefore = rebuildPositionBeforeIfNecessary(node);
		applyMoveDescriptor(positionBefore, node._info);

		// Compute the full-move-number applicable to the next node.
		var fullMoveNumber = positionBefore.turn() === 'w' ? node._fullMoveNumber + 1 : node._fullMoveNumber;

		// Invalidate the position-before on the current node.
		node._positionBefore = null;

		return { positionBefore:positionBefore, fullMoveNumber:fullMoveNumber };
	}


	/**
	 * Go to the next move within the same variation.
	 *
	 * @returns {Node?} `undefined` if the current move is the last move of the variation, or a node corresponding to the next move otherwise.
	 */
	Node.prototype.next = function() {
		if(!this._info.next) { return undefined; }
		var next = computePositionBeforeAndFullMoveNumberForNextNode(this);
		return new Node(this._info.next, this._parentVariation, next.fullMoveNumber, next.positionBefore);
	};


	/**
	 * Return the variations that can be followed instead of the current move.
	 *
	 * @returns {Variation[]}
	 */
	Node.prototype.variations = function() {
		if(this._info.variations.length === 0) {
			return [];
		}

		var result = [];
		var positionBefore = this.positionBefore();
		for(var i = 0; i < this._info.variations.length; ++i) {
			result.push(new Variation(this._info.variations[i], this._fullMoveNumber, positionBefore, this._parentVariation._withinLongVariation));
		}
		return result;
	};


	/**
	 * Return the NAGs associated to the current move.
	 *
	 * @returns {number[]}
	 */
	Node.prototype.nags = function() {
		var result = [];
		for(var key in this._info.nags) {
			if(this._info.nags[key]) {
				result.push(key);
			}
		}
		return result;
	};


	/**
	 * Check whether the current move has the given NAG or not.
	 *
	 * @param {number} nag
	 * @returns {boolean}
	 */
	Node.prototype.hasNag = function(nag) {
		return Boolean(this._info.nags[nag]);
	};


	/**
	 * Add the given NAG to the current move.
	 *
	 * @param {number} nag
	 */
	Node.prototype.addNag = function(nag) {
		this._info.nags[nag] = true;
	};


	/**
	 * Remove the given NAG from the current move.
	 *
	 * @param {number} nag
	 */
	Node.prototype.removeNag = function(nag) {
		delete this._info.nags[nag];
	};


	/**
	 * Return the keys of the tags associated to the current move.
	 *
	 * @returns {string[]}
	 */
	Node.prototype.tags = function() {
		var result = [];
		for(var key in this._info.tags) {
			if(this._info.tags[key] !== undefined) {
				result.push(key);
			}
		}
		return result;
	};


	/**
	 * Get the value associated to the given tag key on the current move.
	 *
	 * @param {string} tagKey
	 * @returns {string?} `undefined` if no value is associated to this tag key on the current move.
	 *
	 *//**
	 *
	 * Set the value associated to the given tag key on the current move.
	 *
	 * @param {string} tagKey
	 * @param {string?} value
	 */
	Node.prototype.tag = function(tagKey, value) {
		if(arguments.length === 1) {
			return this._info.tags[tagKey];
		}
		else {
			this._info.tags[tagKey] = value;
		}
	};


	/**
	 * Get the text comment associated to the current move.
	 *
	 * @returns {string?} `undefined` if no comment is defined for the move.
	 *
	 *//**
	 *
	 * Set the text comment associated to the current move.
	 *
	 * @param {string} value
	 * @param {boolean} [isLongComment=false]
	 */
	Node.prototype.comment = function(value, isLongComment) {
		if(arguments.length === 0) {
			return this._info.comment;
		}
		else {
			this._info.comment = value;
			this._info.isLongComment = Boolean(isLongComment);
		}
	};


	/**
	 * Whether the text comment associated to the current move is long or short.
	 *
	 * @returns {boolean}
	 */
	Node.prototype.isLongComment = function() {
		return this._parentVariation._withinLongVariation && this._info.isLongComment;
	};


	/**
	 * Compute the move descriptor associated to the given SAN notation, assuming the given position.
	 *
	 * @param {Position} position Position based on which the given SAN notation must be interpreted.
	 * @param {string} move SAN notation (or `'--'` for a null-move).
	 * @returns {MoveDescriptor?} `undefined` is returned in case of a null-move.
	 * @throws {module:exception.InvalidNotation} If the move notation cannot be parsed.
	 * @ignore
	 */
	function computeMoveDescriptor(position, move) {
		if(move === '--') {
			if(!position.isNullMoveLegal()) {
				throw new exception.InvalidNotation(position, '--', i18n.ILLEGAL_NULL_MOVE);
			}
			return undefined;
		}
		else {
			return position.notation(move);
		}
	}


	/**
	 * Play the given move, and return a new {@link Node} pointing at the resulting position.
	 *
	 * @param {string} move SAN notation (or `'--'` for a null-move).
	 * @returns {Node} A new node, pointing at the new position.
	 * @throws {module:exception.InvalidNotation} If the move notation cannot be parsed.
	 */
	Node.prototype.play = function(move) {
		var next = computePositionBeforeAndFullMoveNumberForNextNode(this);
		this._info.next = createNodeInfo(computeMoveDescriptor(next.positionBefore, move));
		return new Node(this._info.next, this._parentVariation, next.fullMoveNumber, next.positionBefore);
	};


	/**
	 * Create a new variation that can be played instead of the current move.
	 *
	 * @param {boolean} isLongVariation
	 * @returns {Variation}
	 */
	Node.prototype.addVariation = function(isLongVariation) {
		this._info.variations.push(createVariationInfo(isLongVariation));
		return new Variation(this._info.variations[this._info.variations.length - 1], this._fullMoveNumber, this.positionBefore(), this._parentVariation._withinLongVariation);
	};



	// -----------------------------------------------------------------------------
	// Variation
	// -----------------------------------------------------------------------------

	/**
	 * @param {boolean} isLongVariation
	 * @returns {object}
	 * @ignore
	 */
	function createVariationInfo(isLongVariation) {
		return {

			isLongVariation: isLongVariation,

			// First move of the variation.
			first: undefined,

			// Annotations and comments associated to the underlying variation.
			nags: {},
			tags: {},
			comment: undefined,
			isLongComment: false
		};
	}


	/**
	 * @class
	 * @classdesc Represent one variation in the tree structure formed by a chess game, meaning
	 * a starting chess position and list of played consecutively from this position.
	 *
	 * @description This constructor is not exposed in the public Kokopu API. Only internal objects and functions
	 *              are allowed to instantiate {@link Variation} objects.
	 */
	function Variation(info, initialFullMoveNumber, initialPosition, withinLongVariation) {
		this._info = info;
		this._initialFullMoveNumber = initialFullMoveNumber;
		this._initialPosition = initialPosition;
		this._withinLongVariation = withinLongVariation && info.isLongVariation;
	}


	/**
	 * Whether the current variation is considered as a "long" variation, i.e. a variation that
	 * should be displayed in an isolated block.
	 *
	 * @returns {boolean}
	 */
	Variation.prototype.isLongVariation = function() {
		return this._withinLongVariation;
	};


	/**
	 * Chess position at the beginning of the variation.
	 *
	 * @returns {Position}
	 */
	Variation.prototype.initialPosition = function() {
		return new Position(this._initialPosition);
	};


	/**
	 * Full-move number at the beginning of the variation.
	 *
	 * @returns {number}
	 */
	Variation.prototype.initialFullMoveNumber = function() {
		return this._initialFullMoveNumber;
	};


	/**
	 * First move of the variation.
	 *
	 * @returns {Node?} `undefined` if the variation is empty.
	 */
	Variation.prototype.first = function() {
		if(!this._info.first) { return undefined; }
		return new Node(this._info.first, this, this._initialFullMoveNumber, new Position(this._initialPosition));
	};


	/**
	 * Generate the nodes corresponding to the moves of the current variation.
	 *
	 * @returns {Node[]} An empty array is returned if the variation is empty.
	 */
	Variation.prototype.nodes = function() {
		var result = [];

		var currentNodeInfo = this._info.first;
		var previousNodeInfo = null;
		var previousPositionBefore = this._initialPosition;
		var previousFullMoveNumber = this._initialFullMoveNumber;
		while(currentNodeInfo) {

			// Compute the "position-before" attribute the current node.
			var previousPositionBefore = new Position(previousPositionBefore);
			if(previousNodeInfo !== null) {
				applyMoveDescriptor(previousPositionBefore, previousNodeInfo);
			}

			// Compute the "full-move-number" attribute the current node.
			previousFullMoveNumber = previousNodeInfo !== null && previousPositionBefore.turn() === 'w' ? previousFullMoveNumber + 1 : previousFullMoveNumber;

			// Push the current node.
			result.push(new Node(currentNodeInfo, this, previousFullMoveNumber, previousPositionBefore));

			// Increment the counters.
			previousNodeInfo = currentNodeInfo;
			currentNodeInfo = currentNodeInfo.next;
		}

		return result;
	};


	/**
	 * Return the NAGs associated to the current variation.
	 *
	 * @returns {number[]}
	 * @function
	 */
	Variation.prototype.nags = Node.prototype.nags;


	/**
	 * Check whether the current variation has the given NAG or not.
	 *
	 * @param {number} nag
	 * @returns {boolean}
	 * @function
	 */
	Variation.prototype.hasNag = Node.prototype.hasNag;


	/**
	 * Add the given NAG to the current variation.
	 *
	 * @param {number} nag
	 * @function
	 */
	Variation.prototype.addNag = Node.prototype.addNag;


	/**
	 * Remove the given NAG from the current variation.
	 *
	 * @param {number} nag
	 * @function
	 */
	Variation.prototype.removeNag = Node.prototype.removeNag;


	/**
	 * Return the keys of the tags associated to the current variation.
	 *
	 * @returns {string[]}
	 * @function
	 */
	Variation.prototype.tags = Node.prototype.tags;


	/**
	 * Get the value associated to the given tag key on the current variation.
	 *
	 * @param {string} tagKey
	 * @returns {string?} `undefined` if no value is associated to this tag key on the current variation.
	 * @function
	 *
	 *//**
	 *
	 * Set the value associated to the given tag key on the current variation.
	 *
	 * @param {string} tagKey
	 * @param {string?} value
	 * @function
	 */
	Variation.prototype.tag = Node.prototype.tag;


	/**
	 * Get the text comment associated to the current variation.
	 *
	 * @returns {string?} `undefined` if no comment is defined for the variation.
	 * @function
	 *
	 *//**
	 *
	 * Set the text comment associated to the current variation.
	 *
	 * @param {string} value
	 * @param {boolean} [isLongComment=false]
	 * @function
	 */
	Variation.prototype.comment = Node.prototype.comment;


	/**
	 * Whether the text comment associated to the current variation is long or short.
	 *
	 * @returns {boolean}
	 */
	Variation.prototype.isLongComment = function() {
		return this._withinLongVariation && this._info.isLongComment;
	};


	/**
	 * Play the given move as the first move of the variation.
	 *
	 * @param {string} move SAN notation (or `'--'` for a null-move).
	 * @returns {Node} A new node object, to represents the new move.
	 * @throws {module:exception.InvalidNotation} If the move notation cannot be parsed.
	 */
	Variation.prototype.play = function(move) {
		var positionBefore = new Position(this._initialPosition);
		this._info.first = createNodeInfo(computeMoveDescriptor(positionBefore, move));
		return new Node(this._info.first, this, this._initialFullMoveNumber, positionBefore);
	};
	});

	/******************************************************************************
	 *                                                                            *
	 *    This file is part of Kokopu, a JavaScript chess library.                *
	 *    Copyright (C) 2018-2021  Yoann Le Montagner <yo35 -at- melix.net>       *
	 *                                                                            *
	 *    This program is free software: you can redistribute it and/or           *
	 *    modify it under the terms of the GNU Lesser General Public License      *
	 *    as published by the Free Software Foundation, either version 3 of       *
	 *    the License, or (at your option) any later version.                     *
	 *                                                                            *
	 *    This program is distributed in the hope that it will be useful,         *
	 *    but WITHOUT ANY WARRANTY; without even the implied warranty of          *
	 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the            *
	 *    GNU Lesser General Public License for more details.                     *
	 *                                                                            *
	 *    You should have received a copy of the GNU Lesser General               *
	 *    Public License along with this program. If not, see                     *
	 *    <http://www.gnu.org/licenses/>.                                         *
	 *                                                                            *
	 ******************************************************************************/

	var database = createCommonjsModule(function (module, exports) {


	/**
	 * @class
	 * @classdesc Describe a set of chess games (see also {@link Game}).
	 *
	 * @description This constructor is not exposed in the public Kokopu API. Only internal objects and functions
	 *              are allowed to instantiate {@link Database} objects.
	 */
	var Database = exports.Database = function(impl, gameCountGetter, gameGetter) {
		this._impl = impl;
		this._gameCountGetter = gameCountGetter;
		this._gameGetter = gameGetter;
	};


	/**
	 * Number of games in the database.
	 *
	 * @returns {number}
	 */
	Database.prototype.gameCount = function() {
		return this._gameCountGetter(this._impl);
	};


	/**
	 * Return the game corresponding to the given index.
	 *
	 * @param {number} index Between 0 inclusive and {@link Database#gameCount} exclusive.
	 * @returns {Game}
	 */
	Database.prototype.game = function(index) {
		return this._gameGetter(this._impl, index);
	};
	});

	/******************************************************************************
	 *                                                                            *
	 *    This file is part of Kokopu, a JavaScript chess library.                *
	 *    Copyright (C) 2018-2021  Yoann Le Montagner <yo35 -at- melix.net>       *
	 *                                                                            *
	 *    This program is free software: you can redistribute it and/or           *
	 *    modify it under the terms of the GNU Lesser General Public License      *
	 *    as published by the Free Software Foundation, either version 3 of       *
	 *    the License, or (at your option) any later version.                     *
	 *                                                                            *
	 *    This program is distributed in the hope that it will be useful,         *
	 *    but WITHOUT ANY WARRANTY; without even the implied warranty of          *
	 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the            *
	 *    GNU Lesser General Public License for more details.                     *
	 *                                                                            *
	 *    You should have received a copy of the GNU Lesser General               *
	 *    Public License along with this program. If not, see                     *
	 *    <http://www.gnu.org/licenses/>.                                         *
	 *                                                                            *
	 ******************************************************************************/

	var tokenstream = createCommonjsModule(function (module, exports) {






	/**
	 * @class
	 * @classdesc Stream of tokens.
	 */
	var TokenStream = exports.TokenStream = function(pgnString, initialLocation) {

		// Remove the BOM (byte order mark) if any.
		if(pgnString.codePointAt(0) === 0xFEFF) {
			pgnString = pgnString.substr(1);
		}

		this._text                = pgnString; // what is being parsed
		this._pos                 = 0;         // current position in the string
		this._lineIndex           = 1;         // current line in the string
		this._emptyLineFound      = false;     // whether an empty line has been encountered while parsing the current token
		this._token               = 0;         // current token
		this._tokenValue          = null;      // current token value (if any)
		this._tokenCharacterIndex = -1;        // position of the current token in the string
		this._tokenLineIndex      = -1;        // line of the current token in the string

		if(initialLocation) {
			this._pos = initialLocation.pos;
			this._lineIndex = initialLocation.lineIndex;
		}

		// Space-like matchers
		this._matchSpaces = /[ \f\t\v]+/g;
		this._matchLineBreak = /\r?\n|\r/g;
		this._matchLineBreak.needIncrementLineIndex = true;
		this._matchFastAdvance = /[^ \f\t\v\r\n"{][^ \f\t\v\r\n"{10*]*/g;

		// Token matchers
		this._matchBeginHeader = /\[/g;
		this._matchEndHeader = /\]/g;
		this._matchHeaderId = /(\w+)/g;
		this._matchEnterHeaderValue = /"/g;
		this._matchMoveNumber = /[1-9][0-9]*\.(?:\.\.)?/g;
		this._matchMove = /(?:O-O-O|O-O|[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|(?:[a-h]x?)?[a-h][1-8](?:=?[KQRBNP])?)[+#]?|--/g;
		this._matchNag = /([!?][!?]?|\+\/?[-=]|[-=]\/?\+|=|inf|~)|\$([1-9][0-9]*)/g;
		this._matchEnterComment = /\{/g;
		this._matchBeginVariation = /\(/g;
		this._matchEndVariation = /\)/g;
		this._matchEndOfGame = /1-0|0-1|1\/2-1\/2|\*/g;

		// Special modes
		this._headerValueMode = /((?:[^\\"\f\t\v\r\n]|\\[^\f\t\v\r\n])*)"/g;
		this._headerValueDegradedMode = /[^\r\n]*/g;
		this._commentMode = /((?:[^\\}]|\\.)*)\}/g;
		this._commentMode.needIncrementLineIndex = true;
	};


	// PGN token types
	var TOKEN_BEGIN_HEADER    = TokenStream.BEGIN_HEADER    =  1; // [
	var TOKEN_END_HEADER      = TokenStream.END_HEADER      =  2; // ]
	var TOKEN_HEADER_ID       = TokenStream.HEADER_ID       =  3; // Identifier of a header (e.g. `White` in header `[White "Kasparov, G."]`)
	var TOKEN_HEADER_VALUE    = TokenStream.HEADER_VALUE    =  4; // Value of a header (e.g. `Kasparov, G.` in header `[White "Kasparov, G."]`)
	var TOKEN_MOVE_NUMBER     = TokenStream.MOVE_NUMBER     =  5; // 42. or 23...
	var TOKEN_MOVE            = TokenStream.MOVE            =  6; // SAN notation
	var TOKEN_NAG             = TokenStream.NAG             =  7; // $[1-9][0-9]* or a key from table SPECIAL_NAGS_LOOKUP (!!, +-, etc..)
	var TOKEN_COMMENT         = TokenStream.COMMENT         =  8; // {some text}
	var TOKEN_BEGIN_VARIATION = TokenStream.BEGIN_VARIATION =  9; // (
	var TOKEN_END_VARIATION   = TokenStream.END_VARIATION   = 10; // )
	var TOKEN_END_OF_GAME     = TokenStream.END_OF_GAME     = 11; // 1-0, 0-1, 1/2-1/2 or *

	// Movetext-related tokens are found within this interval.
	var FIRST_MOVE_TEXT_TOKEN = TOKEN_MOVE_NUMBER;
	var LAST_MOVE_TEXT_TOKEN = TOKEN_END_OF_GAME;


	/**
	 * Try to match the given regular expression at the current position, and increment the stream cursor (`stream._pos`) and the line counter (`stream._lineIndex`) in case of a match.
	 *
	 * @param {TokenStream} stream
	 * @param {RegExp} regex
	 * @returns {boolean}
	 */
	function testAtPos(stream, regex) {
		if(regex.matchedIndex === undefined || regex.matchedIndex < stream._pos) {
			regex.lastIndex = stream._pos;
			regex.matched = regex.exec(stream._text);
			regex.matchedIndex = regex.matched === null ? stream._text.length : regex.matched.index;
		}

		if(regex.matchedIndex === stream._pos) {
			stream._pos = regex.lastIndex;
			if(regex.needIncrementLineIndex) {
				var reLineBreak = /\r?\n|\r/g;
				while(reLineBreak.exec(regex.matched[0])) {
					++stream._lineIndex;
				}
			}
			return true;
		}
		else {
			return false;
		}
	}


	/**
	 * Advance until the first non-blank character.
	 *
	 * @param {TokenStream} stream
	 */
	function skipBlanks(stream) {
		var newLineCount = 0;
		while(stream._pos < stream._text.length) {
			if(testAtPos(stream, stream._matchSpaces)) ;
			else if(testAtPos(stream, stream._matchLineBreak)) {
				++newLineCount;
			}
			else {
				break;
			}
		}

		// An empty line was encountered if and only if at least to line breaks were found.
		stream._emptyLineFound = newLineCount >= 2;
	}


	/**
	 * Trim the given string, and replace all the sub-sequence of 1 or several space-like characters by a single space.
	 *
	 * @param {string} text
	 * @returns {string}
	 */
	function trimAndCollapseSpaces(text) {
		return text.replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' ');
	}


	/**
	 * Parse a header value, unescaping special characters.
	 *
	 * @param {string} rawHeaderValue
	 * @returns {string}
	 */
	function parseHeaderValue(rawHeaderValue) {
		return trimAndCollapseSpaces(rawHeaderValue.replace(/\\([\\"])/g, '$1'));
	}


	/**
	 * Parse a comment, unescaping special characters, and looking for the `[%key value]` tags.
	 *
	 * @param {string} rawComment String to parse.
	 * @returns {{comment:string, tags:Object}}
	 */
	function parseCommentValue(rawComment) {
		rawComment = rawComment.replace(/\\([\\}])/g, '$1');

		// Find and remove the tags from the raw comment.
		var tags = {};
		var comment = rawComment.replace(/\[%([a-zA-Z0-9]+)\s+([^[\]]+)\]/g, function(match, p1, p2) {
			tags[p1] = p2;
			return ' ';
		});

		// Trim the comment and collapse sequences of space characters into 1 character only.
		comment = trimAndCollapseSpaces(comment);
		if(comment === '') {
			comment = undefined;
		}

		// Return the result
		return { comment:comment, tags:tags };
	}


	// Conversion table NAG -> numeric code
	var SPECIAL_NAGS_LOOKUP = {
		'!!' :  3,             // very good move
		'!'  :  1,             // good move
		'!?' :  5,             // interesting move
		'?!' :  6,             // questionable move
		'?'  :  2,             // bad move
		'??' :  4,             // very bad move
		'+-' : 18,             // White has a decisive advantage
		'+/-': 16,             // White has a moderate advantage
		'+/=': 14, '+=' : 14,  // White has a slight advantage
		'='  : 10,             // equal position
		'~'  : 13, 'inf': 13,  // unclear position
		'=/+': 15, '=+' : 15,  // Black has a slight advantage
		'-/+': 17,             // Black has a moderate advantage
		'-+' : 19              // Black has a decisive advantage
	};


	/**
	 * Try to consume 1 token.
	 *
	 * @returns {boolean} `true` if a token could have been read, `false` if the end of the text has been reached.
	 * @throws {module:exception.InvalidPGN} If the text cannot be interpreted as a valid token.
	 */
	TokenStream.prototype.consumeToken = function() {

		// Consume blank (i.e. meaning-less) characters
		skipBlanks(this);
		if(this._pos >= this._text.length) {
			this._tokenCharacterIndex = this._text.length;
			this._tokenLineIndex = this._lineIndex;
			return false;
		}

		// Save the location of the token.
		this._tokenCharacterIndex = this._pos;
		this._tokenLineIndex = this._lineIndex;

		// Match a move number
		if(testAtPos(this, this._matchMoveNumber)) {
			this._token      = TOKEN_MOVE_NUMBER;
			this._tokenValue = null;
		}

		// Match a move or a null-move
		else if(testAtPos(this, this._matchMove)) {
			this._token      = TOKEN_MOVE;
			this._tokenValue = this._matchMove.matched[0];
		}

		// Match a NAG
		else if(testAtPos(this, this._matchNag)) {
			this._token      = TOKEN_NAG;
			this._tokenValue = this._matchNag.matched[2] === undefined ? SPECIAL_NAGS_LOOKUP[this._matchNag.matched[1]] :
				parseInt(this._matchNag.matched[2], 10);
		}

		// Match a comment
		else if(testAtPos(this, this._matchEnterComment)) {
			if(!testAtPos(this, this._commentMode)) {
				throw new exception.InvalidPGN(this._text, this._pos, this._lineIndex, i18n.INVALID_PGN_TOKEN);
			}
			this._token      = TOKEN_COMMENT;
			this._tokenValue = parseCommentValue(this._commentMode.matched[1]);
		}

		// Match the beginning of a variation
		else if(testAtPos(this, this._matchBeginVariation)) {
			this._token      = TOKEN_BEGIN_VARIATION;
			this._tokenValue = null;
		}

		// Match the end of a variation
		else if(testAtPos(this, this._matchEndVariation)) {
			this._token      = TOKEN_END_VARIATION;
			this._tokenValue = null;
		}

		// Match a end-of-game marker
		else if(testAtPos(this, this._matchEndOfGame)) {
			this._token      = TOKEN_END_OF_GAME;
			this._tokenValue = this._matchEndOfGame.matched[0];
		}

		// Match the beginning of a game header
		else if(testAtPos(this, this._matchBeginHeader)) {
			this._token      = TOKEN_BEGIN_HEADER;
			this._tokenValue = null;
		}

		// Match the end of a game header
		else if(testAtPos(this, this._matchEndHeader)) {
			this._token      = TOKEN_END_HEADER;
			this._tokenValue = null;
		}

		// Match the ID of a game header
		else if(testAtPos(this, this._matchHeaderId)) {
			this._token      = TOKEN_HEADER_ID;
			this._tokenValue = this._matchHeaderId.matched[1];
		}

		// Match the value of a game header
		else if(testAtPos(this, this._matchEnterHeaderValue)) {
			if(!testAtPos(this, this._headerValueMode)) {
				throw new exception.InvalidPGN(this._text, this._pos, this._lineIndex, i18n.INVALID_PGN_TOKEN);
			}
			this._token      = TOKEN_HEADER_VALUE;
			this._tokenValue = parseHeaderValue(this._headerValueMode.matched[1]);
		}

		// Otherwise, the string is badly formatted with respect to the PGN syntax
		else {
			throw new exception.InvalidPGN(this._text, this._pos, this._lineIndex, i18n.INVALID_PGN_TOKEN);
		}

		return true;
	};


	/**
	 * Try to skip all the tokens until a END_OF_GAME token or the end of the file is encountered.
	 *
	 * @returns {boolean} `true` if any token have been found, `false` if the end of the file has been reached without finding any token.
	 * @throws {module:exception.InvalidPGN} If the text cannot be interpreted as a valid stream of tokens.
	 */
	TokenStream.prototype.skipGame = function() {
		var atLeastOneTokenFound = false;
		while(true) {

			// Consume blank (i.e. meaning-less) characters
			skipBlanks(this);
			if(this._pos >= this._text.length) {
				this._tokenCharacterIndex = this._text.length;
				this._tokenLineIndex = this._lineIndex;
				return atLeastOneTokenFound;
			}

			// Save the location of the token.
			this._tokenCharacterIndex = this._pos;
			this._tokenLineIndex = this._lineIndex;
			atLeastOneTokenFound = true;

			// Skip comments.
			if(testAtPos(this, this._matchEnterComment)) {
				if(!testAtPos(this, this._commentMode)) {
					throw new exception.InvalidPGN(this._text, this._pos, this._lineIndex, i18n.INVALID_PGN_TOKEN);
				}
			}

			// Skip header values.
			else if(testAtPos(this, this._matchEnterHeaderValue)) {
				if(!testAtPos(this, this._headerValueMode) && !testAtPos(this, this._headerValueDegradedMode)) {
					throw new exception.InvalidPGN(this._text, this._pos, this._lineIndex, i18n.INVALID_PGN_TOKEN);
				}
			}

			// Match a end-of-game marker.
			else if(testAtPos(this, this._matchEndOfGame)) {
				this._token      = TOKEN_END_OF_GAME;
				this._tokenValue = this._matchEndOfGame.matched[0];
				return true;
			}

			// Skip everything else until the next space or comment/header-value beginning.
			else if(!testAtPos(this, this._matchFastAdvance)) {
				throw new exception.InvalidPGN(this._text, this._pos, this._lineIndex, i18n.INVALID_PGN_TOKEN);
			}
		}
	};


	/**
	 * PGN string being parsed.
	 */
	TokenStream.prototype.text = function() {
		return this._text;
	};


	/**
	 * Current location within the stream.
	 */
	TokenStream.prototype.currentLocation = function() {
		return { pos: this._pos, lineIndex: this._lineIndex };
	};


	/**
	 * Whether an empty line has been encountered just before the current token.
	 */
	TokenStream.prototype.emptyLineFound = function() {
		return this._emptyLineFound;
	};


	/**
	 * Current token.
	 */
	TokenStream.prototype.token = function() {
		return this._token;
	};


	/**
	 * Value associated to the current token, if any.
	 */
	TokenStream.prototype.tokenValue = function() {
		return this._tokenValue;
	};


	/**
	 * Line index of the current token.
	 */
	TokenStream.prototype.tokenLineIndex = function() {
		return this._tokenLineIndex;
	};


	/**
	 * Character index of the current token.
	 */
	TokenStream.prototype.tokenCharacterIndex = function() {
		return this._tokenCharacterIndex;
	};


	/**
	 * Wether the current token is a token of the move-text section.
	 */
	TokenStream.prototype.isMoveTextSection = function() {
		return this._token >= FIRST_MOVE_TEXT_TOKEN && this._token <= LAST_MOVE_TEXT_TOKEN;
	};
	});

	/******************************************************************************
	 *                                                                            *
	 *    This file is part of Kokopu, a JavaScript chess library.                *
	 *    Copyright (C) 2018-2021  Yoann Le Montagner <yo35 -at- melix.net>       *
	 *                                                                            *
	 *    This program is free software: you can redistribute it and/or           *
	 *    modify it under the terms of the GNU Lesser General Public License      *
	 *    as published by the Free Software Foundation, either version 3 of       *
	 *    the License, or (at your option) any later version.                     *
	 *                                                                            *
	 *    This program is distributed in the hope that it will be useful,         *
	 *    but WITHOUT ANY WARRANTY; without even the implied warranty of          *
	 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the            *
	 *    GNU Lesser General Public License for more details.                     *
	 *                                                                            *
	 *    You should have received a copy of the GNU Lesser General               *
	 *    Public License along with this program. If not, see                     *
	 *    <http://www.gnu.org/licenses/>.                                         *
	 *                                                                            *
	 ******************************************************************************/





	var Position = position.Position;
	var Game = game.Game;
	var Database = database.Database;
	var TokenStream = tokenstream.TokenStream;


	function parseNullableHeader(value) {
		return value === '?' ? undefined : value;
	}


	function parseDateHeader(value) {
		if(/^([0-9]{4})\.([0-9]{2})\.([0-9]{2})$/.test(value)) {
			var year = RegExp.$1;
			var month = RegExp.$2;
			var day = RegExp.$3;
			year = parseInt(year, 10);
			month = parseInt(month, 10);
			day = parseInt(day, 10);
			if(month >= 1 && month <= 12 && day >= 1 && day <= 31) {
				return new Date(year, month - 1, day);
			}
		}
		else if(/^([0-9]{4})\.([0-9]{2})\.\?\?$/.test(value)) {
			var year = RegExp.$1;
			var month = parseInt(RegExp.$2, 10);
			if(month >= 1 && month <= 12) {
				return { year: parseInt(year, 10), month: month };
			}
		}
		else if(/^([0-9]{4})(?:\.\?\?\.\?\?)?$/.test(value)) {
			return { year: parseInt(RegExp.$1, 10) };
		}
		return undefined;
	}


	function parseVariant(value) {
		value = value.toLowerCase();
		if(value === 'regular' || value === 'standard') {
			return 'regular';
		}
		else if(value === 'fischerandom' || /^chess[ -]?960$/.test(value)) {
			return 'chess960';
		}
		else if(/^no[ -]king$/.test(value)) {
			return 'no-king';
		}
		else if(/^white[ -]king[ -]only$/.test(value)) {
			return 'white-king-only';
		}
		else if(/^black[ -]king[ -]only$/.test(value)) {
			return 'black-king-only';
		}
		else {
			return undefined;
		}
	}


	function processHeader(stream, game, initialPositionFactory, key, value, valueCharacterIndex, valueLineIndex) {
		value = value.trim();
		switch(key) {
			case 'White': game.playerName('w', parseNullableHeader(value)); break;
			case 'Black': game.playerName('b', parseNullableHeader(value)); break;
			case 'WhiteElo': game.playerElo('w', value); break;
			case 'BlackElo': game.playerElo('b', value); break;
			case 'WhiteTitle': game.playerTitle('w', value); break;
			case 'BlackTitle': game.playerTitle('b', value); break;
			case 'Event': game.event(parseNullableHeader(value)); break;
			case 'Round': game.round(parseNullableHeader(value)); break;
			case 'Date': game.date(parseDateHeader(value)); break;
			case 'Site': game.site(parseNullableHeader(value)); break;
			case 'Annotator': game.annotator(value); break;

			// The header 'FEN' has a special meaning, in that it is used to define a custom
			// initial position, that may be different from the usual one.
			case 'FEN':
				initialPositionFactory.fen = value;
				initialPositionFactory.fenTokenCharacterIndex = valueCharacterIndex;
				initialPositionFactory.fenTokenLineIndex = valueLineIndex;
				break;

			// The header 'Variant' indicates that this is not a regular chess game.
			case 'Variant':
				initialPositionFactory.variant = parseVariant(value);
				if(!initialPositionFactory.variant) {
					throw new exception.InvalidPGN(stream.text(), valueCharacterIndex, valueLineIndex, i18n.UNKNOWN_VARIANT, value);
				}
				initialPositionFactory.variantTokenCharacterIndex = valueCharacterIndex;
				initialPositionFactory.variantTokenLineIndex = valueLineIndex;
				break;
		}
	}


	function initializeInitialPosition(stream, game, initialPositionFactory) {

		// Nothing to do if no custom FEN has been defined -> let the default state.
		if(!initialPositionFactory.fen) {
			if(initialPositionFactory.variant && initialPositionFactory.variant !== 'regular') {
				throw new exception.InvalidPGN(stream.text(), initialPositionFactory.variantTokenCharacterIndex, initialPositionFactory.variantTokenLineIndex, i18n.VARIANT_WITHOUT_FEN);
			}
			return;
		}

		try {
			var position = new Position(initialPositionFactory.variant ? initialPositionFactory.variant : 'regular', 'empty');
			var moveCounters = position.fen(initialPositionFactory.fen);
			game.initialPosition(position, moveCounters.fullMoveNumber);
		}
		catch(error) {
			if(error instanceof exception.InvalidFEN) {
				throw new exception.InvalidPGN(stream.text(), initialPositionFactory.fenTokenCharacterIndex, initialPositionFactory.fenTokenLineIndex, i18n.INVALID_FEN_IN_PGN_TEXT, error.message);
			}
			else {
				throw error;
			}
		}
	}


	/**
	 * Parse exactly 1 game from the given stream.
	 *
	 * @param {TokenStream} stream
	 * @returns {Game}
	 * @throws {module:exception.InvalidPGN}
	 * @ignore
	 */
	function doParseGame(stream) {

		// State variable for syntactic analysis.
		var game            = null;  // the result
		var node            = null;  // current node (or variation) to which the next move should be appended
		var nodeIsVariation = false; // whether the current node is a variation or not
		var nodeStack       = [];    // when starting a variation, its parent node (btw., always a "true" node, not a variation) is stacked here
		var initialPositionFactory = {};

		// Token loop
		while(stream.consumeToken()) {

			// Create a new game if necessary
			if(game === null) {
				game = new Game();
			}

			// Set-up the root node when the first move-text token is encountered.
			if(stream.isMoveTextSection() && node === null) {
				initializeInitialPosition(stream, game, initialPositionFactory);
				node = game.mainVariation();
				nodeIsVariation = true;
			}

			// Token type switch
			switch(stream.token()) {

				// Header
				case TokenStream.BEGIN_HEADER:
					if(node !== null) {
						throw new exception.InvalidPGN(stream.text(), stream.tokenCharacterIndex(), stream.tokenLineIndex(), i18n.UNEXPECTED_PGN_HEADER);
					}
					if(!stream.consumeToken() || stream.token() !== TokenStream.HEADER_ID) {
						throw new exception.InvalidPGN(stream.text(), stream.tokenCharacterIndex(), stream.tokenLineIndex(), i18n.MISSING_PGN_HEADER_ID);
					}
					var headerId = stream.tokenValue();
					if(!stream.consumeToken() || stream.token() !== TokenStream.HEADER_VALUE) {
						throw new exception.InvalidPGN(stream.text(), stream.tokenCharacterIndex(), stream.tokenLineIndex(), i18n.MISSING_PGN_HEADER_VALUE);
					}
					var headerValue = stream.tokenValue();
					var headerValueCharacterIndex = stream.tokenCharacterIndex();
					var headerValueLineIndex = stream.tokenLineIndex();
					if(!stream.consumeToken() || stream.token() !== TokenStream.END_HEADER) {
						throw new exception.InvalidPGN(stream.text(), stream.tokenCharacterIndex(), stream.tokenLineIndex(), i18n.MISSING_END_OF_PGN_HEADER);
					}
					processHeader(stream, game, initialPositionFactory, headerId, headerValue, headerValueCharacterIndex, headerValueLineIndex);
					break;

				// Move number
				case TokenStream.MOVE_NUMBER:
					break;

				// Move or null-move
				case TokenStream.MOVE:
					try {
						node = node.play(stream.tokenValue());
						nodeIsVariation = false;
					}
					catch(error) {
						if(error instanceof exception.InvalidNotation) {
							throw new exception.InvalidPGN(stream.text(), stream.tokenCharacterIndex(), stream.tokenLineIndex(), i18n.INVALID_MOVE_IN_PGN_TEXT, error.notation, error.message);
						}
						else {
							throw error;
						}
					}
					break;

				// NAG
				case TokenStream.NAG:
					node.addNag(stream.tokenValue());
					break;

				// Comment
				case TokenStream.COMMENT:
					var tags = stream.tokenValue().tags;
					for(var key in tags) {
						if(tags[key] !== undefined) {
							node.tag(key, tags[key]);
						}
					}
					if(stream.tokenValue().comment !== undefined) {
						node.comment(stream.tokenValue().comment, stream.emptyLineFound());
					}
					break;

				// Begin of variation
				case TokenStream.BEGIN_VARIATION:
					if(nodeIsVariation) {
						throw new exception.InvalidPGN(stream.text(), stream.tokenCharacterIndex(), stream.tokenLineIndex(), i18n.UNEXPECTED_BEGIN_OF_VARIATION);
					}
					nodeStack.push(node);
					node = node.addVariation(stream.emptyLineFound());
					nodeIsVariation = true;
					break;

				// End of variation
				case TokenStream.END_VARIATION:
					if(nodeStack.length === 0) {
						throw new exception.InvalidPGN(stream.text(), stream.tokenCharacterIndex(), stream.tokenLineIndex(), i18n.UNEXPECTED_END_OF_VARIATION);
					}
					node = nodeStack.pop();
					nodeIsVariation = false;
					break;

				// End-of-game
				case TokenStream.END_OF_GAME:
					if(nodeStack.length > 0) {
						throw new exception.InvalidPGN(stream.text(), stream.tokenCharacterIndex(), stream.tokenLineIndex(), i18n.UNEXPECTED_END_OF_GAME);
					}
					game.result(stream.tokenValue());
					return game;

				// Something unexpected...
				default:
					throw new exception.InvalidPGN(stream.text(), stream.tokenCharacterIndex(), stream.tokenLineIndex(), i18n.INVALID_PGN_TOKEN);

			} // switch(stream.token())

		} // while(stream.consumeToken())

		throw new exception.InvalidPGN(stream.text(), stream.tokenCharacterIndex(), stream.tokenLineIndex(), i18n.UNEXPECTED_END_OF_TEXT);
	}


	function gameCountGetterImpl(impl) {
		return impl.gameLocations.length;
	}


	function gameGetterImpl(impl, gameIndex) {
		if(impl.currentGameIndex !== gameIndex) {
			impl.stream = new TokenStream(impl.text, impl.gameLocations[gameIndex]);
		}
		impl.currentGameIndex = -1;
		var result = doParseGame(impl.stream);
		impl.currentGameIndex = gameIndex + 1;
		return result;
	}


	/**
	 * PGN parsing function.
	 *
	 * @param {string} pgnString String to parse.
	 * @returns {Database}
	 * @throws {module:exception.InvalidPGN}
	 *
	 *//**
	 *
	 * PGN parsing function.
	 *
	 * @param {string} pgnString String to parse.
	 * @param {number} gameIndex Only the game corresponding to this index is parsed.
	 * @returns {Game}
	 * @throws {module:exception.InvalidPGN}
	 */
	var pgnRead = function(pgnString, gameIndex) {
		var stream = new TokenStream(pgnString);

		// Parse all games (and return a Database object)...
		if(arguments.length === 1) {
			var gameLocations = [];
			while(true) {
				var currentLocation = stream.currentLocation();
				if(!stream.skipGame()) {
					break;
				}
				gameLocations.push(currentLocation);
			}
			return new Database({ text: pgnString, gameLocations: gameLocations, currentGameIndex: -1 }, gameCountGetterImpl, gameGetterImpl);
		}

		// Parse one game...
		else {
			var gameCounter = 0;
			while(gameCounter < gameIndex) {
				if(stream.skipGame()) {
					++gameCounter;
				}
				else {
					throw new exception.InvalidPGN(pgnString, -1, -1, i18n.INVALID_GAME_INDEX, gameIndex, gameCounter);
				}
			}
			return doParseGame(stream);
		}
	};

	var pgn = {
		pgnRead: pgnRead
	};

	/******************************************************************************
	 *                                                                            *
	 *    This file is part of Kokopu, a JavaScript chess library.                *
	 *    Copyright (C) 2018-2021  Yoann Le Montagner <yo35 -at- melix.net>       *
	 *                                                                            *
	 *    This program is free software: you can redistribute it and/or           *
	 *    modify it under the terms of the GNU Lesser General Public License      *
	 *    as published by the Free Software Foundation, either version 3 of       *
	 *    the License, or (at your option) any later version.                     *
	 *                                                                            *
	 *    This program is distributed in the hope that it will be useful,         *
	 *    but WITHOUT ANY WARRANTY; without even the implied warranty of          *
	 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the            *
	 *    GNU Lesser General Public License for more details.                     *
	 *                                                                            *
	 *    You should have received a copy of the GNU Lesser General               *
	 *    Public License along with this program. If not, see                     *
	 *    <http://www.gnu.org/licenses/>.                                         *
	 *                                                                            *
	 ******************************************************************************/


	var i18n$1 = i18n;
	var exception$1 = exception;


	var forEachSquare$1 = util.forEachSquare;
	var squareColor$1 = util.squareColor;
	var squareToCoordinates$1 = util.squareToCoordinates;
	var coordinatesToSquare$1 = util.coordinatesToSquare;

	var isMoveDescriptor$1 = movedescriptor.isMoveDescriptor;

	var Position$1 = position.Position;
	var Game$1 = game.Game;


	var pgnRead$1 = pgn.pgnRead;

	var kokopu = {
		i18n: i18n$1,
		exception: exception$1,
		forEachSquare: forEachSquare$1,
		squareColor: squareColor$1,
		squareToCoordinates: squareToCoordinates$1,
		coordinatesToSquare: coordinatesToSquare$1,
		isMoveDescriptor: isMoveDescriptor$1,
		Position: Position$1,
		Game: Game$1,
		pgnRead: pgnRead$1
	};

	const position$1 = new kokopu.Position();

	const valueMap = {
		p: 1,
		b: 3,
		n: 3,
		r: 5,
		q: 9,
		k: 100,
	};

	function replay(moves) {
		position$1.reset();
		for (const move of moves) {
			position$1.play(move);
		}
	}

	function replayFen(fen) {
		position$1.fen(fen);
	}

	function squareValue(square) {
		let coloredPiece = position$1.square(square);
		if (coloredPiece === '-') {
			return 0;
		}
		let piece = coloredPiece.split('')[1];
		let value = valueMap[piece];
		return value;
	}

	function squareColor$2(square) {
		let coloredPiece = position$1.square(square);
		if (coloredPiece === '-') {
			return null;
		}
		let piece = coloredPiece.split('')[0];
		return piece;
	}

	function drawSquare(square, { background, border }) {
		const squareElement = document.querySelector(`.cv-${square}`);
		if (!squareElement) {
			throw `Given square ${square} is not found`;
		}

		if (background) {
			squareElement.style.background = background;
		}
		if (border) {
			squareElement.style.border = border;
		}
	}

	function drawText(square, position, text) {
		const textElement = document.querySelector(`.cv-${square}-text .cv-${position}`);
		if (!textElement) {
			throw `Given square's ${square} text element ${position} is not found`;
		}
		textElement.innerText = text;
	}

	function createOverlay(id, element, side, zIndex, addText) {
		let overlay = document.getElementById(id);
		if (overlay) {
			overlay.remove();
		}

		let files = getFiles();
		let ranks = getRanks();

		const rect = element.getBoundingClientRect();
		const { width, height, top, left } = rect;

		let overlayElement = document.createElement('div');
		overlayElement.id = id;
		overlayElement.style.position = 'absolute';
		overlayElement.style.zIndex = zIndex;
		overlayElement.style.pointerEvents = 'none';
		overlayElement.style.fontFamily = "'Noto Sans','Segoe UI', sans-serif";
		overlayElement.style.fontSize = '12px';
		overlayElement.style.fontWeight = 'bold';
		overlayElement.style.width = width + 'px';
		overlayElement.style.height = height + 'px';
		overlayElement.style.top = top + window.scrollY + 'px';
		overlayElement.style.left = left + 'px';
		overlayElement.style.display = 'grid';
		overlayElement.style.gridTemplate = `repeat(8, 1fr) / repeat(8, 1fr)`;

		if (side === WHITE) {
			ranks.reverse();
		} else {
			files.reverse();
		}

		let gridSquares = [];

		for (const r of ranks) {
			let gridRow = [];
			for (const f of files) {
				gridRow.push(f + r);
				generateSquare(overlayElement, f + r, addText);
			}
			gridSquares.push(`"${gridRow.join(' ')}"`);
		}

		overlayElement.style.gridTemplateAreas = gridSquares.join('\n');

		document.body.appendChild(overlayElement);
	}

	function generateSquare(overlayElement, square, addText) {
		let squareElement = document.createElement('div');
		squareElement.style.gridArea = square;
		squareElement.className = `cv-${square}${addText ? '-text' : ''}`;
		squareElement.style.position = 'relative';
		squareElement.style.position = 'relative';

		overlayElement.appendChild(squareElement);
		if (addText) {
			generateText(squareElement, 'tl');
			generateText(squareElement, 'tr');
			generateText(squareElement, 'bl');
			generateText(squareElement, 'br');
		}
	}

	function generateText(squareElement, position) {
		let textElement = document.createElement('div');
		textElement.style.color = 'white';
		textElement.style.textShadow = '1px 1px 0px black';
		textElement.style.position = 'absolute';
		textElement.style.zIndex = '99999';
		textElement.className = `cv-${position}`;

		switch (position) {
			case 'tl':
				textElement.style.top = '0px';
				textElement.style.left = '2px';
				break;
			case 'tr':
				textElement.style.top = '0px';
				textElement.style.right = '2px';
				break;
			case 'bl':
				textElement.style.bottom = '0px';
				textElement.style.left = '2px';
				break;
			case 'br':
				textElement.style.bottom = '0px';
				textElement.style.right = '2px';
				break;
			default:
				throw `Position must be one of 'tl', 'tr', 'bl', 'br'`;
		}

		squareElement.appendChild(textElement);
	}

	/** Detect free variable `global` from Node.js. */
	var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

	/** Detect free variable `self`. */
	var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

	/** Used as a reference to the global object. */
	var root = freeGlobal || freeSelf || Function('return this')();

	/** Built-in value references. */
	var Symbol = root.Symbol;

	/** Used for built-in method references. */
	var objectProto = Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;

	/**
	 * Used to resolve the
	 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var nativeObjectToString = objectProto.toString;

	/** Built-in value references. */
	var symToStringTag = Symbol ? Symbol.toStringTag : undefined;

	/**
	 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
	 *
	 * @private
	 * @param {*} value The value to query.
	 * @returns {string} Returns the raw `toStringTag`.
	 */
	function getRawTag(value) {
	  var isOwn = hasOwnProperty.call(value, symToStringTag),
	      tag = value[symToStringTag];

	  try {
	    value[symToStringTag] = undefined;
	    var unmasked = true;
	  } catch (e) {}

	  var result = nativeObjectToString.call(value);
	  if (unmasked) {
	    if (isOwn) {
	      value[symToStringTag] = tag;
	    } else {
	      delete value[symToStringTag];
	    }
	  }
	  return result;
	}

	/** Used for built-in method references. */
	var objectProto$1 = Object.prototype;

	/**
	 * Used to resolve the
	 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var nativeObjectToString$1 = objectProto$1.toString;

	/**
	 * Converts `value` to a string using `Object.prototype.toString`.
	 *
	 * @private
	 * @param {*} value The value to convert.
	 * @returns {string} Returns the converted string.
	 */
	function objectToString(value) {
	  return nativeObjectToString$1.call(value);
	}

	/** `Object#toString` result references. */
	var nullTag = '[object Null]',
	    undefinedTag = '[object Undefined]';

	/** Built-in value references. */
	var symToStringTag$1 = Symbol ? Symbol.toStringTag : undefined;

	/**
	 * The base implementation of `getTag` without fallbacks for buggy environments.
	 *
	 * @private
	 * @param {*} value The value to query.
	 * @returns {string} Returns the `toStringTag`.
	 */
	function baseGetTag(value) {
	  if (value == null) {
	    return value === undefined ? undefinedTag : nullTag;
	  }
	  return (symToStringTag$1 && symToStringTag$1 in Object(value))
	    ? getRawTag(value)
	    : objectToString(value);
	}

	/**
	 * Checks if `value` is object-like. A value is object-like if it's not `null`
	 * and has a `typeof` result of "object".
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	 * @example
	 *
	 * _.isObjectLike({});
	 * // => true
	 *
	 * _.isObjectLike([1, 2, 3]);
	 * // => true
	 *
	 * _.isObjectLike(_.noop);
	 * // => false
	 *
	 * _.isObjectLike(null);
	 * // => false
	 */
	function isObjectLike(value) {
	  return value != null && typeof value == 'object';
	}

	/**
	 * Checks if `value` is classified as an `Array` object.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
	 * @example
	 *
	 * _.isArray([1, 2, 3]);
	 * // => true
	 *
	 * _.isArray(document.body.children);
	 * // => false
	 *
	 * _.isArray('abc');
	 * // => false
	 *
	 * _.isArray(_.noop);
	 * // => false
	 */
	var isArray = Array.isArray;

	/**
	 * Checks if `value` is the
	 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
	 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
	 * @example
	 *
	 * _.isObject({});
	 * // => true
	 *
	 * _.isObject([1, 2, 3]);
	 * // => true
	 *
	 * _.isObject(_.noop);
	 * // => true
	 *
	 * _.isObject(null);
	 * // => false
	 */
	function isObject(value) {
	  var type = typeof value;
	  return value != null && (type == 'object' || type == 'function');
	}

	/** `Object#toString` result references. */
	var asyncTag = '[object AsyncFunction]',
	    funcTag = '[object Function]',
	    genTag = '[object GeneratorFunction]',
	    proxyTag = '[object Proxy]';

	/**
	 * Checks if `value` is classified as a `Function` object.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
	 * @example
	 *
	 * _.isFunction(_);
	 * // => true
	 *
	 * _.isFunction(/abc/);
	 * // => false
	 */
	function isFunction(value) {
	  if (!isObject(value)) {
	    return false;
	  }
	  // The use of `Object#toString` avoids issues with the `typeof` operator
	  // in Safari 9 which returns 'object' for typed arrays and other constructors.
	  var tag = baseGetTag(value);
	  return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
	}

	/** Used to detect overreaching core-js shims. */
	var coreJsData = root['__core-js_shared__'];

	/** Used to detect methods masquerading as native. */
	var maskSrcKey = (function() {
	  var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || '');
	  return uid ? ('Symbol(src)_1.' + uid) : '';
	}());

	/**
	 * Checks if `func` has its source masked.
	 *
	 * @private
	 * @param {Function} func The function to check.
	 * @returns {boolean} Returns `true` if `func` is masked, else `false`.
	 */
	function isMasked(func) {
	  return !!maskSrcKey && (maskSrcKey in func);
	}

	/** Used for built-in method references. */
	var funcProto = Function.prototype;

	/** Used to resolve the decompiled source of functions. */
	var funcToString = funcProto.toString;

	/**
	 * Converts `func` to its source code.
	 *
	 * @private
	 * @param {Function} func The function to convert.
	 * @returns {string} Returns the source code.
	 */
	function toSource(func) {
	  if (func != null) {
	    try {
	      return funcToString.call(func);
	    } catch (e) {}
	    try {
	      return (func + '');
	    } catch (e) {}
	  }
	  return '';
	}

	/**
	 * Used to match `RegExp`
	 * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
	 */
	var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

	/** Used to detect host constructors (Safari). */
	var reIsHostCtor = /^\[object .+?Constructor\]$/;

	/** Used for built-in method references. */
	var funcProto$1 = Function.prototype,
	    objectProto$2 = Object.prototype;

	/** Used to resolve the decompiled source of functions. */
	var funcToString$1 = funcProto$1.toString;

	/** Used to check objects for own properties. */
	var hasOwnProperty$1 = objectProto$2.hasOwnProperty;

	/** Used to detect if a method is native. */
	var reIsNative = RegExp('^' +
	  funcToString$1.call(hasOwnProperty$1).replace(reRegExpChar, '\\$&')
	  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
	);

	/**
	 * The base implementation of `_.isNative` without bad shim checks.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a native function,
	 *  else `false`.
	 */
	function baseIsNative(value) {
	  if (!isObject(value) || isMasked(value)) {
	    return false;
	  }
	  var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
	  return pattern.test(toSource(value));
	}

	/**
	 * Gets the value at `key` of `object`.
	 *
	 * @private
	 * @param {Object} [object] The object to query.
	 * @param {string} key The key of the property to get.
	 * @returns {*} Returns the property value.
	 */
	function getValue(object, key) {
	  return object == null ? undefined : object[key];
	}

	/**
	 * Gets the native function at `key` of `object`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @param {string} key The key of the method to get.
	 * @returns {*} Returns the function if it's native, else `undefined`.
	 */
	function getNative(object, key) {
	  var value = getValue(object, key);
	  return baseIsNative(value) ? value : undefined;
	}

	/* Built-in method references that are verified to be native. */
	var WeakMap = getNative(root, 'WeakMap');

	/** Used as references for various `Number` constants. */
	var MAX_SAFE_INTEGER = 9007199254740991;

	/** Used to detect unsigned integer values. */
	var reIsUint = /^(?:0|[1-9]\d*)$/;

	/**
	 * Checks if `value` is a valid array-like index.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
	 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
	 */
	function isIndex(value, length) {
	  var type = typeof value;
	  length = length == null ? MAX_SAFE_INTEGER : length;

	  return !!length &&
	    (type == 'number' ||
	      (type != 'symbol' && reIsUint.test(value))) &&
	        (value > -1 && value % 1 == 0 && value < length);
	}

	/**
	 * Performs a
	 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
	 * comparison between two values to determine if they are equivalent.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to compare.
	 * @param {*} other The other value to compare.
	 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
	 * @example
	 *
	 * var object = { 'a': 1 };
	 * var other = { 'a': 1 };
	 *
	 * _.eq(object, object);
	 * // => true
	 *
	 * _.eq(object, other);
	 * // => false
	 *
	 * _.eq('a', 'a');
	 * // => true
	 *
	 * _.eq('a', Object('a'));
	 * // => false
	 *
	 * _.eq(NaN, NaN);
	 * // => true
	 */
	function eq(value, other) {
	  return value === other || (value !== value && other !== other);
	}

	/** Used as references for various `Number` constants. */
	var MAX_SAFE_INTEGER$1 = 9007199254740991;

	/**
	 * Checks if `value` is a valid array-like length.
	 *
	 * **Note:** This method is loosely based on
	 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
	 * @example
	 *
	 * _.isLength(3);
	 * // => true
	 *
	 * _.isLength(Number.MIN_VALUE);
	 * // => false
	 *
	 * _.isLength(Infinity);
	 * // => false
	 *
	 * _.isLength('3');
	 * // => false
	 */
	function isLength(value) {
	  return typeof value == 'number' &&
	    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER$1;
	}

	/**
	 * Checks if `value` is array-like. A value is considered array-like if it's
	 * not a function and has a `value.length` that's an integer greater than or
	 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
	 * @example
	 *
	 * _.isArrayLike([1, 2, 3]);
	 * // => true
	 *
	 * _.isArrayLike(document.body.children);
	 * // => true
	 *
	 * _.isArrayLike('abc');
	 * // => true
	 *
	 * _.isArrayLike(_.noop);
	 * // => false
	 */
	function isArrayLike(value) {
	  return value != null && isLength(value.length) && !isFunction(value);
	}

	/** Used for built-in method references. */
	var objectProto$3 = Object.prototype;

	/**
	 * Checks if `value` is likely a prototype object.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
	 */
	function isPrototype(value) {
	  var Ctor = value && value.constructor,
	      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto$3;

	  return value === proto;
	}

	/**
	 * The base implementation of `_.times` without support for iteratee shorthands
	 * or max array length checks.
	 *
	 * @private
	 * @param {number} n The number of times to invoke `iteratee`.
	 * @param {Function} iteratee The function invoked per iteration.
	 * @returns {Array} Returns the array of results.
	 */
	function baseTimes(n, iteratee) {
	  var index = -1,
	      result = Array(n);

	  while (++index < n) {
	    result[index] = iteratee(index);
	  }
	  return result;
	}

	/** `Object#toString` result references. */
	var argsTag = '[object Arguments]';

	/**
	 * The base implementation of `_.isArguments`.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
	 */
	function baseIsArguments(value) {
	  return isObjectLike(value) && baseGetTag(value) == argsTag;
	}

	/** Used for built-in method references. */
	var objectProto$4 = Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty$2 = objectProto$4.hasOwnProperty;

	/** Built-in value references. */
	var propertyIsEnumerable = objectProto$4.propertyIsEnumerable;

	/**
	 * Checks if `value` is likely an `arguments` object.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
	 *  else `false`.
	 * @example
	 *
	 * _.isArguments(function() { return arguments; }());
	 * // => true
	 *
	 * _.isArguments([1, 2, 3]);
	 * // => false
	 */
	var isArguments = baseIsArguments(function() { return arguments; }()) ? baseIsArguments : function(value) {
	  return isObjectLike(value) && hasOwnProperty$2.call(value, 'callee') &&
	    !propertyIsEnumerable.call(value, 'callee');
	};

	/**
	 * This method returns `false`.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.13.0
	 * @category Util
	 * @returns {boolean} Returns `false`.
	 * @example
	 *
	 * _.times(2, _.stubFalse);
	 * // => [false, false]
	 */
	function stubFalse() {
	  return false;
	}

	/** Detect free variable `exports`. */
	var freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;

	/** Detect free variable `module`. */
	var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;

	/** Detect the popular CommonJS extension `module.exports`. */
	var moduleExports = freeModule && freeModule.exports === freeExports;

	/** Built-in value references. */
	var Buffer = moduleExports ? root.Buffer : undefined;

	/* Built-in method references for those with the same name as other `lodash` methods. */
	var nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined;

	/**
	 * Checks if `value` is a buffer.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.3.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
	 * @example
	 *
	 * _.isBuffer(new Buffer(2));
	 * // => true
	 *
	 * _.isBuffer(new Uint8Array(2));
	 * // => false
	 */
	var isBuffer = nativeIsBuffer || stubFalse;

	/** `Object#toString` result references. */
	var argsTag$1 = '[object Arguments]',
	    arrayTag = '[object Array]',
	    boolTag = '[object Boolean]',
	    dateTag = '[object Date]',
	    errorTag = '[object Error]',
	    funcTag$1 = '[object Function]',
	    mapTag = '[object Map]',
	    numberTag = '[object Number]',
	    objectTag = '[object Object]',
	    regexpTag = '[object RegExp]',
	    setTag = '[object Set]',
	    stringTag = '[object String]',
	    weakMapTag = '[object WeakMap]';

	var arrayBufferTag = '[object ArrayBuffer]',
	    dataViewTag = '[object DataView]',
	    float32Tag = '[object Float32Array]',
	    float64Tag = '[object Float64Array]',
	    int8Tag = '[object Int8Array]',
	    int16Tag = '[object Int16Array]',
	    int32Tag = '[object Int32Array]',
	    uint8Tag = '[object Uint8Array]',
	    uint8ClampedTag = '[object Uint8ClampedArray]',
	    uint16Tag = '[object Uint16Array]',
	    uint32Tag = '[object Uint32Array]';

	/** Used to identify `toStringTag` values of typed arrays. */
	var typedArrayTags = {};
	typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
	typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
	typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
	typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
	typedArrayTags[uint32Tag] = true;
	typedArrayTags[argsTag$1] = typedArrayTags[arrayTag] =
	typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
	typedArrayTags[dataViewTag] = typedArrayTags[dateTag] =
	typedArrayTags[errorTag] = typedArrayTags[funcTag$1] =
	typedArrayTags[mapTag] = typedArrayTags[numberTag] =
	typedArrayTags[objectTag] = typedArrayTags[regexpTag] =
	typedArrayTags[setTag] = typedArrayTags[stringTag] =
	typedArrayTags[weakMapTag] = false;

	/**
	 * The base implementation of `_.isTypedArray` without Node.js optimizations.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
	 */
	function baseIsTypedArray(value) {
	  return isObjectLike(value) &&
	    isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
	}

	/**
	 * The base implementation of `_.unary` without support for storing metadata.
	 *
	 * @private
	 * @param {Function} func The function to cap arguments for.
	 * @returns {Function} Returns the new capped function.
	 */
	function baseUnary(func) {
	  return function(value) {
	    return func(value);
	  };
	}

	/** Detect free variable `exports`. */
	var freeExports$1 = typeof exports == 'object' && exports && !exports.nodeType && exports;

	/** Detect free variable `module`. */
	var freeModule$1 = freeExports$1 && typeof module == 'object' && module && !module.nodeType && module;

	/** Detect the popular CommonJS extension `module.exports`. */
	var moduleExports$1 = freeModule$1 && freeModule$1.exports === freeExports$1;

	/** Detect free variable `process` from Node.js. */
	var freeProcess = moduleExports$1 && freeGlobal.process;

	/** Used to access faster Node.js helpers. */
	var nodeUtil = (function() {
	  try {
	    // Use `util.types` for Node.js 10+.
	    var types = freeModule$1 && freeModule$1.require && freeModule$1.require('util').types;

	    if (types) {
	      return types;
	    }

	    // Legacy `process.binding('util')` for Node.js < 10.
	    return freeProcess && freeProcess.binding && freeProcess.binding('util');
	  } catch (e) {}
	}());

	/* Node.js helper references. */
	var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;

	/**
	 * Checks if `value` is classified as a typed array.
	 *
	 * @static
	 * @memberOf _
	 * @since 3.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
	 * @example
	 *
	 * _.isTypedArray(new Uint8Array);
	 * // => true
	 *
	 * _.isTypedArray([]);
	 * // => false
	 */
	var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;

	/** Used for built-in method references. */
	var objectProto$5 = Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty$3 = objectProto$5.hasOwnProperty;

	/**
	 * Creates an array of the enumerable property names of the array-like `value`.
	 *
	 * @private
	 * @param {*} value The value to query.
	 * @param {boolean} inherited Specify returning inherited property names.
	 * @returns {Array} Returns the array of property names.
	 */
	function arrayLikeKeys(value, inherited) {
	  var isArr = isArray(value),
	      isArg = !isArr && isArguments(value),
	      isBuff = !isArr && !isArg && isBuffer(value),
	      isType = !isArr && !isArg && !isBuff && isTypedArray(value),
	      skipIndexes = isArr || isArg || isBuff || isType,
	      result = skipIndexes ? baseTimes(value.length, String) : [],
	      length = result.length;

	  for (var key in value) {
	    if ((inherited || hasOwnProperty$3.call(value, key)) &&
	        !(skipIndexes && (
	           // Safari 9 has enumerable `arguments.length` in strict mode.
	           key == 'length' ||
	           // Node.js 0.10 has enumerable non-index properties on buffers.
	           (isBuff && (key == 'offset' || key == 'parent')) ||
	           // PhantomJS 2 has enumerable non-index properties on typed arrays.
	           (isType && (key == 'buffer' || key == 'byteLength' || key == 'byteOffset')) ||
	           // Skip index properties.
	           isIndex(key, length)
	        ))) {
	      result.push(key);
	    }
	  }
	  return result;
	}

	/**
	 * Creates a unary function that invokes `func` with its argument transformed.
	 *
	 * @private
	 * @param {Function} func The function to wrap.
	 * @param {Function} transform The argument transform.
	 * @returns {Function} Returns the new function.
	 */
	function overArg(func, transform) {
	  return function(arg) {
	    return func(transform(arg));
	  };
	}

	/* Built-in method references for those with the same name as other `lodash` methods. */
	var nativeKeys = overArg(Object.keys, Object);

	/** Used for built-in method references. */
	var objectProto$6 = Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty$4 = objectProto$6.hasOwnProperty;

	/**
	 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of property names.
	 */
	function baseKeys(object) {
	  if (!isPrototype(object)) {
	    return nativeKeys(object);
	  }
	  var result = [];
	  for (var key in Object(object)) {
	    if (hasOwnProperty$4.call(object, key) && key != 'constructor') {
	      result.push(key);
	    }
	  }
	  return result;
	}

	/**
	 * Creates an array of the own enumerable property names of `object`.
	 *
	 * **Note:** Non-object values are coerced to objects. See the
	 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
	 * for more details.
	 *
	 * @static
	 * @since 0.1.0
	 * @memberOf _
	 * @category Object
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of property names.
	 * @example
	 *
	 * function Foo() {
	 *   this.a = 1;
	 *   this.b = 2;
	 * }
	 *
	 * Foo.prototype.c = 3;
	 *
	 * _.keys(new Foo);
	 * // => ['a', 'b'] (iteration order is not guaranteed)
	 *
	 * _.keys('hi');
	 * // => ['0', '1']
	 */
	function keys(object) {
	  return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
	}

	/* Built-in method references that are verified to be native. */
	var nativeCreate = getNative(Object, 'create');

	/**
	 * Removes all key-value entries from the hash.
	 *
	 * @private
	 * @name clear
	 * @memberOf Hash
	 */
	function hashClear() {
	  this.__data__ = nativeCreate ? nativeCreate(null) : {};
	  this.size = 0;
	}

	/**
	 * Removes `key` and its value from the hash.
	 *
	 * @private
	 * @name delete
	 * @memberOf Hash
	 * @param {Object} hash The hash to modify.
	 * @param {string} key The key of the value to remove.
	 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
	 */
	function hashDelete(key) {
	  var result = this.has(key) && delete this.__data__[key];
	  this.size -= result ? 1 : 0;
	  return result;
	}

	/** Used to stand-in for `undefined` hash values. */
	var HASH_UNDEFINED = '__lodash_hash_undefined__';

	/** Used for built-in method references. */
	var objectProto$7 = Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty$5 = objectProto$7.hasOwnProperty;

	/**
	 * Gets the hash value for `key`.
	 *
	 * @private
	 * @name get
	 * @memberOf Hash
	 * @param {string} key The key of the value to get.
	 * @returns {*} Returns the entry value.
	 */
	function hashGet(key) {
	  var data = this.__data__;
	  if (nativeCreate) {
	    var result = data[key];
	    return result === HASH_UNDEFINED ? undefined : result;
	  }
	  return hasOwnProperty$5.call(data, key) ? data[key] : undefined;
	}

	/** Used for built-in method references. */
	var objectProto$8 = Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty$6 = objectProto$8.hasOwnProperty;

	/**
	 * Checks if a hash value for `key` exists.
	 *
	 * @private
	 * @name has
	 * @memberOf Hash
	 * @param {string} key The key of the entry to check.
	 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	 */
	function hashHas(key) {
	  var data = this.__data__;
	  return nativeCreate ? (data[key] !== undefined) : hasOwnProperty$6.call(data, key);
	}

	/** Used to stand-in for `undefined` hash values. */
	var HASH_UNDEFINED$1 = '__lodash_hash_undefined__';

	/**
	 * Sets the hash `key` to `value`.
	 *
	 * @private
	 * @name set
	 * @memberOf Hash
	 * @param {string} key The key of the value to set.
	 * @param {*} value The value to set.
	 * @returns {Object} Returns the hash instance.
	 */
	function hashSet(key, value) {
	  var data = this.__data__;
	  this.size += this.has(key) ? 0 : 1;
	  data[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED$1 : value;
	  return this;
	}

	/**
	 * Creates a hash object.
	 *
	 * @private
	 * @constructor
	 * @param {Array} [entries] The key-value pairs to cache.
	 */
	function Hash(entries) {
	  var index = -1,
	      length = entries == null ? 0 : entries.length;

	  this.clear();
	  while (++index < length) {
	    var entry = entries[index];
	    this.set(entry[0], entry[1]);
	  }
	}

	// Add methods to `Hash`.
	Hash.prototype.clear = hashClear;
	Hash.prototype['delete'] = hashDelete;
	Hash.prototype.get = hashGet;
	Hash.prototype.has = hashHas;
	Hash.prototype.set = hashSet;

	/**
	 * Removes all key-value entries from the list cache.
	 *
	 * @private
	 * @name clear
	 * @memberOf ListCache
	 */
	function listCacheClear() {
	  this.__data__ = [];
	  this.size = 0;
	}

	/**
	 * Gets the index at which the `key` is found in `array` of key-value pairs.
	 *
	 * @private
	 * @param {Array} array The array to inspect.
	 * @param {*} key The key to search for.
	 * @returns {number} Returns the index of the matched value, else `-1`.
	 */
	function assocIndexOf(array, key) {
	  var length = array.length;
	  while (length--) {
	    if (eq(array[length][0], key)) {
	      return length;
	    }
	  }
	  return -1;
	}

	/** Used for built-in method references. */
	var arrayProto = Array.prototype;

	/** Built-in value references. */
	var splice = arrayProto.splice;

	/**
	 * Removes `key` and its value from the list cache.
	 *
	 * @private
	 * @name delete
	 * @memberOf ListCache
	 * @param {string} key The key of the value to remove.
	 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
	 */
	function listCacheDelete(key) {
	  var data = this.__data__,
	      index = assocIndexOf(data, key);

	  if (index < 0) {
	    return false;
	  }
	  var lastIndex = data.length - 1;
	  if (index == lastIndex) {
	    data.pop();
	  } else {
	    splice.call(data, index, 1);
	  }
	  --this.size;
	  return true;
	}

	/**
	 * Gets the list cache value for `key`.
	 *
	 * @private
	 * @name get
	 * @memberOf ListCache
	 * @param {string} key The key of the value to get.
	 * @returns {*} Returns the entry value.
	 */
	function listCacheGet(key) {
	  var data = this.__data__,
	      index = assocIndexOf(data, key);

	  return index < 0 ? undefined : data[index][1];
	}

	/**
	 * Checks if a list cache value for `key` exists.
	 *
	 * @private
	 * @name has
	 * @memberOf ListCache
	 * @param {string} key The key of the entry to check.
	 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	 */
	function listCacheHas(key) {
	  return assocIndexOf(this.__data__, key) > -1;
	}

	/**
	 * Sets the list cache `key` to `value`.
	 *
	 * @private
	 * @name set
	 * @memberOf ListCache
	 * @param {string} key The key of the value to set.
	 * @param {*} value The value to set.
	 * @returns {Object} Returns the list cache instance.
	 */
	function listCacheSet(key, value) {
	  var data = this.__data__,
	      index = assocIndexOf(data, key);

	  if (index < 0) {
	    ++this.size;
	    data.push([key, value]);
	  } else {
	    data[index][1] = value;
	  }
	  return this;
	}

	/**
	 * Creates an list cache object.
	 *
	 * @private
	 * @constructor
	 * @param {Array} [entries] The key-value pairs to cache.
	 */
	function ListCache(entries) {
	  var index = -1,
	      length = entries == null ? 0 : entries.length;

	  this.clear();
	  while (++index < length) {
	    var entry = entries[index];
	    this.set(entry[0], entry[1]);
	  }
	}

	// Add methods to `ListCache`.
	ListCache.prototype.clear = listCacheClear;
	ListCache.prototype['delete'] = listCacheDelete;
	ListCache.prototype.get = listCacheGet;
	ListCache.prototype.has = listCacheHas;
	ListCache.prototype.set = listCacheSet;

	/* Built-in method references that are verified to be native. */
	var Map = getNative(root, 'Map');

	/**
	 * Removes all key-value entries from the map.
	 *
	 * @private
	 * @name clear
	 * @memberOf MapCache
	 */
	function mapCacheClear() {
	  this.size = 0;
	  this.__data__ = {
	    'hash': new Hash,
	    'map': new (Map || ListCache),
	    'string': new Hash
	  };
	}

	/**
	 * Checks if `value` is suitable for use as unique object key.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
	 */
	function isKeyable(value) {
	  var type = typeof value;
	  return (type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean')
	    ? (value !== '__proto__')
	    : (value === null);
	}

	/**
	 * Gets the data for `map`.
	 *
	 * @private
	 * @param {Object} map The map to query.
	 * @param {string} key The reference key.
	 * @returns {*} Returns the map data.
	 */
	function getMapData(map, key) {
	  var data = map.__data__;
	  return isKeyable(key)
	    ? data[typeof key == 'string' ? 'string' : 'hash']
	    : data.map;
	}

	/**
	 * Removes `key` and its value from the map.
	 *
	 * @private
	 * @name delete
	 * @memberOf MapCache
	 * @param {string} key The key of the value to remove.
	 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
	 */
	function mapCacheDelete(key) {
	  var result = getMapData(this, key)['delete'](key);
	  this.size -= result ? 1 : 0;
	  return result;
	}

	/**
	 * Gets the map value for `key`.
	 *
	 * @private
	 * @name get
	 * @memberOf MapCache
	 * @param {string} key The key of the value to get.
	 * @returns {*} Returns the entry value.
	 */
	function mapCacheGet(key) {
	  return getMapData(this, key).get(key);
	}

	/**
	 * Checks if a map value for `key` exists.
	 *
	 * @private
	 * @name has
	 * @memberOf MapCache
	 * @param {string} key The key of the entry to check.
	 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	 */
	function mapCacheHas(key) {
	  return getMapData(this, key).has(key);
	}

	/**
	 * Sets the map `key` to `value`.
	 *
	 * @private
	 * @name set
	 * @memberOf MapCache
	 * @param {string} key The key of the value to set.
	 * @param {*} value The value to set.
	 * @returns {Object} Returns the map cache instance.
	 */
	function mapCacheSet(key, value) {
	  var data = getMapData(this, key),
	      size = data.size;

	  data.set(key, value);
	  this.size += data.size == size ? 0 : 1;
	  return this;
	}

	/**
	 * Creates a map cache object to store key-value pairs.
	 *
	 * @private
	 * @constructor
	 * @param {Array} [entries] The key-value pairs to cache.
	 */
	function MapCache(entries) {
	  var index = -1,
	      length = entries == null ? 0 : entries.length;

	  this.clear();
	  while (++index < length) {
	    var entry = entries[index];
	    this.set(entry[0], entry[1]);
	  }
	}

	// Add methods to `MapCache`.
	MapCache.prototype.clear = mapCacheClear;
	MapCache.prototype['delete'] = mapCacheDelete;
	MapCache.prototype.get = mapCacheGet;
	MapCache.prototype.has = mapCacheHas;
	MapCache.prototype.set = mapCacheSet;

	/**
	 * Appends the elements of `values` to `array`.
	 *
	 * @private
	 * @param {Array} array The array to modify.
	 * @param {Array} values The values to append.
	 * @returns {Array} Returns `array`.
	 */
	function arrayPush(array, values) {
	  var index = -1,
	      length = values.length,
	      offset = array.length;

	  while (++index < length) {
	    array[offset + index] = values[index];
	  }
	  return array;
	}

	/**
	 * Removes all key-value entries from the stack.
	 *
	 * @private
	 * @name clear
	 * @memberOf Stack
	 */
	function stackClear() {
	  this.__data__ = new ListCache;
	  this.size = 0;
	}

	/**
	 * Removes `key` and its value from the stack.
	 *
	 * @private
	 * @name delete
	 * @memberOf Stack
	 * @param {string} key The key of the value to remove.
	 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
	 */
	function stackDelete(key) {
	  var data = this.__data__,
	      result = data['delete'](key);

	  this.size = data.size;
	  return result;
	}

	/**
	 * Gets the stack value for `key`.
	 *
	 * @private
	 * @name get
	 * @memberOf Stack
	 * @param {string} key The key of the value to get.
	 * @returns {*} Returns the entry value.
	 */
	function stackGet(key) {
	  return this.__data__.get(key);
	}

	/**
	 * Checks if a stack value for `key` exists.
	 *
	 * @private
	 * @name has
	 * @memberOf Stack
	 * @param {string} key The key of the entry to check.
	 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	 */
	function stackHas(key) {
	  return this.__data__.has(key);
	}

	/** Used as the size to enable large array optimizations. */
	var LARGE_ARRAY_SIZE = 200;

	/**
	 * Sets the stack `key` to `value`.
	 *
	 * @private
	 * @name set
	 * @memberOf Stack
	 * @param {string} key The key of the value to set.
	 * @param {*} value The value to set.
	 * @returns {Object} Returns the stack cache instance.
	 */
	function stackSet(key, value) {
	  var data = this.__data__;
	  if (data instanceof ListCache) {
	    var pairs = data.__data__;
	    if (!Map || (pairs.length < LARGE_ARRAY_SIZE - 1)) {
	      pairs.push([key, value]);
	      this.size = ++data.size;
	      return this;
	    }
	    data = this.__data__ = new MapCache(pairs);
	  }
	  data.set(key, value);
	  this.size = data.size;
	  return this;
	}

	/**
	 * Creates a stack cache object to store key-value pairs.
	 *
	 * @private
	 * @constructor
	 * @param {Array} [entries] The key-value pairs to cache.
	 */
	function Stack(entries) {
	  var data = this.__data__ = new ListCache(entries);
	  this.size = data.size;
	}

	// Add methods to `Stack`.
	Stack.prototype.clear = stackClear;
	Stack.prototype['delete'] = stackDelete;
	Stack.prototype.get = stackGet;
	Stack.prototype.has = stackHas;
	Stack.prototype.set = stackSet;

	/**
	 * A specialized version of `_.filter` for arrays without support for
	 * iteratee shorthands.
	 *
	 * @private
	 * @param {Array} [array] The array to iterate over.
	 * @param {Function} predicate The function invoked per iteration.
	 * @returns {Array} Returns the new filtered array.
	 */
	function arrayFilter(array, predicate) {
	  var index = -1,
	      length = array == null ? 0 : array.length,
	      resIndex = 0,
	      result = [];

	  while (++index < length) {
	    var value = array[index];
	    if (predicate(value, index, array)) {
	      result[resIndex++] = value;
	    }
	  }
	  return result;
	}

	/**
	 * This method returns a new empty array.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.13.0
	 * @category Util
	 * @returns {Array} Returns the new empty array.
	 * @example
	 *
	 * var arrays = _.times(2, _.stubArray);
	 *
	 * console.log(arrays);
	 * // => [[], []]
	 *
	 * console.log(arrays[0] === arrays[1]);
	 * // => false
	 */
	function stubArray() {
	  return [];
	}

	/** Used for built-in method references. */
	var objectProto$9 = Object.prototype;

	/** Built-in value references. */
	var propertyIsEnumerable$1 = objectProto$9.propertyIsEnumerable;

	/* Built-in method references for those with the same name as other `lodash` methods. */
	var nativeGetSymbols = Object.getOwnPropertySymbols;

	/**
	 * Creates an array of the own enumerable symbols of `object`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of symbols.
	 */
	var getSymbols = !nativeGetSymbols ? stubArray : function(object) {
	  if (object == null) {
	    return [];
	  }
	  object = Object(object);
	  return arrayFilter(nativeGetSymbols(object), function(symbol) {
	    return propertyIsEnumerable$1.call(object, symbol);
	  });
	};

	/**
	 * The base implementation of `getAllKeys` and `getAllKeysIn` which uses
	 * `keysFunc` and `symbolsFunc` to get the enumerable property names and
	 * symbols of `object`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @param {Function} keysFunc The function to get the keys of `object`.
	 * @param {Function} symbolsFunc The function to get the symbols of `object`.
	 * @returns {Array} Returns the array of property names and symbols.
	 */
	function baseGetAllKeys(object, keysFunc, symbolsFunc) {
	  var result = keysFunc(object);
	  return isArray(object) ? result : arrayPush(result, symbolsFunc(object));
	}

	/**
	 * Creates an array of own enumerable property names and symbols of `object`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of property names and symbols.
	 */
	function getAllKeys(object) {
	  return baseGetAllKeys(object, keys, getSymbols);
	}

	/* Built-in method references that are verified to be native. */
	var DataView = getNative(root, 'DataView');

	/* Built-in method references that are verified to be native. */
	var Promise$1 = getNative(root, 'Promise');

	/* Built-in method references that are verified to be native. */
	var Set$1 = getNative(root, 'Set');

	/** `Object#toString` result references. */
	var mapTag$1 = '[object Map]',
	    objectTag$1 = '[object Object]',
	    promiseTag = '[object Promise]',
	    setTag$1 = '[object Set]',
	    weakMapTag$1 = '[object WeakMap]';

	var dataViewTag$1 = '[object DataView]';

	/** Used to detect maps, sets, and weakmaps. */
	var dataViewCtorString = toSource(DataView),
	    mapCtorString = toSource(Map),
	    promiseCtorString = toSource(Promise$1),
	    setCtorString = toSource(Set$1),
	    weakMapCtorString = toSource(WeakMap);

	/**
	 * Gets the `toStringTag` of `value`.
	 *
	 * @private
	 * @param {*} value The value to query.
	 * @returns {string} Returns the `toStringTag`.
	 */
	var getTag = baseGetTag;

	// Fallback for data views, maps, sets, and weak maps in IE 11 and promises in Node.js < 6.
	if ((DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag$1) ||
	    (Map && getTag(new Map) != mapTag$1) ||
	    (Promise$1 && getTag(Promise$1.resolve()) != promiseTag) ||
	    (Set$1 && getTag(new Set$1) != setTag$1) ||
	    (WeakMap && getTag(new WeakMap) != weakMapTag$1)) {
	  getTag = function(value) {
	    var result = baseGetTag(value),
	        Ctor = result == objectTag$1 ? value.constructor : undefined,
	        ctorString = Ctor ? toSource(Ctor) : '';

	    if (ctorString) {
	      switch (ctorString) {
	        case dataViewCtorString: return dataViewTag$1;
	        case mapCtorString: return mapTag$1;
	        case promiseCtorString: return promiseTag;
	        case setCtorString: return setTag$1;
	        case weakMapCtorString: return weakMapTag$1;
	      }
	    }
	    return result;
	  };
	}

	var getTag$1 = getTag;

	/** Built-in value references. */
	var Uint8Array = root.Uint8Array;

	/** Used to stand-in for `undefined` hash values. */
	var HASH_UNDEFINED$2 = '__lodash_hash_undefined__';

	/**
	 * Adds `value` to the array cache.
	 *
	 * @private
	 * @name add
	 * @memberOf SetCache
	 * @alias push
	 * @param {*} value The value to cache.
	 * @returns {Object} Returns the cache instance.
	 */
	function setCacheAdd(value) {
	  this.__data__.set(value, HASH_UNDEFINED$2);
	  return this;
	}

	/**
	 * Checks if `value` is in the array cache.
	 *
	 * @private
	 * @name has
	 * @memberOf SetCache
	 * @param {*} value The value to search for.
	 * @returns {number} Returns `true` if `value` is found, else `false`.
	 */
	function setCacheHas(value) {
	  return this.__data__.has(value);
	}

	/**
	 *
	 * Creates an array cache object to store unique values.
	 *
	 * @private
	 * @constructor
	 * @param {Array} [values] The values to cache.
	 */
	function SetCache(values) {
	  var index = -1,
	      length = values == null ? 0 : values.length;

	  this.__data__ = new MapCache;
	  while (++index < length) {
	    this.add(values[index]);
	  }
	}

	// Add methods to `SetCache`.
	SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
	SetCache.prototype.has = setCacheHas;

	/**
	 * A specialized version of `_.some` for arrays without support for iteratee
	 * shorthands.
	 *
	 * @private
	 * @param {Array} [array] The array to iterate over.
	 * @param {Function} predicate The function invoked per iteration.
	 * @returns {boolean} Returns `true` if any element passes the predicate check,
	 *  else `false`.
	 */
	function arraySome(array, predicate) {
	  var index = -1,
	      length = array == null ? 0 : array.length;

	  while (++index < length) {
	    if (predicate(array[index], index, array)) {
	      return true;
	    }
	  }
	  return false;
	}

	/**
	 * Checks if a `cache` value for `key` exists.
	 *
	 * @private
	 * @param {Object} cache The cache to query.
	 * @param {string} key The key of the entry to check.
	 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	 */
	function cacheHas(cache, key) {
	  return cache.has(key);
	}

	/** Used to compose bitmasks for value comparisons. */
	var COMPARE_PARTIAL_FLAG = 1,
	    COMPARE_UNORDERED_FLAG = 2;

	/**
	 * A specialized version of `baseIsEqualDeep` for arrays with support for
	 * partial deep comparisons.
	 *
	 * @private
	 * @param {Array} array The array to compare.
	 * @param {Array} other The other array to compare.
	 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
	 * @param {Function} customizer The function to customize comparisons.
	 * @param {Function} equalFunc The function to determine equivalents of values.
	 * @param {Object} stack Tracks traversed `array` and `other` objects.
	 * @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
	 */
	function equalArrays(array, other, bitmask, customizer, equalFunc, stack) {
	  var isPartial = bitmask & COMPARE_PARTIAL_FLAG,
	      arrLength = array.length,
	      othLength = other.length;

	  if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
	    return false;
	  }
	  // Check that cyclic values are equal.
	  var arrStacked = stack.get(array);
	  var othStacked = stack.get(other);
	  if (arrStacked && othStacked) {
	    return arrStacked == other && othStacked == array;
	  }
	  var index = -1,
	      result = true,
	      seen = (bitmask & COMPARE_UNORDERED_FLAG) ? new SetCache : undefined;

	  stack.set(array, other);
	  stack.set(other, array);

	  // Ignore non-index properties.
	  while (++index < arrLength) {
	    var arrValue = array[index],
	        othValue = other[index];

	    if (customizer) {
	      var compared = isPartial
	        ? customizer(othValue, arrValue, index, other, array, stack)
	        : customizer(arrValue, othValue, index, array, other, stack);
	    }
	    if (compared !== undefined) {
	      if (compared) {
	        continue;
	      }
	      result = false;
	      break;
	    }
	    // Recursively compare arrays (susceptible to call stack limits).
	    if (seen) {
	      if (!arraySome(other, function(othValue, othIndex) {
	            if (!cacheHas(seen, othIndex) &&
	                (arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
	              return seen.push(othIndex);
	            }
	          })) {
	        result = false;
	        break;
	      }
	    } else if (!(
	          arrValue === othValue ||
	            equalFunc(arrValue, othValue, bitmask, customizer, stack)
	        )) {
	      result = false;
	      break;
	    }
	  }
	  stack['delete'](array);
	  stack['delete'](other);
	  return result;
	}

	/**
	 * Converts `map` to its key-value pairs.
	 *
	 * @private
	 * @param {Object} map The map to convert.
	 * @returns {Array} Returns the key-value pairs.
	 */
	function mapToArray(map) {
	  var index = -1,
	      result = Array(map.size);

	  map.forEach(function(value, key) {
	    result[++index] = [key, value];
	  });
	  return result;
	}

	/**
	 * Converts `set` to an array of its values.
	 *
	 * @private
	 * @param {Object} set The set to convert.
	 * @returns {Array} Returns the values.
	 */
	function setToArray(set) {
	  var index = -1,
	      result = Array(set.size);

	  set.forEach(function(value) {
	    result[++index] = value;
	  });
	  return result;
	}

	/** Used to compose bitmasks for value comparisons. */
	var COMPARE_PARTIAL_FLAG$1 = 1,
	    COMPARE_UNORDERED_FLAG$1 = 2;

	/** `Object#toString` result references. */
	var boolTag$1 = '[object Boolean]',
	    dateTag$1 = '[object Date]',
	    errorTag$1 = '[object Error]',
	    mapTag$2 = '[object Map]',
	    numberTag$1 = '[object Number]',
	    regexpTag$1 = '[object RegExp]',
	    setTag$2 = '[object Set]',
	    stringTag$1 = '[object String]',
	    symbolTag = '[object Symbol]';

	var arrayBufferTag$1 = '[object ArrayBuffer]',
	    dataViewTag$2 = '[object DataView]';

	/** Used to convert symbols to primitives and strings. */
	var symbolProto = Symbol ? Symbol.prototype : undefined,
	    symbolValueOf = symbolProto ? symbolProto.valueOf : undefined;

	/**
	 * A specialized version of `baseIsEqualDeep` for comparing objects of
	 * the same `toStringTag`.
	 *
	 * **Note:** This function only supports comparing values with tags of
	 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
	 *
	 * @private
	 * @param {Object} object The object to compare.
	 * @param {Object} other The other object to compare.
	 * @param {string} tag The `toStringTag` of the objects to compare.
	 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
	 * @param {Function} customizer The function to customize comparisons.
	 * @param {Function} equalFunc The function to determine equivalents of values.
	 * @param {Object} stack Tracks traversed `object` and `other` objects.
	 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
	 */
	function equalByTag(object, other, tag, bitmask, customizer, equalFunc, stack) {
	  switch (tag) {
	    case dataViewTag$2:
	      if ((object.byteLength != other.byteLength) ||
	          (object.byteOffset != other.byteOffset)) {
	        return false;
	      }
	      object = object.buffer;
	      other = other.buffer;

	    case arrayBufferTag$1:
	      if ((object.byteLength != other.byteLength) ||
	          !equalFunc(new Uint8Array(object), new Uint8Array(other))) {
	        return false;
	      }
	      return true;

	    case boolTag$1:
	    case dateTag$1:
	    case numberTag$1:
	      // Coerce booleans to `1` or `0` and dates to milliseconds.
	      // Invalid dates are coerced to `NaN`.
	      return eq(+object, +other);

	    case errorTag$1:
	      return object.name == other.name && object.message == other.message;

	    case regexpTag$1:
	    case stringTag$1:
	      // Coerce regexes to strings and treat strings, primitives and objects,
	      // as equal. See http://www.ecma-international.org/ecma-262/7.0/#sec-regexp.prototype.tostring
	      // for more details.
	      return object == (other + '');

	    case mapTag$2:
	      var convert = mapToArray;

	    case setTag$2:
	      var isPartial = bitmask & COMPARE_PARTIAL_FLAG$1;
	      convert || (convert = setToArray);

	      if (object.size != other.size && !isPartial) {
	        return false;
	      }
	      // Assume cyclic values are equal.
	      var stacked = stack.get(object);
	      if (stacked) {
	        return stacked == other;
	      }
	      bitmask |= COMPARE_UNORDERED_FLAG$1;

	      // Recursively compare objects (susceptible to call stack limits).
	      stack.set(object, other);
	      var result = equalArrays(convert(object), convert(other), bitmask, customizer, equalFunc, stack);
	      stack['delete'](object);
	      return result;

	    case symbolTag:
	      if (symbolValueOf) {
	        return symbolValueOf.call(object) == symbolValueOf.call(other);
	      }
	  }
	  return false;
	}

	/** Used to compose bitmasks for value comparisons. */
	var COMPARE_PARTIAL_FLAG$2 = 1;

	/** Used for built-in method references. */
	var objectProto$a = Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty$7 = objectProto$a.hasOwnProperty;

	/**
	 * A specialized version of `baseIsEqualDeep` for objects with support for
	 * partial deep comparisons.
	 *
	 * @private
	 * @param {Object} object The object to compare.
	 * @param {Object} other The other object to compare.
	 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
	 * @param {Function} customizer The function to customize comparisons.
	 * @param {Function} equalFunc The function to determine equivalents of values.
	 * @param {Object} stack Tracks traversed `object` and `other` objects.
	 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
	 */
	function equalObjects(object, other, bitmask, customizer, equalFunc, stack) {
	  var isPartial = bitmask & COMPARE_PARTIAL_FLAG$2,
	      objProps = getAllKeys(object),
	      objLength = objProps.length,
	      othProps = getAllKeys(other),
	      othLength = othProps.length;

	  if (objLength != othLength && !isPartial) {
	    return false;
	  }
	  var index = objLength;
	  while (index--) {
	    var key = objProps[index];
	    if (!(isPartial ? key in other : hasOwnProperty$7.call(other, key))) {
	      return false;
	    }
	  }
	  // Check that cyclic values are equal.
	  var objStacked = stack.get(object);
	  var othStacked = stack.get(other);
	  if (objStacked && othStacked) {
	    return objStacked == other && othStacked == object;
	  }
	  var result = true;
	  stack.set(object, other);
	  stack.set(other, object);

	  var skipCtor = isPartial;
	  while (++index < objLength) {
	    key = objProps[index];
	    var objValue = object[key],
	        othValue = other[key];

	    if (customizer) {
	      var compared = isPartial
	        ? customizer(othValue, objValue, key, other, object, stack)
	        : customizer(objValue, othValue, key, object, other, stack);
	    }
	    // Recursively compare objects (susceptible to call stack limits).
	    if (!(compared === undefined
	          ? (objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack))
	          : compared
	        )) {
	      result = false;
	      break;
	    }
	    skipCtor || (skipCtor = key == 'constructor');
	  }
	  if (result && !skipCtor) {
	    var objCtor = object.constructor,
	        othCtor = other.constructor;

	    // Non `Object` object instances with different constructors are not equal.
	    if (objCtor != othCtor &&
	        ('constructor' in object && 'constructor' in other) &&
	        !(typeof objCtor == 'function' && objCtor instanceof objCtor &&
	          typeof othCtor == 'function' && othCtor instanceof othCtor)) {
	      result = false;
	    }
	  }
	  stack['delete'](object);
	  stack['delete'](other);
	  return result;
	}

	/** Used to compose bitmasks for value comparisons. */
	var COMPARE_PARTIAL_FLAG$3 = 1;

	/** `Object#toString` result references. */
	var argsTag$2 = '[object Arguments]',
	    arrayTag$1 = '[object Array]',
	    objectTag$2 = '[object Object]';

	/** Used for built-in method references. */
	var objectProto$b = Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty$8 = objectProto$b.hasOwnProperty;

	/**
	 * A specialized version of `baseIsEqual` for arrays and objects which performs
	 * deep comparisons and tracks traversed objects enabling objects with circular
	 * references to be compared.
	 *
	 * @private
	 * @param {Object} object The object to compare.
	 * @param {Object} other The other object to compare.
	 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
	 * @param {Function} customizer The function to customize comparisons.
	 * @param {Function} equalFunc The function to determine equivalents of values.
	 * @param {Object} [stack] Tracks traversed `object` and `other` objects.
	 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
	 */
	function baseIsEqualDeep(object, other, bitmask, customizer, equalFunc, stack) {
	  var objIsArr = isArray(object),
	      othIsArr = isArray(other),
	      objTag = objIsArr ? arrayTag$1 : getTag$1(object),
	      othTag = othIsArr ? arrayTag$1 : getTag$1(other);

	  objTag = objTag == argsTag$2 ? objectTag$2 : objTag;
	  othTag = othTag == argsTag$2 ? objectTag$2 : othTag;

	  var objIsObj = objTag == objectTag$2,
	      othIsObj = othTag == objectTag$2,
	      isSameTag = objTag == othTag;

	  if (isSameTag && isBuffer(object)) {
	    if (!isBuffer(other)) {
	      return false;
	    }
	    objIsArr = true;
	    objIsObj = false;
	  }
	  if (isSameTag && !objIsObj) {
	    stack || (stack = new Stack);
	    return (objIsArr || isTypedArray(object))
	      ? equalArrays(object, other, bitmask, customizer, equalFunc, stack)
	      : equalByTag(object, other, objTag, bitmask, customizer, equalFunc, stack);
	  }
	  if (!(bitmask & COMPARE_PARTIAL_FLAG$3)) {
	    var objIsWrapped = objIsObj && hasOwnProperty$8.call(object, '__wrapped__'),
	        othIsWrapped = othIsObj && hasOwnProperty$8.call(other, '__wrapped__');

	    if (objIsWrapped || othIsWrapped) {
	      var objUnwrapped = objIsWrapped ? object.value() : object,
	          othUnwrapped = othIsWrapped ? other.value() : other;

	      stack || (stack = new Stack);
	      return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
	    }
	  }
	  if (!isSameTag) {
	    return false;
	  }
	  stack || (stack = new Stack);
	  return equalObjects(object, other, bitmask, customizer, equalFunc, stack);
	}

	/**
	 * The base implementation of `_.isEqual` which supports partial comparisons
	 * and tracks traversed objects.
	 *
	 * @private
	 * @param {*} value The value to compare.
	 * @param {*} other The other value to compare.
	 * @param {boolean} bitmask The bitmask flags.
	 *  1 - Unordered comparison
	 *  2 - Partial comparison
	 * @param {Function} [customizer] The function to customize comparisons.
	 * @param {Object} [stack] Tracks traversed `value` and `other` objects.
	 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
	 */
	function baseIsEqual(value, other, bitmask, customizer, stack) {
	  if (value === other) {
	    return true;
	  }
	  if (value == null || other == null || (!isObjectLike(value) && !isObjectLike(other))) {
	    return value !== value && other !== other;
	  }
	  return baseIsEqualDeep(value, other, bitmask, customizer, baseIsEqual, stack);
	}

	/**
	 * Performs a deep comparison between two values to determine if they are
	 * equivalent.
	 *
	 * **Note:** This method supports comparing arrays, array buffers, booleans,
	 * date objects, error objects, maps, numbers, `Object` objects, regexes,
	 * sets, strings, symbols, and typed arrays. `Object` objects are compared
	 * by their own, not inherited, enumerable properties. Functions and DOM
	 * nodes are compared by strict equality, i.e. `===`.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to compare.
	 * @param {*} other The other value to compare.
	 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
	 * @example
	 *
	 * var object = { 'a': 1 };
	 * var other = { 'a': 1 };
	 *
	 * _.isEqual(object, other);
	 * // => true
	 *
	 * object === other;
	 * // => false
	 */
	function isEqual(value, other) {
	  return baseIsEqual(value, other);
	}

	function controlledSquares(position) {
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

	function drawControlledSquares(squares, mySide) {
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
			// Both are contesting the square, resolve who wins of if its in tension
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

			drawText(square, 'tl', myAttackers.length);
			drawText(square, 'bl', myTotalValue);
			drawText(square, 'tr', opAttackers.length);
			drawText(square, 'br', opponentTotalValue);
		}
	}

	function calculateContestedSquare(square, myAttackers, opAttackers, side) {
		let attackedSquareColor = squareColor$2(square);

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
			(x) => !isKingCheckedAfterMove(position, x, square, side)
		);
		squares[square][side] = attackers;
		let previousAttackers = attackers;

		while (attackers.length > 0) {
			xray(position, attackers);
			attackers = sortAttackers(position, position.getAttacks(square, side)).filter(
				(x) => !isKingCheckedAfterMove(position, x, square, side)
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

	console.log('Script is running');

	const main = async () => {
		try {
			const parser = siteParser(window.location.host);
			// Wait for the necessary elements for the parser before continuing
			console.log('Waiting for game');
			while (true) {
				if (parser.isReady()) {
					break;
				}
				await sleep(500);
			}

			let numOfMoves = -1;
			let mySide = parser.getSide();
			let boardSize = 0;
			let overlayElement = parser.getOverlay();
			let fen = null;
			console.log('Starting main loop');

			while (true) {
				await sleep(16.667);
				const parsedSide = parser.getSide();
				const moves = parser.parseMoves();
				let newFen = null;
				if (typeof parser.getFen !== 'undefined') {
					newFen = parser.getFen(parsedSide);
				}
				const width = overlayElement.clientWidth;

				if (width === 0) {
					overlayElement = parser.getOverlay();
				}

				// If the number of moves, the mySide or the size of the board changes, redraw all the things!
				if (moves.length !== numOfMoves || mySide !== parsedSide || boardSize !== width || fen !== newFen) {
					numOfMoves = moves.length;
					mySide = parsedSide;
					boardSize = width;
					fen = newFen;
					if (numOfMoves) {
						replay(moves);
					} else if (fen) {
						replayFen(fen);
					}
					createOverlay('cv-overlay', overlayElement, mySide, parser.zIndex, false);
					createOverlay('cv-overlay-text', overlayElement, mySide, 99999, true);
					if (numOfMoves || fen) {
						const squares = controlledSquares(position$1);
						drawControlledSquares(squares, mySide);
					} else {
						document.querySelector('#cv-overlay').style.border = '1px dashed hsl(140, 100%, 50%)';
					}
				}
			}
		} catch (e) {
			console.error(e);
		}
	};

	main();

}());
