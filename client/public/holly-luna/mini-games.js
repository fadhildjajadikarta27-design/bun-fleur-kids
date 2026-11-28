/* Independent educational mini games. No purchase, game coin mutation or competition scoring. */
(() => {
 "use strict";
 const dlg=$("mini-dialog"), content=$("mini-content"), opener=$("mini-open");
 const games=[
  {id:"memory",name:"Memory Garden",desc:"Cari pasangan kartu tanaman yang sama.",crop:"stroberi"},
  {id:"count",name:"Hitung Panen",desc:"Hitung buah dan sayur dalam keranjang.",crop:"wortel"},
  {id:"sort",name:"Pilah Hasil Kebun",desc:"Pilih keranjang yang sesuai dengan hasil panen.",crop:"matahari"},
  {id:"pattern",name:"Pola Kebun",desc:"Tebak tanaman atau bentuk berikutnya.",crop:"stroberi"},
  {id:"maze",name:"Kurir Desa",desc:"Antar Holly atau Luna melalui jalan ke kios.",crop:"wortel"}
 ];
 let current=null,difficulty=0,round=0,deck=[],opened=[],matched=[],pathPosition=0,visited=[],finished=false;
 const friend=()=>who==="Holly"?SVG_HOLLY:SVG_LUNA;
 const icons=["wortel","stroberi","matahari","tunas","tumbuh"];
 const iconNames={wortel:"Wortel",stroberi:"Stroberi",matahari:"Bunga matahari",tunas:"Tunas",tumbuh:"Tanaman tumbuh"};
 const shuffle=arr=>{const result=[...arr];for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result};
 const feedback=t=>{const el=$("mini-feedback");if(el)el.textContent=t};
 const announce=()=>{try{bunyi("lembut")}catch{}};
 const setFocus=(selector)=>content.querySelector(selector)?.focus({preventScroll:true});
 function menu(){
  current=null;finished=false;
  content.innerHTML='<p class="muted" style="margin-bottom:14px">Pilih permainan yang kamu suka. Semua bisa dimainkan tanpa batas kategori umur.</p><div class="mini-list">'+games.map(g=>'<button type="button" class="mini-card" data-mini-game="'+g.id+'">'+icon(g.crop)+'<strong>'+g.name+'</strong><span>'+g.desc+'</span></button>').join("")+'</div>';
  content.querySelectorAll("[data-mini-game]").forEach(b=>b.onclick=()=>{current=games.find(g=>g.id===b.dataset.miniGame);difficulty=0;reset();render();setFocus("[data-mini-level]")});
 }
 function reset(){round=0;finished=false;opened=[];matched=[];pathPosition=0;visited=[0];deck=shuffle(icons.slice(0,3+difficulty).flatMap(k=>[k,k]));}
 function header(){
  return '<div class="mini-row"><button type="button" id="mini-menu">← Semua permainan</button><strong>'+current.name+'</strong></div><div class="mini-levels" role="group" aria-label="Tingkat kesulitan">'+["Mudah","Menengah","Lanjut"].map((l,i)=>'<button type="button" data-mini-level="'+i+'" aria-pressed="'+(i===difficulty)+'">'+l+'</button>').join("")+'</div>';
 }
 function bindHeader(){
  $("mini-menu").onclick=()=>{menu();setFocus("[data-mini-game]")};
  content.querySelectorAll("[data-mini-level]").forEach(b=>b.onclick=()=>{difficulty=Number(b.dataset.miniLevel);reset();render();setFocus('[data-mini-level="'+difficulty+'"]')});
 }
 function finish(){
  finished=true;content.innerHTML=header()+'<div class="mini-finish">'+friend()+'<h3>Hebat, selesai!</h3><p>Kamu berhasil menyelesaikan '+current.name+'. Kamu boleh kembali ke desa atau mencoba lagi.</p><button class="primary" id="mini-again">Main lagi</button></div>';
  bindHeader();$("mini-again").onclick=()=>{reset();render();setFocus(".mini-choice, .mini-path button:not(:disabled)")};announce();setFocus("#mini-again");
 }
 const questions=()=>3+difficulty;
 function advance(){announce();round++;if(round>=questions())finish();else {render();setFocus(".mini-choice")}}
 function chooseCard(k){return '<button type="button" class="mini-choice" data-answer="'+k+'">'+icon(k)+'<span>'+iconNames[k]+'</span></button>'}
 function render(){
  if(finished)return;
  content.innerHTML=header()+'<div id="mini-board"></div><p class="mini-message" id="mini-feedback" role="status" aria-live="polite"></p>';
  bindHeader();const board=$("mini-board");
  if(current.id==="memory"){
   const pairs=matched.length/2;
   board.innerHTML='<div class="mini-question"><h3>Temukan pasangan</h3><p>'+pairs+' / '+deck.length/2+' pasangan</p></div><div class="mini-choices mini-memory" style="--columns:'+(difficulty===0?3: difficulty===1?4:5)+'">'+deck.map((k,i)=>{const shown=opened.includes(i)||matched.includes(i);return '<button type="button" class="mini-choice" data-card="'+i+'" aria-label="Kartu '+(i+1)+(shown?", "+iconNames[k]:" tertutup")+'" '+(matched.includes(i)?"disabled":"")+'>'+(shown?icon(k):"?")+'</button>'}).join("")+'</div>';
   board.querySelectorAll("[data-card]").forEach(b=>b.onclick=()=>{
    const i=Number(b.dataset.card);if(matched.includes(i)||opened.includes(i))return;
    if(opened.length===2)opened=[];
    opened.push(i);
    if(opened.length===2&&deck[opened[0]]===deck[opened[1]]){matched.push(...opened);opened=[];if(matched.length===deck.length){finish();return}render();feedback("Pasangan cocok!");announce();setFocus(".mini-choice:not(:disabled)");}
    else {const two=opened.length===2;render();if(two)feedback("Belum cocok. Coba kartu lain.");setFocus('[data-card="'+i+'"]')}
   });return;
  }
  if(current.id==="maze"){
   const size=3+difficulty,goal=size*size-1;
   // Even rows are corridors, odd rows connect adjacent corridors at alternating ends.
   const allowed=i=>Math.floor(i/size)%2===0||i%size===(Math.floor(i/size)%4===1?size-1:0)||(i===goal);
   // For the 4x4 route, the goal is bottom left; keep the bottom corridor connected.
   const end=size%2===0?size*(size-1):goal;
   board.innerHTML='<div class="mini-question"><h3>Antar '+who+' ke kios</h3><p>Ketuk petak jalan yang bersebelahan.</p></div><div class="mini-path" style="--columns:'+size+'">'+Array.from({length:size*size},(_,i)=>{const open=allowed(i)||i===end;return '<button type="button" data-path="'+i+'" aria-label="'+(i===pathPosition?"Karakter":i===end?"Kios":open?"Jalan":"Rumput")+' '+(i+1)+'" class="'+(!open?"mini-wall":visited.includes(i)?"mini-visited":"")+'" '+(!open?"disabled":"")+'>'+(i===pathPosition?friend():i===end?"⌂":"")+'</button>'}).join("")+'</div>';
   board.querySelectorAll("[data-path]:not(:disabled)").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.path);if(Math.abs(Math.floor(i/size)-Math.floor(pathPosition/size))+Math.abs(i%size-pathPosition%size)!==1){feedback("Pilih jalan yang dekat dengan karakter.");return}pathPosition=i;visited.push(i);if(i===end)finish();else{render();setFocus('[data-path="'+i+'"]')}});return;
  }
  const progress='<p class="muted">Soal '+(round+1)+' / '+questions()+'</p>';
  if(current.id==="count"){
   const n=1+((round*2+difficulty*3)%(4+difficulty*3)), crop=icons[round%3],answer=String(n);
   const choices=shuffle([n,n===1?2:n-1,n+2]);
   board.innerHTML='<div class="mini-question">'+progress+'<h3>Ada berapa '+iconNames[crop].toLowerCase()+'?</h3><div class="mini-objects">'+Array.from({length:n},()=>icon(crop)).join("")+'</div></div><div class="mini-choices">'+choices.map(x=>'<button class="mini-choice" data-answer="'+x+'">'+x+'</button>').join("")+'</div>';
   bindAnswers(board,answer);return;
  }
  if(current.id==="sort"){
   const pool=icons.slice(0,3+difficulty),crop=pool[(round+difficulty)%pool.length];
   const choices=shuffle([crop,...shuffle(pool.filter(k=>k!==crop)).slice(0,2)]);
   board.innerHTML='<div class="mini-question">'+progress+'<h3>Masukkan hasil kebun ke keranjang yang sesuai</h3><div class="mini-objects">'+icon(crop)+'</div></div><div class="mini-choices">'+choices.map(chooseCard).join("")+'</div>';
   bindAnswers(board,crop);return;
  }
  if(current.id==="pattern"){
   const pool=icons.slice(0,3),a=pool[round%3],b=pool[(round+1)%3],c=pool[(round+2)%3],unit=difficulty===0?[a,b]:difficulty===1?[a,a,b]:[a,b,c];
   const len=unit.length*2-1,answer=unit[len%unit.length],seq=Array.from({length:len},(_,i)=>unit[i%unit.length]);
   board.innerHTML='<div class="mini-question">'+progress+'<h3>Tanaman apa berikutnya?</h3><div class="mini-objects" aria-label="'+seq.map(k=>iconNames[k]).join(", ")+', berikutnya apa?">'+seq.map(icon).join("")+'<span class="mini-pattern">?</span></div></div><div class="mini-choices">'+shuffle(pool).map(chooseCard).join("")+'</div>';
   bindAnswers(board,answer);
  }
 }
 function bindAnswers(board,answer){board.querySelectorAll("[data-answer]").forEach(b=>b.onclick=()=>{if(b.dataset.answer===answer)advance();else feedback("Coba lagi, tidak apa-apa.")})}
 opener.onclick=()=>{if(!active||!account)return;held.clear();route=[];pending=null;$("destination").innerHTML="";$("mini-friend").innerHTML=friend();menu();dlg.showModal();setFocus("[data-mini-game]")};
 $("mini-close").onclick=()=>dlg.close();
 dlg.addEventListener("close",()=>{held.clear();current=null;deck=[];opener.focus({preventScroll:true})});
})();