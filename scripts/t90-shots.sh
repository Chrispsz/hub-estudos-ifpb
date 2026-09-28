#!/bin/bash
# Task 90 — screenshots da faixa (véspera dark/light + simulado-hoje mobile)
set -u
cd /home/z/my-project
STORE='hub-estudos-ifpb:v2'

agent-browser close 2>/dev/null || true
sleep 1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
sleep 2

# semear 3 cartões MAT + mock véspera + poke
agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.flashcards=p.flashcards||[];var now=new Date().toISOString();for(var i=1;i<=3;i++){p.flashcards.push({id:'qa90-fc-'+i,disciplineCode:'TEC.1984',front:'QA90 frente '+i,back:'QA90 verso '+i,source:'manual',createdAt:now,box:0,dueAt:now,reviews:0,lapses:0})}localStorage.setItem(k,JSON.stringify(p));window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:localStorage.getItem(k)}));return 1})()" >/dev/null 2>&1
agent-browser eval "(function(){var M=new Date('2026-09-30T10:00:00').getTime();class FD extends Date{constructor(...args){args.length===0?super(M):super(...args)}static now(){return M}}window.Date=FD;return 'mock-ok'})()" >/dev/null 2>&1
agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.__poke=1;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 1})()" >/dev/null 2>&1

# navegar: máquina de estados convergente (re-click cego pode TOGGLAR de volta)
nav_state() {
  agent-browser eval "(function(){var t=document.body.textContent;var tabs=document.querySelectorAll('[role=tab]');var fc=0;for(var i=0;i<tabs.length;i++){if(tabs[i].getAttribute('aria-selected')==='true'&&tabs[i].textContent.indexOf('Flashcards')>=0)fc=1}if(t.indexOf('Leitner')>=0&&fc)return 'fc';if(tabs.length>0)return 'praticar';return 'dash'})()" 2>/dev/null | tr -d '"'
}
for try in 1 2 3 4 5 6; do
  S=$(nav_state); echo "nav[$try]=$S"
  [ "$S" = "fc" ] && break
  if [ "$S" = "dash" ]; then
    agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if(els[i].textContent.trim()==='Praticar'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  else
    agent-browser eval "(function(){var els=document.querySelectorAll('[role=tab]');for(var i=0;i<els.length;i++){if(els[i].textContent.indexOf('Flashcards')>=0){els[i].dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  fi
  sleep 2
done

# dark (padrão do app)
agent-browser screenshot /home/z/my-project/scripts/qa90-flash-vespera-dark.png >/dev/null 2>&1
echo "dark ok"

# light
agent-browser eval "(function(){document.documentElement.classList.remove('dark');document.documentElement.classList.add('light');return 'light'})()" >/dev/null 2>&1
sleep 1
agent-browser screenshot /home/z/my-project/scripts/qa90-flash-vespera-light.png >/dev/null 2>&1
agent-browser eval "(function(){document.documentElement.classList.remove('light');document.documentElement.classList.add('dark');return 'dark-restored'})()" >/dev/null 2>&1
echo "light ok"

# mobile 390 véspera
agent-browser set viewport 390 844 >/dev/null 2>&1
sleep 3
agent-browser screenshot /home/z/my-project/scripts/qa90-flash-mobile390.png >/dev/null 2>&1
agent-browser set viewport 1440 900 >/dev/null 2>&1
echo "mobile ok"

# higiene
agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.flashcards=(p.flashcards||[]).filter(function(c){return c.id.indexOf('qa90-fc-')!==0});delete p.__poke;localStorage.setItem(k,JSON.stringify(p));window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:localStorage.getItem(k)}));return 'clean'})()" >/dev/null 2>&1
echo "higiene ok"
