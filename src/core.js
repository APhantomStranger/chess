// Pure chess engine: board rep, move generation (legal), make-move, SAN, status.
// Verified via perft. No UI, no DOM. Safe to embed in the browser build.

const WK=0,WQ=1,BK=2,BQ=3; // castling right indices (unused constants kept for clarity)

function idx(r,c){return r*8+c;}
function rc(i){return [Math.floor(i/8), i%8];}
function onb(r,c){return r>=0&&r<8&&c>=0&&c<8;}
function opp(color){return color==='w'?'b':'w';}

// piece = {t:'p'|'n'|'b'|'r'|'q'|'k', c:'w'|'b', id?:number}

function initialBoard(){
  const b = new Array(64).fill(null);
  const back = ['r','n','b','q','k','b','n','r'];
  let id=0;
  for(let c=0;c<8;c++){ b[idx(0,c)]={t:back[c],c:'b',id:id++}; }
  for(let c=0;c<8;c++){ b[idx(1,c)]={t:'p',c:'b',id:id++}; }
  for(let c=0;c<8;c++){ b[idx(6,c)]={t:'p',c:'w',id:id++}; }
  for(let c=0;c<8;c++){ b[idx(7,c)]={t:back[c],c:'w',id:id++}; }
  return b;
}

function initialState(){
  return {
    board: initialBoard(),
    turn:'w',
    castling:{wk:true,wq:true,bk:true,bq:true},
    ep:-1,          // en-passant target square index (the empty square behind a double-pushed pawn), or -1
    half:0,         // halfmove clock for 50-move rule
    full:1,
  };
}

const KNIGHT_D=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const KING_D=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const ROOK_D=[[-1,0],[1,0],[0,-1],[0,1]];
const BISHOP_D=[[-1,-1],[-1,1],[1,-1],[1,1]];

function findKing(board,color){
  for(let i=0;i<64;i++){ const p=board[i]; if(p&&p.t==='k'&&p.c===color) return i; }
  return -1;
}

// Is square (r,c) attacked by any piece of the given 'by' color?
function isAttacked(board,r,c,by){
  // pawns
  if(by==='w'){
    // white pawns capture upward (toward row 0): a white pawn at (r+1,c-1)/(r+1,c+1) attacks (r,c)
    if(onb(r+1,c-1)){const p=board[idx(r+1,c-1)]; if(p&&p.c==='w'&&p.t==='p')return true;}
    if(onb(r+1,c+1)){const p=board[idx(r+1,c+1)]; if(p&&p.c==='w'&&p.t==='p')return true;}
  } else {
    if(onb(r-1,c-1)){const p=board[idx(r-1,c-1)]; if(p&&p.c==='b'&&p.t==='p')return true;}
    if(onb(r-1,c+1)){const p=board[idx(r-1,c+1)]; if(p&&p.c==='b'&&p.t==='p')return true;}
  }
  // knights
  for(const [dr,dc] of KNIGHT_D){ const rr=r+dr,cc=c+dc; if(onb(rr,cc)){const p=board[idx(rr,cc)]; if(p&&p.c===by&&p.t==='n')return true;} }
  // king
  for(const [dr,dc] of KING_D){ const rr=r+dr,cc=c+dc; if(onb(rr,cc)){const p=board[idx(rr,cc)]; if(p&&p.c===by&&p.t==='k')return true;} }
  // rook/queen (orthogonal)
  for(const [dr,dc] of ROOK_D){ let rr=r+dr,cc=c+dc; while(onb(rr,cc)){const p=board[idx(rr,cc)]; if(p){ if(p.c===by&&(p.t==='r'||p.t==='q'))return true; break;} rr+=dr;cc+=dc;} }
  // bishop/queen (diagonal)
  for(const [dr,dc] of BISHOP_D){ let rr=r+dr,cc=c+dc; while(onb(rr,cc)){const p=board[idx(rr,cc)]; if(p){ if(p.c===by&&(p.t==='b'||p.t==='q'))return true; break;} rr+=dr;cc+=dc;} }
  return false;
}

function inCheck(state,color){
  const k=findKing(state.board,color);
  if(k<0) return false;
  const [r,c]=rc(k);
  return isAttacked(state.board,r,c,opp(color));
}

// Generate pseudo-legal moves for side to move (does not filter self-check).
function pseudoMoves(state){
  const board=state.board, turn=state.turn, moves=[];
  const dir = turn==='w'?-1:1;         // pawn forward row delta
  const startRow = turn==='w'?6:1;
  const promoRow = turn==='w'?0:7;

  const add=(from,to,extra)=>{ moves.push(Object.assign({from,to,color:turn},extra)); };

  for(let i=0;i<64;i++){
    const p=board[i]; if(!p||p.c!==turn) continue;
    const [r,c]=rc(i);
    if(p.t==='p'){
      // forward one
      const r1=r+dir;
      if(onb(r1,c)&&!board[idx(r1,c)]){
        if(r1===promoRow){ for(const pr of ['q','r','b','n']) add(i,idx(r1,c),{piece:'p',captured:null,capIdx:-1,promo:pr,flag:'promo'}); }
        else add(i,idx(r1,c),{piece:'p',captured:null,capIdx:-1,promo:null,flag:'normal'});
        // forward two
        const r2=r+2*dir;
        if(r===startRow && !board[idx(r2,c)]) add(i,idx(r2,c),{piece:'p',captured:null,capIdx:-1,promo:null,flag:'double'});
      }
      // captures
      for(const dc of [-1,1]){
        const cc=c+dc, rr=r+dir;
        if(!onb(rr,cc)) continue;
        const t=idx(rr,cc), tp=board[t];
        if(tp&&tp.c!==turn){
          if(rr===promoRow){ for(const pr of ['q','r','b','n']) add(i,t,{piece:'p',captured:tp,capIdx:t,promo:pr,flag:'promo'}); }
          else add(i,t,{piece:'p',captured:tp,capIdx:t,promo:null,flag:'normal'});
        } else if(!tp && t===state.ep){
          // en passant: captured pawn is on the moving pawn's row, at target column
          const capIdx=idx(r,cc);
          add(i,t,{piece:'p',captured:board[capIdx],capIdx,promo:null,flag:'ep'});
        }
      }
    } else if(p.t==='n'){
      for(const [dr,dc] of KNIGHT_D){ const rr=r+dr,cc=c+dc; if(!onb(rr,cc))continue; const t=idx(rr,cc),tp=board[t]; if(!tp) add(i,t,{piece:'n',captured:null,capIdx:-1,promo:null,flag:'normal'}); else if(tp.c!==turn) add(i,t,{piece:'n',captured:tp,capIdx:t,promo:null,flag:'normal'}); }
    } else if(p.t==='k'){
      for(const [dr,dc] of KING_D){ const rr=r+dr,cc=c+dc; if(!onb(rr,cc))continue; const t=idx(rr,cc),tp=board[t]; if(!tp) add(i,t,{piece:'k',captured:null,capIdx:-1,promo:null,flag:'normal'}); else if(tp.c!==turn) add(i,t,{piece:'k',captured:tp,capIdx:t,promo:null,flag:'normal'}); }
      // castling
      const rights=state.castling;
      const homeRow = turn==='w'?7:0;
      if(r===homeRow && c===4){
        const enemy=opp(turn);
        const canK = turn==='w'?rights.wk:rights.bk;
        const canQ = turn==='w'?rights.wq:rights.bq;
        // king side: squares f,g empty; e,f,g not attacked; rook on h
        if(canK){
          const rook=board[idx(homeRow,7)];
          if(rook&&rook.t==='r'&&rook.c===turn && !board[idx(homeRow,5)] && !board[idx(homeRow,6)]){
            if(!isAttacked(board,homeRow,4,enemy)&&!isAttacked(board,homeRow,5,enemy)&&!isAttacked(board,homeRow,6,enemy)){
              add(i,idx(homeRow,6),{piece:'k',captured:null,capIdx:-1,promo:null,flag:'castleK'});
            }
          }
        }
        if(canQ){
          const rook=board[idx(homeRow,0)];
          if(rook&&rook.t==='r'&&rook.c===turn && !board[idx(homeRow,1)] && !board[idx(homeRow,2)] && !board[idx(homeRow,3)]){
            if(!isAttacked(board,homeRow,4,enemy)&&!isAttacked(board,homeRow,3,enemy)&&!isAttacked(board,homeRow,2,enemy)){
              add(i,idx(homeRow,2),{piece:'k',captured:null,capIdx:-1,promo:null,flag:'castleQ'});
            }
          }
        }
      }
    } else {
      // sliders: b, r, q
      const dirs = p.t==='b'?BISHOP_D : p.t==='r'?ROOK_D : ROOK_D.concat(BISHOP_D);
      for(const [dr,dc] of dirs){
        let rr=r+dr,cc=c+dc;
        while(onb(rr,cc)){
          const t=idx(rr,cc),tp=board[t];
          if(!tp){ add(i,t,{piece:p.t,captured:null,capIdx:-1,promo:null,flag:'normal'}); }
          else { if(tp.c!==turn) add(i,t,{piece:p.t,captured:tp,capIdx:t,promo:null,flag:'normal'}); break; }
          rr+=dr;cc+=dc;
        }
      }
    }
  }
  return moves;
}

// Apply a move, returning a NEW state (board array copied; piece objects shared/immutable).
function makeMove(state,m){
  const board=state.board.slice();
  const turn=state.turn;
  const moving=board[m.from];
  // remove captured (handles en passant where capIdx != to)
  if(m.capIdx>=0) board[m.capIdx]=null;
  board[m.from]=null;
  // place piece (promotion keeps id)
  if(m.promo){ board[m.to]={t:m.promo,c:turn,id:moving.id}; }
  else board[m.to]=moving;
  // rook move for castling
  const homeRow=turn==='w'?7:0;
  if(m.flag==='castleK'){ const rk=board[idx(homeRow,7)]; board[idx(homeRow,7)]=null; board[idx(homeRow,5)]=rk; }
  if(m.flag==='castleQ'){ const rk=board[idx(homeRow,0)]; board[idx(homeRow,0)]=null; board[idx(homeRow,3)]=rk; }

  // castling rights update
  const cast={...state.castling};
  if(moving.t==='k'){ if(turn==='w'){cast.wk=false;cast.wq=false;} else {cast.bk=false;cast.bq=false;} }
  if(moving.t==='r'){
    if(m.from===idx(7,7))cast.wk=false;
    if(m.from===idx(7,0))cast.wq=false;
    if(m.from===idx(0,7))cast.bk=false;
    if(m.from===idx(0,0))cast.bq=false;
  }
  // if a rook was captured on its home square, remove that right
  if(m.to===idx(7,7))cast.wk=false;
  if(m.to===idx(7,0))cast.wq=false;
  if(m.to===idx(0,7))cast.bk=false;
  if(m.to===idx(0,0))cast.bq=false;

  // en passant target (the square the pawn passed over)
  let ep=-1;
  if(m.flag==='double'){ const [fr,fc]=rc(m.from); const mid=fr + (turn==='w'?-1:1); ep=idx(mid,fc); }

  const half = (moving.t==='p'||m.capIdx>=0) ? 0 : state.half+1;
  const full = turn==='b' ? state.full+1 : state.full;

  return { board, turn:opp(turn), castling:cast, ep, half, full };
}

// Legal moves: filter pseudo-legal that leave own king in check.
function legalMoves(state){
  const pl=pseudoMoves(state);
  const out=[];
  for(const m of pl){
    const ns=makeMove(state,m);
    if(!inCheck({board:ns.board,turn:state.turn}, state.turn)) out.push(m);
  }
  return out;
}

// ---- SAN ----
function sqName(i){ const [r,c]=rc(i); return 'abcdefgh'[c] + (8-r); }
function moveToSAN(state,m){
  if(m.flag==='castleK') return addCheck(state,m,'O-O');
  if(m.flag==='castleQ') return addCheck(state,m,'O-O-O');
  const pieceLetter = m.piece==='p' ? '' : m.piece.toUpperCase();
  const isCap = m.capIdx>=0;
  let s='';
  if(m.piece==='p'){
    if(isCap) s += 'abcdefgh'[rc(m.from)[1]] + 'x';
    s += sqName(m.to);
    if(m.promo) s += '=' + m.promo.toUpperCase();
  } else {
    s += pieceLetter;
    // disambiguation
    const others = legalMoves(state).filter(x=>x.piece===m.piece && x.to===m.to && x.from!==m.from);
    if(others.length){
      const [fr,fc]=rc(m.from);
      const sameFile = others.some(o=>rc(o.from)[1]===fc);
      const sameRank = others.some(o=>rc(o.from)[0]===fr);
      if(!sameFile) s += 'abcdefgh'[fc];
      else if(!sameRank) s += (8-fr);
      else s += 'abcdefgh'[fc] + (8-fr);
    }
    if(isCap) s += 'x';
    s += sqName(m.to);
  }
  return addCheck(state,m,s);
}
function addCheck(state,m,s){
  const ns=makeMove(state,m);
  const enemy=ns.turn;
  if(inCheck(ns,enemy)){
    const enemyMoves=legalMoves(ns);
    s += enemyMoves.length? '+' : '#';
  }
  return s;
}

// ---- status ----
function gameStatus(state){
  const moves=legalMoves(state);
  const chk=inCheck(state,state.turn);
  if(moves.length===0){
    return chk ? {type:'checkmate', winner:opp(state.turn)} : {type:'stalemate'};
  }
  if(state.half>=100) return {type:'draw', reason:'fifty-move rule'};
  if(insufficientMaterial(state.board)) return {type:'draw', reason:'insufficient material'};
  return chk ? {type:'check'} : {type:'playing'};
}
function insufficientMaterial(board){
  const pieces=[];
  for(const p of board) if(p&&p.t!=='k') pieces.push(p);
  if(pieces.length===0) return true;                       // K vs K
  if(pieces.length===1) return (pieces[0].t==='n'||pieces[0].t==='b'); // K+minor vs K
  if(pieces.length===2){
    // K+B vs K+B, same colored bishops
    if(pieces.every(p=>p.t==='b')){
      const sq=[];
      for(let i=0;i<64;i++){const p=board[i]; if(p&&p.t==='b'){const[r,c]=rc(i); sq.push((r+c)%2);}}
      if(sq.length===2 && sq[0]===sq[1] && pieces[0].c!==pieces[1].c) return true;
    }
  }
  return false;
}

// ---- FEN (parse only; used for tests) ----
function parseFEN(fen){
  const [pos,turn,cast,ep] = fen.split(' ');
  const board=new Array(64).fill(null);
  const rows=pos.split('/');
  let id=0;
  for(let r=0;r<8;r++){
    let c=0;
    for(const ch of rows[r]){
      if(/\d/.test(ch)){ c+=parseInt(ch); }
      else { const color = ch===ch.toUpperCase()?'w':'b'; board[idx(r,c)]={t:ch.toLowerCase(),c:color,id:id++}; c++; }
    }
  }
  const castling={wk:cast.includes('K'),wq:cast.includes('Q'),bk:cast.includes('k'),bq:cast.includes('q')};
  let epIdx=-1;
  if(ep&&ep!=='-'){ const file='abcdefgh'.indexOf(ep[0]); const rank=8-parseInt(ep[1]); epIdx=idx(rank,file); }
  return { board, turn:turn==='w'?'w':'b', castling, ep:epIdx, half:0, full:1 };
}



const VAL = {p:100,n:320,b:330,r:500,q:900,k:20000};
const MATE = 1000000;
const PST = {
  p:[0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  n:[-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  b:[-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  r:[0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  q:[-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  kmg:[-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
  keg:[-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50],
};
const mirror = i => (7-((i/8)|0))*8 + (i&7);

function evalWhite(board){
  let score=0, nonPawn=0;
  for(let i=0;i<64;i++){ const p=board[i]; if(!p)continue; score += p.c==='w'?VAL[p.t]:-VAL[p.t]; if(p.t!=='p'&&p.t!=='k') nonPawn+=VAL[p.t]; }
  const eg = nonPawn <= 2*VAL.r;
  for(let i=0;i<64;i++){ const p=board[i]; if(!p)continue; const t=p.t==='k'?(eg?PST.keg:PST.kmg):PST[p.t]; if(p.c==='w') score+=t[i]; else score-=t[mirror(i)]; }
  return score;
}
const evalRel = st => evalWhite(st.board)*(st.turn==='w'?1:-1);
function ordScore(m){ let s=0; if(m.capIdx>=0)s+=10*VAL[m.captured.t]-VAL[m.piece]; if(m.promo)s+=VAL[m.promo]; return s; }

let NODES=0;
function legalKids(st){
  // returns pseudo moves ordered; caller filters legality lazily
  return pseudoMoves(st).sort((a,b)=>ordScore(b)-ordScore(a));
}
function kingSafe(ns, moverColor, moverKingSq){
  const [r,c]=rc(moverKingSq);
  return !isAttacked(ns.board, r, c, moverColor==='w'?'b':'w');
}
function quiesce(st, alpha, beta, qd){
  NODES++;
  let stand=evalRel(st);
  if(stand>=beta) return beta;
  if(stand>alpha) alpha=stand;
  if(qd<=0) return alpha;
  const kSqBase=findKing(st.board, st.turn);
  const caps = pseudoMoves(st).filter(m=>m.capIdx>=0||m.promo).sort((a,b)=>ordScore(b)-ordScore(a));
  for(const m of caps){
    const ns=makeMove(st,m);
    const kSq = m.piece==='k'? m.to : kSqBase;
    if(!kingSafe(ns, st.turn, kSq)) continue;
    const sc=-quiesce(ns,-beta,-alpha,qd-1);
    if(sc>=beta) return beta;
    if(sc>alpha) alpha=sc;
  }
  return alpha;
}
function nega(st, depth, alpha, beta, useQ, deadline){
  NODES++;
  if(deadline && (NODES&2047)===0 && Date.now()>deadline) throw 'timeout';
  if(depth===0) return useQ? quiesce(st,alpha,beta,6) : evalRel(st);
  const kSqBase=findKing(st.board, st.turn);
  const moves=legalKids(st);
  let best=-Infinity, any=false;
  for(const m of moves){
    const ns=makeMove(st,m);
    const kSq = m.piece==='k'? m.to : kSqBase;
    if(!kingSafe(ns, st.turn, kSq)) continue;
    any=true;
    const sc=-nega(ns, depth-1, -beta, -alpha, useQ, deadline);
    if(sc>best) best=sc;
    if(best>alpha) alpha=best;
    if(alpha>=beta) break;
  }
  if(!any){ const [r,c]=rc(kSqBase); return isAttacked(st.board,r,c,st.turn==='w'?'b':'w') ? -MATE+(100-depth) : 0; }
  return best;
}
function searchRoot(st, depth, useQ, deadline){
  const kSqBase=findKing(st.board, st.turn);
  const moves=legalKids(st);
  let best=null, bestScore=-Infinity, alpha=-Infinity;
  for(const m of moves){
    const ns=makeMove(st,m);
    const kSq = m.piece==='k'? m.to : kSqBase;
    if(!kingSafe(ns, st.turn, kSq)) continue;
    const sc=-nega(ns, depth-1, -Infinity, -alpha, useQ, deadline);
    if(sc>bestScore){ bestScore=sc; best=m; }
    if(sc>alpha) alpha=sc;
  }
  return {move:best, score:bestScore};
}



// ---- difficulty / move selection ----
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
function rootMovesLegal(st){
  const kSqBase=findKing(st.board, st.turn); const res=[];
  for(const m of pseudoMoves(st)){ const ns=makeMove(st,m); const kSq=m.piece==='k'?m.to:kSqBase; if(kingSafe(ns,st.turn,kSq)) res.push(m); }
  return res;
}
function scoredRootFull(st, depth, useQ, deadline){
  const kSqBase=findKing(st.board, st.turn);
  const moves=pseudoMoves(st).sort((a,b)=>ordScore(b)-ordScore(a));
  const out=[];
  for(const m of moves){ const ns=makeMove(st,m); const kSq=m.piece==='k'?m.to:kSqBase; if(!kingSafe(ns,st.turn,kSq))continue; const sc=-nega(ns,depth-1,-Infinity,Infinity,useQ,deadline); out.push({move:m,score:sc}); }
  return out;
}
function bestByAlphaBeta(st, depth, useQ, deadline){
  const kSqBase=findKing(st.board, st.turn);
  let moves=pseudoMoves(st); shuffle(moves); moves.sort((a,b)=>ordScore(b)-ordScore(a)); // stable sort keeps shuffle among ties
  let best=null,bestScore=-Infinity,alpha=-Infinity;
  for(const m of moves){ const ns=makeMove(st,m); const kSq=m.piece==='k'?m.to:kSqBase; if(!kingSafe(ns,st.turn,kSq))continue; const sc=-nega(ns,depth-1,-Infinity,-alpha,useQ,deadline); if(sc>bestScore){bestScore=sc;best=m;} if(sc>alpha)alpha=sc; }
  return {move:best,score:bestScore};
}
function iterativeBest(st, maxDepth, budgetMs){
  const deadline=Date.now()+budgetMs; let best=null;
  for(let d=1; d<=maxDepth; d++){
    try{ const r=bestByAlphaBeta(st, d, true, deadline); if(r.move) best=r; }
    catch(e){ break; }
    if(Date.now()>deadline) break;
  }
  if(!best){ const lm=rootMovesLegal(st); best={move:lm[(Math.random()*lm.length)|0],score:0}; }
  return best;
}
var LEVELS = {
  1:{name:'Beginner',depth:1,useQ:false,blunder:0.60,margin:300,mode:'full'},
  2:{name:'Easy',depth:2,useQ:false,blunder:0.30,margin:120,mode:'full'},
  3:{name:'Casual',depth:2,useQ:true,blunder:0.10,margin:60,mode:'full'},
  4:{name:'Intermediate',depth:3,useQ:true,blunder:0.0,margin:25,mode:'full'},
  5:{name:'Advanced',depth:4,useQ:true,blunder:0.0,margin:0,mode:'ab'},
  6:{name:'Expert',depth:6,useQ:true,blunder:0.0,margin:0,mode:'id',budget:2400}
};
function chooseMove(st, level){
  const cfg=LEVELS[level]||LEVELS[3];
  const legal=rootMovesLegal(st);
  if(legal.length===0) return null;
  if(legal.length===1) return legal[0];
  if(cfg.blunder>0 && Math.random()<cfg.blunder) return legal[(Math.random()*legal.length)|0];
  if(cfg.mode==='id') return iterativeBest(st, cfg.depth, cfg.budget).move;
  if(cfg.mode==='ab' && cfg.margin===0) return bestByAlphaBeta(st, cfg.depth, cfg.useQ, 0).move;
  const scored=scoredRootFull(st, cfg.depth, cfg.useQ, 0);
  let best=-Infinity; for(const s of scored) if(s.score>best) best=s.score;
  const cands=scored.filter(s=>s.score>=best-cfg.margin);
  return cands[(Math.random()*cands.length)|0].move;
}
function hintMove(st){ return bestByAlphaBeta(st, 3, true, Date.now()+1500).move; }
