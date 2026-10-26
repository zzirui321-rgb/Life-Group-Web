(() => {
  const map=document.querySelector('[data-dmd-reveal]');
  if(!map)return;
  const en=document.documentElement.lang.startsWith('en');
  const words=en?{next:'Reveal next group',guide:'Reveal step by step',done:'Picture complete',count:'Revealed'}:{next:'点亮下一组',guide:'逐步点亮',done:'图景已完整',count:'已点亮'};
  const notes=[...map.querySelectorAll('[data-note]')];
  const spots=[...map.querySelectorAll('[data-spot]')];
  const groups=[['wave','density','correlation','expectation'],['model','operator'],['band','topology','spectral','dynamics']];
  const opened=new Set();
  let preview=null;
  const guide=map.querySelector('[data-guide]');
  function paint(){
    notes.forEach(note=>{
      const id=note.dataset.note, retained=opened.has(id), showing=retained||preview===id;
      note.classList.toggle('is-open',retained);
      note.classList.toggle('is-preview',preview===id);
      note.querySelector('button').setAttribute('aria-expanded',String(retained));
      note.querySelector('.dmd-note-body').setAttribute('aria-hidden',String(!showing));
    });
    spots.forEach(spot=>{
      spot.setAttribute('aria-pressed',String(opened.has(spot.dataset.spot)));
      spot.classList.toggle('is-preview',preview===spot.dataset.spot);
    });
    map.querySelectorAll('[data-group]').forEach(button=>button.setAttribute('aria-pressed',String(groups[Number(button.dataset.group)].every(id=>opened.has(id)))));
    map.querySelector('.dmd-reveal-progress').textContent=words.count+' '+opened.size+' / 10';
    map.classList.toggle('is-complete',opened.size===notes.length);
    guide.textContent=opened.size===notes.length?words.done+' ✓':(opened.size?words.next:words.guide)+' →';
    guide.setAttribute('aria-disabled',String(opened.size===notes.length));
  }
  function reveal(ids){ids.forEach(id=>opened.add(id));preview=null;paint();}
  function bind(button,id){
    button.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch'){preview=id;paint();}});
    button.addEventListener('pointerleave',()=>{preview=null;paint();});
    button.addEventListener('focus',()=>{preview=id;paint();});
    button.addEventListener('blur',()=>{preview=null;paint();});
    button.addEventListener('click',()=>reveal([id]));
  }
  spots.forEach(spot=>bind(spot,spot.dataset.spot));
  map.querySelectorAll('[data-reveal]').forEach(button=>bind(button,button.dataset.reveal));
  map.querySelectorAll('[data-group]').forEach(button=>button.addEventListener('click',()=>reveal(groups[Number(button.dataset.group)])));
  guide.addEventListener('click',()=>{
    const next=groups.find(group=>group.some(id=>!opened.has(id)));
    if(next)reveal(next);
  });
  map.querySelector('[data-reveal-all]').addEventListener('click',()=>reveal(notes.map(note=>note.dataset.note)));
  map.querySelector('[data-reset]').addEventListener('click',()=>{opened.clear();preview=null;paint();});
  // Hover and Escape never remove revealed content. Only the explicit reset does.
  map.addEventListener('keydown',event=>{if(event.key==='Escape'){preview=null;paint();}});
  map.classList.add('is-ready');
  paint();
})();
