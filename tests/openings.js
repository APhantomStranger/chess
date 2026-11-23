const fs=require('fs');
const core=fs.readFileSync('src/core.js','utf8');
const EX={};
new Function('EX',core+`;EX.initialState=initialState;EX.legalMoves=legalMoves;EX.makeMove=makeMove;EX.moveToSAN=moveToSAN;EX.gameStatus=gameStatus;`)(EX);
const shell=fs.readFileSync('src/shell.html','utf8');
const blk=shell.match(/const OPENINGS = \[([\s\S]*?)\n\];/)[1];
const OPS=eval('['+blk+']');
const key=x=>x.replace(/[+#!?]/g,'');
let bad=0;
for(const o of OPS){
  let st=EX.initialState(); const toks=o.line.split(' ');
  for(let i=0;i<toks.length;i++){
    const m=EX.legalMoves(st).find(m=>key(EX.moveToSAN(st,m))===toks[i]);
    if(!m){
      const legal=EX.legalMoves(st).map(m=>key(EX.moveToSAN(st,m)));
      console.log('FAIL',o.name,'ply',i+1,'token',toks[i],'| legal sample:',legal.slice(0,14).join(' '));
      bad++;break;
    }
    st=EX.makeMove(st,m);
  }
  const userMoves=toks.filter((_,i)=>(o.side==='w')===(i%2===0)).length;
  if(!bad) console.log(`  ok   ${o.name.padEnd(24)} ${toks.length} plies, ${userMoves} of your moves  [${o.eco}]`);
  for(const f of ['history','when','idea','eco']) if(!o[f]||o[f].length<3){console.log('MISSINGFIELD',o.name,f);bad++;}
}
console.log(OPS.length,'openings | failures:',bad,'| white',OPS.filter(o=>o.side==='w').length,'black',OPS.filter(o=>o.side==='b').length);
process.exit(bad?1:0);
