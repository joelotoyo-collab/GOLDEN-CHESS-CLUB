import { useEffect, useMemo, useState } from 'react';
import {
  Crown,
  RotateCcw,
  Settings2,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
  Play,
  ArrowLeft,
  ChevronRight,
  Bot,
  Clock3,
} from 'lucide-react';
import { sound } from '@/sound';

type Color = 'white' | 'black';
type Difficulty = 'easy' | 'medium' | 'hard';
type GameMode = 'computer' | 'two-player';
type PlayerChoice = 'white' | 'black' | 'random';
type Screen = 'loading' | 'setup' | 'game';

type PieceType =
  | 'king'
  | 'queen'
  | 'rook'
  | 'bishop'
  | 'knight'
  | 'pawn';

type Piece = {
  type: PieceType;
  color: Color;
};

type Square = {
  row: number;
  col: number;
};

type Move = {
  from: Square;
  to: Square;
  piece: Piece;
  captured?: Piece;
};

type Board = (Piece | null)[][];

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

const pieceGlyphs: Record<Color, Record<PieceType, string>> = {
  white: {
    king: '♔',
    queen: '♕',
    rook: '♖',
    bishop: '♗',
    knight: '♘',
    pawn: '♙',
  },
  black: {
    king: '♚',
    queen: '♛',
    rook: '♜',
    bishop: '♝',
    knight: '♞',
    pawn: '♟',
  },
};

const pieceValues: Record<PieceType, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 100,
};

function createInitialBoard(): Board {
  const board: Board = Array.from(
    { length: 8 },
    () => Array<Piece | null>(8).fill(null)
  );

  const backRank: PieceType[] = [
    'rook',
    'knight',
    'bishop',
    'queen',
    'king',
    'bishop',
    'knight',
    'rook',
  ];

  backRank.forEach((type, col) => {
    board[0][col] = { type, color: 'black' };
    board[1][col] = { type: 'pawn', color: 'black' };
    board[6][col] = { type: 'pawn', color: 'white' };
    board[7][col] = { type, color: 'white' };
  });

  return board;
}

function isInside(row: number, col: number) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function sameSquare(a: Square, b: Square) {
  return a.row === b.row && a.col === b.col;
}

function getMoves(board: Board, from: Square): Move[] {
  const piece = board[from.row][from.col];

  if (!piece) return [];

  const moves: Move[] = [];

  const add = (row: number, col: number) => {
    if (!isInside(row, col)) return false;

    const target = board[row][col];

    if (!target) {
      moves.push({
        from,
        to: { row, col },
        piece,
      });
    } else if (target.color !== piece.color) {
      moves.push({
        from,
        to: { row, col },
        piece,
        captured: target,
      });
    }

    return !target;
  };

  if (piece.type === 'pawn') {
    const direction = piece.color === 'white' ? -1 : 1;
    const startRow = piece.color === 'white' ? 6 : 1;

    if (
      isInside(from.row + direction, from.col) &&
      !board[from.row + direction][from.col]
    ) {
      moves.push({
        from,
        to: { row: from.row + direction, col: from.col },
        piece,
      });

      if (
        from.row === startRow &&
        !board[from.row + direction * 2][from.col]
      ) {
        moves.push({
          from,
          to: { row: from.row + direction * 2, col: from.col },
          piece,
        });
      }
    }

    [-1, 1].forEach((offset) => {
      const row = from.row + direction;
      const col = from.col + offset;

      if (
        isInside(row, col) &&
        board[row][col] &&
        board[row][col]?.color !== piece.color
      ) {
        moves.push({
          from,
          to: { row, col },
          piece,
          captured: board[row][col] ?? undefined,
        });
      }
    });
  }

  if (piece.type === 'knight') {
    [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ].forEach(([row, col]) => {
      add(from.row + row, from.col + col);
    });
  }

  if (piece.type === 'king') {
    for (let row = -1; row <= 1; row += 1) {
      for (let col = -1; col <= 1; col += 1) {
        if (row || col) {
          add(from.row + row, from.col + col);
        }
      }
    }
  }

  const directions =
    piece.type === 'rook'
      ? [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ]
      : piece.type === 'bishop'
        ? [
            [-1, -1],
            [-1, 1],
            [1, -1],
            [1, 1],
          ]
        : piece.type === 'queen'
          ? [
              [-1, 0],
              [1, 0],
              [0, -1],
              [0, 1],
              [-1, -1],
              [-1, 1],
              [1, -1],
              [1, 1],
            ]
          : [];

  directions.forEach(([row, col]) => {
    let nextRow = from.row + row;
    let nextCol = from.col + col;

    while (add(nextRow, nextCol)) {
      nextRow += row;
      nextCol += col;
    }
  });

  return moves;
}

function allMoves(board: Board, color: Color) {
  return board.flatMap((row, rowIndex) =>
    row.flatMap((piece, colIndex) =>
      piece?.color === color
        ? getMoves(board, { row: rowIndex, col: colIndex })
        : []
    )
  );
}

function applyMove(board: Board, move: Move): Board {
  const next = board.map((row) => [...row]);

  next[move.to.row][move.to.col] =
    move.piece.type === 'pawn' &&
    (move.to.row === 0 || move.to.row === 7)
      ? { type: 'queen', color: move.piece.color }
      : move.piece;

  next[move.from.row][move.from.col] = null;

  return next;
}

function App() {
  const [screen, setScreen] = useState<Screen>('loading');

  const [board, setBoard] = useState<Board>(() => createInitialBoard());
  const [turn, setTurn] = useState<Color>('white');
  const [selected, setSelected] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<Move | null>(null);

  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [gameMode, setGameMode] = useState<GameMode>('computer');
  const [playerChoice, setPlayerChoice] = useState<PlayerChoice>('white');
  const [playerColor, setPlayerColor] = useState<Color>('white');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const [captured, setCaptured] = useState<Piece[]>([]);
  const [winner, setWinner] = useState<Color | null>(null);

  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [gamesWon, setGamesWon] = useState(0);
  const [gamesLost, setGamesLost] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setScreen('setup');
    }, 2200);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    sound.setMuted(isMuted);
  }, [isMuted]);

  const computerColor: Color =
    playerColor === 'white' ? 'black' : 'white';

  const isComputerTurn =
    gameMode === 'computer' &&
    turn === computerColor &&
    !winner &&
    screen === 'game';

  const legalMoves = useMemo(
    () => (selected ? getMoves(board, selected) : []),
    [board, selected]
  );

  const currentMoves = useMemo(
    () => allMoves(board, turn),
    [board, turn]
  );

  const resetGame = () => {
    setBoard(createInitialBoard());
    setTurn('white');
    setSelected(null);
    setLastMove(null);
    setCaptured([]);
    setWinner(null);
  };

  const startGame = () => {
    const chosenColor: Color =
      playerChoice === 'random'
        ? Math.random() < 0.5
          ? 'white'
          : 'black'
        : playerChoice;

    setPlayerColor(chosenColor);
    setBoard(createInitialBoard());
    setTurn('white');
    setSelected(null);
    setLastMove(null);
    setCaptured([]);
    setWinner(null);

    setGamesPlayed((current) => current + 1);

    sound.resume();
    setScreen('game');
  };

  const makeMove = (move: Move) => {
    const nextBoard = applyMove(board, move);

    setBoard(nextBoard);
    setLastMove(move);
    setSelected(null);

    if (move.captured) {
      setCaptured((current) => [
        ...current,
        move.captured as Piece,
      ]);

      if (move.captured.type === 'king') {
        setWinner(move.piece.color);

        if (move.piece.color === playerColor) {
          setGamesWon((current) => current + 1);
        } else {
          setGamesLost((current) => current + 1);
        }

        sound.playWin();
      }
    }

    sound.playMove(move.piece.type, Boolean(move.captured));

    setTurn((current) =>
      current === 'white' ? 'black' : 'white'
    );
  };

  const chooseComputerMove = (): Move | undefined => {
    const moves = allMoves(board, computerColor);

    if (!moves.length) return undefined;

    const captures = moves.filter((move) => move.captured);

    if (difficulty === 'easy') {
      return moves[Math.floor(Math.random() * moves.length)];
    }

    if (difficulty === 'medium' && captures.length) {
      return captures[Math.floor(Math.random() * captures.length)];
    }

    return [...moves].sort(
      (a, b) =>
        pieceValues[b.captured?.type ?? 'pawn'] -
        pieceValues[a.captured?.type ?? 'pawn']
    )[0];
  };

  useEffect(() => {
    if (!isComputerTurn) return;

    const timeout = window.setTimeout(() => {
      const move = chooseComputerMove();

      if (move) makeMove(move);
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [isComputerTurn, board, difficulty, playerColor]);

  const handleSquareClick = (row: number, col: number) => {
    if (isComputerTurn || winner) return;

    const piece = board[row][col];
    const target = { row, col };

    if (selected) {
      const move = legalMoves.find((candidate) =>
        sameSquare(candidate.to, target)
      );

      if (move) return makeMove(move);

      if (piece?.color === turn) {
        return setSelected(target);
      }

      return setSelected(null);
    }

    if (piece?.color === turn) {
      setSelected(target);
      sound.playSelect();
    }
  };

  const status = winner
    ? `${winner === playerColor ? 'You' : 'Opponent'} won the match`
    : isComputerTurn
      ? 'Computer is thinking'
      : `${turn === playerColor ? 'Your' : 'Opponent'} turn`;

  const whiteCaptured = captured.filter(
    (piece) => piece.color === 'white'
  );

  const blackCaptured = captured.filter(
    (piece) => piece.color === 'black'
  );

  const flipped = playerColor === 'black';

  const displayBoard = board.map((row, rowIndex) =>
    row.map((piece, colIndex) => ({
      piece,
      row: flipped ? 7 - rowIndex : rowIndex,
      col: flipped ? 7 - colIndex : colIndex,
    }))
  );

  const returnToSetup = () => {
    setSelected(null);
    setScreen('setup');
  };

  // LOADING SCREEN

  if (screen === 'loading') {
    return (
      <main className="loading-screen">
        <div className="loading-content">
          <div className="loading-board-icon">
            <Crown size={48} strokeWidth={1.3} />
          </div>

          <p className="loading-brand-small">THE GOLDEN</p>
          <h1 className="loading-title">Chess Club</h1>

          <div className="loading-mini-board">
            {Array.from({ length: 16 }).map((_, index) => (
              <div
                key={index}
                className={
                  index % 2 === Math.floor(index / 4) % 2
                    ? 'mini-square mini-light'
                    : 'mini-square mini-dark'
                }
              >
                {index === 1
                  ? '♜'
                  : index === 2
                    ? '♞'
                    : index === 5
                      ? '♛'
                      : index === 6
                        ? '♚'
                        : ''}
              </div>
            ))}
          </div>

          <div className="loading-track">
            <div className="loading-progress" />
          </div>

          <p className="loading-message">
            INITIALIZING CHESS CLUB
          </p>
        </div>
      </main>
    );
  }

  // GAME SETUP

  if (screen === 'setup') {
    return (
      <main className="app-background min-h-screen">
        <div className="setup-container">
          <div className="setup-heading">
            <div className="setup-crown">
              <Crown size={32} />
            </div>

            <p className="gold-label">THE GOLDEN CHESS CLUB</p>

            <h1>Set Up Your Game</h1>

            <p>Choose your preferred match settings.</p>
          </div>

          <div className="setup-panel">
            <div className="setup-group">
              <label>GAME MODE</label>

              <div className="setup-grid two-columns">
                <button
                  className={`setup-choice ${
                    gameMode === 'computer' ? 'setup-selected' : ''
                  }`}
                  onClick={() => setGameMode('computer')}
                >
                  <Bot size={25} />
                  <b>Computer</b>
                  <small>Play against AI</small>
                </button>

                <button
                  className={`setup-choice ${
                    gameMode === 'two-player' ? 'setup-selected' : ''
                  }`}
                  onClick={() => setGameMode('two-player')}
                >
                  <Users size={25} />
                  <b>Two Players</b>
                  <small>Local multiplayer</small>
                </button>
              </div>
            </div>

            {gameMode === 'computer' && (
              <div className="setup-group">
                <label>DIFFICULTY LEVEL</label>

                <div className="setup-grid three-columns">
                  {(['easy', 'medium', 'hard'] as Difficulty[]).map(
                    (level, index) => (
                      <button
                        key={level}
                        className={`setup-choice ${
                          difficulty === level ? 'setup-selected' : ''
                        }`}
                        onClick={() => setDifficulty(level)}
                      >
                        <span className="difficulty-number">
                          0{index + 1}
                        </span>

                        <b>{level}</b>
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            <div className="setup-group">
              <label>CHOOSE YOUR COLOUR</label>

              <div className="setup-grid three-columns">
                {(['white', 'black', 'random'] as PlayerChoice[]).map(
                  (colour) => (
                    <button
                      key={colour}
                      className={`setup-choice colour-choice ${
                        playerChoice === colour ? 'setup-selected' : ''
                      }`}
                      onClick={() => setPlayerChoice(colour)}
                    >
                      <span className="colour-symbol">
                        {colour === 'white'
                          ? '♔'
                          : colour === 'black'
                            ? '♚'
                            : '⚄'}
                      </span>

                      <b>
                        {colour === 'random'
                          ? 'Random'
                          : colour}
                      </b>
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="setup-note">
              <Clock3 size={17} />
              <span>Standard match · No time limit</span>
            </div>

            <button
              className="start-game-button"
              onClick={startGame}
            >
              <Play size={19} fill="currentColor" />
              START GAME
              <ChevronRight size={19} />
            </button>
          </div>

          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="icon-button"
              aria-label="Toggle sound"
            >
              {isMuted ? (
                <VolumeX size={19} />
              ) : (
                <Volume2 size={19} />
              )}
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="icon-button"
              aria-label="Settings"
            >
              <Settings2 size={19} />
            </button>
          </div>
        </div>

        {isSettingsOpen && (
          <SettingsModal
            isMuted={isMuted}
            setIsMuted={setIsMuted}
            close={() => setIsSettingsOpen(false)}
            gameMode={gameMode}
            difficulty={difficulty}
          />
        )}
      </main>
    );
  }

  // CHESS GAME

  return (
    <main className="min-h-screen bg-[#090909] text-stone-100 selection:bg-[#d8ae54] selection:text-black">
      <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-8 lg:px-12 lg:py-10">
        <header className="mb-8 flex items-center justify-between border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#d8ae54] text-black">
              <Crown size={24} />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#d8ae54]">
                The golden
              </p>

              <h1 className="font-serif text-2xl tracking-tight text-white">
                Chess Club
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              aria-label="Toggle sound"
              onClick={() => setIsMuted(!isMuted)}
              className="icon-button"
            >
              {isMuted ? (
                <VolumeX size={18} />
              ) : (
                <Volume2 size={18} />
              )}
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-stone-300"
            >
              <Settings2 size={17} />

              <span className="hidden sm:inline">Settings</span>
            </button>

            <button
              onClick={returnToSetup}
              className="back-button"
            >
              <ArrowLeft size={17} />

              <span className="hidden sm:inline">Setup</span>
            </button>
          </div>
        </header>

        <div className="grid gap-8 xl:grid-cols-[minmax(520px,740px)_1fr] xl:items-start xl:gap-16">
          <section>
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="mb-1 text-xs uppercase tracking-[0.26em] text-[#d8ae54]">
                  Match in progress
                </p>

                <h2 className="font-serif text-3xl text-white sm:text-4xl">
                  Golden Hour
                </h2>
              </div>

              <span className="rounded-full border border-[#d8ae54]/30 bg-[#d8ae54]/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#e5c878]">
                {gameMode === 'computer' ? difficulty : '2 player'}
              </span>
            </div>

            <div className="chess-frame">
              <div className="board-shadow">
                <div className="chess-board-grid">
                  {displayBoard.flatMap((row, displayRow) =>
                    row.map(
                      ({ piece, row: actualRow, col: actualCol }, displayCol) => {
                        const square = {
                          row: actualRow,
                          col: actualCol,
                        };

                        const isLight =
                          (actualRow + actualCol) % 2 === 0;

                        const isSelected =
                          selected && sameSquare(selected, square);

                        const isTarget = legalMoves.some((move) =>
                          sameSquare(move.to, square)
                        );

                        const isLastFrom =
                          lastMove && sameSquare(lastMove.from, square);

                        const isLastTo =
                          lastMove && sameSquare(lastMove.to, square);

                        return (
                          <button
                            key={`${displayRow}-${displayCol}`}
                            aria-label={`${files[actualCol]}${8 - actualRow}`}
                            onClick={() =>
                              handleSquareClick(actualRow, actualCol)
                            }
                            className={`board-square
                              ${isLight ? 'board-light' : 'board-dark'}
                              ${isSelected ? 'selected-square' : ''}
                              ${isLastFrom ? 'last-from-square' : ''}
                              ${isLastTo ? 'last-to-square' : ''}
                            `}
                          >
                            {piece && (
                              <span
                                className={`piece ${
                                  piece.color === 'white'
                                    ? 'piece-gold'
                                    : 'piece-silver'
                                }`}
                              >
                                {pieceGlyphs[piece.color][piece.type]}
                              </span>
                            )}

                            {isTarget && (
                              <span
                                className={`move-dot ${
                                  piece ? 'capture-dot' : ''
                                }`}
                              />
                            )}

                            {displayCol === 0 && (
                              <span className="rank-label">
                                {8 - actualRow}
                              </span>
                            )}

                            {displayRow === 7 && (
                              <span className="file-label">
                                {files[actualCol]}
                              </span>
                            )}
                          </button>
                        );
                      }
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center gap-3">
                <span
                  className={`status-dot ${
                    winner
                      ? 'bg-[#d8ae54]'
                      : isComputerTurn
                        ? 'bg-stone-500'
                        : 'bg-emerald-400'
                  }`}
                />

                <div>
                  <p className="text-sm font-medium text-white">
                    {status}
                  </p>

                  <p className="text-xs text-stone-500">
                    {winner
                      ? 'Start a new game to play again'
                      : currentMoves.length
                        ? 'Make your next move'
                        : 'No legal moves available'}
                  </p>
                </div>
              </div>

              <button
                onClick={resetGame}
                className="flex items-center gap-2 text-sm text-stone-400 hover:text-[#e5c878]"
              >
                <RotateCcw size={16} />
                New game
              </button>
            </div>
          </section>

          <aside className="max-w-md xl:pt-14">
            <div className="mb-7">
              <p className="mb-2 text-xs uppercase tracking-[0.25em] text-stone-500">
                Your match
              </p>

              <h3 className="font-serif text-3xl text-white">
                Play your way.
              </h3>

              <p className="mt-3 max-w-sm text-sm leading-6 text-stone-400">
                Make your moves carefully and outsmart your opponent.
              </p>
            </div>

            <div className="space-y-5">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-widest text-stone-500">
                  Your colour
                </p>

                <p className="mt-2 font-serif text-xl text-[#e5c878]">
                  {playerColor === 'white' ? 'Gold' : 'Silver'}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-widest text-stone-500">
                  Opponent
                </p>

                <p className="mt-2 text-lg text-white">
                  {gameMode === 'computer'
                    ? `Computer · ${difficulty}`
                    : 'Two Players'}
                </p>
              </div>
            </div>

            <div className="my-8 h-px bg-white/10" />

            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.22em] text-stone-500">
                  Captured pieces
                </span>

                <span className="text-xs text-stone-600">
                  {captured.length} total
                </span>
              </div>

              <div className="min-h-10 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {blackCaptured.map((piece, index) => (
                    <span
                      key={`black-${index}`}
                      className="captured-piece piece-silver"
                    >
                      {pieceGlyphs[piece.color][piece.type]}
                    </span>
                  ))}

                  {whiteCaptured.map((piece, index) => (
                    <span
                      key={`white-${index}`}
                      className="captured-piece piece-gold"
                    >
                      {pieceGlyphs[piece.color][piece.type]}
                    </span>
                  ))}

                  {!captured.length && (
                    <span className="text-xs text-stone-600">
                      No captures yet
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-3 text-xs leading-5 text-stone-500">
              <Trophy size={17} className="shrink-0 text-[#d8ae54]" />
              Capture the king to win the match.
            </div>
          </aside>
        </div>
      </div>

      {isSettingsOpen && (
        <SettingsModal
          isMuted={isMuted}
          setIsMuted={setIsMuted}
          close={() => setIsSettingsOpen(false)}
          gameMode={gameMode}
          difficulty={difficulty}
        />
      )}
    </main>
  );
}

// SETTINGS MODAL

function SettingsModal({
  isMuted,
  setIsMuted,
  close,
  gameMode,
  difficulty,
}: {
  isMuted: boolean;
  setIsMuted: (value: boolean) => void;
  close: () => void;
  gameMode: GameMode;
  difficulty: Difficulty;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#d8ae54]/25 bg-[#121212] p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#d8ae54]">
              Preferences
            </p>

            <h2 className="mt-1 font-serif text-2xl text-white">
              Game settings
            </h2>
          </div>

          <button
            aria-label="Close settings"
            onClick={close}
            className="icon-button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <span>
              <span className="block text-sm font-medium text-white">
                Sound effects
              </span>

              <span className="text-xs text-stone-500">
                Play sounds during the game
              </span>
            </span>

            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`toggle ${!isMuted ? 'toggle-on' : ''}`}
              aria-label="Toggle sound effects"
            >
              <span />
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="mb-2 text-sm font-medium text-white">
              Current format
            </p>

            <p className="text-sm text-stone-400">
              {gameMode === 'computer'
                ? `You vs Computer · ${difficulty}`
                : 'Two players · Local match'}
            </p>
          </div>
        </div>

        <button
          onClick={close}
          className="mt-6 w-full rounded-lg bg-[#d8ae54] py-3 text-sm font-bold text-black hover:bg-[#e6c472]"
        >
          Done
        </button>
      </div>
    </div>
  );
}

export default App;
