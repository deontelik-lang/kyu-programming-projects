(function(){
  'use strict';
  if (window.StudentOSSounds) return;
  var KEY='studentos.soundscape.v1';
  var THEMES={
    off:{label:'Off · silence',notes:[]},
    future:{label:'Future City',notes:[55,82.41,110,164.81],wave:'sawtooth',filter:420,rate:0.07},
    global:{label:'Global Explorer',notes:[65.41,98,130.81,196],wave:'sine',filter:900,rate:0.045},
    study:{label:'Study Mode',notes:[130.81,164.81,196,261.63],wave:'sine',filter:1300,rate:0.035},
    premium:{label:'Premium Experience',notes:[110,164.81,220,329.63],wave:'triangle',filter:1800,rate:0.055}
  };
  var defaults={enabled:false,volume:0.18,theme:'off',voiceover:true};
  function readSettings(){
    try{
      var parsed=JSON.parse(localStorage.getItem(KEY)||'{}');
      return {
        enabled:parsed.enabled===true,
        volume:Math.min(0.5,Math.max(0,Number.isFinite(Number(parsed.volume))?Number(parsed.volume):defaults.volume)),
        theme:THEMES[parsed.theme]?parsed.theme:'off',
        voiceover:parsed.voiceover!==false
      };
    }catch(_){return Object.assign({},defaults);}
  }
  var settings=readSettings(),ctx=null,master=null,ambientNodes=[],introTimer=0,activeScene=0,lastHover=0,ambientStarted=false;
  var $=function(id){return document.getElementById(id);};
  var scenes=[
    {id:'car',kicker:'01 / FIRST CONTACT',title:'The future starts here.',description:'A new kind of student experience is coming into view.',duration:2200},
    {id:'acceleration',kicker:'02 / BUILT TO MOVE',title:'Your world. In motion.',description:'Ideas, people and opportunities move with you.',duration:1850},
    {id:'tunnel',kicker:'03 / BEYOND THE ORDINARY',title:'Cross into possibility.',description:'One seamless journey across study, life, work and creation.',duration:1900},
    {id:'globe',kicker:'04 / ONE CONNECTED WORLD',title:'No borders to your ambition.',description:'Discover people, places and opportunities around the world.',duration:2200},
    {id:'reveal',kicker:'05 / MEET YOUR NEW HOME',title:'Welcome to <span class="gradient">StudentOS.</span>',description:'The global operating system for student life.',duration:2400}
  ];
  function saveSettings(){try{localStorage.setItem(KEY,JSON.stringify(settings));}catch(_){}}
  function ensureAudio(){
    if(ctx)return true;
    var AudioCtor=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtor)return false;
    try{
      ctx=new AudioCtor();
      master=ctx.createGain();
      master.gain.value=settings.enabled?settings.volume:0;
      master.connect(ctx.destination);
      return true;
    }catch(_){ctx=null;master=null;return false;}
  }
  function wakeAudio(){
    if(!ensureAudio())return false;
    if(ctx.state==='suspended')ctx.resume().catch(function(){});
    if(master)master.gain.setTargetAtTime(settings.enabled?settings.volume:0,ctx.currentTime,.035);
    return true;
  }
  function tone(freq,duration,volume,wave,slide,delay,attack){
    if(!settings.enabled||!wakeAudio())return;
    var start=ctx.currentTime+(delay||0),osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type=wave||'sine';
    osc.frequency.setValueAtTime(Math.max(1,freq),start);
    if(slide)osc.frequency.exponentialRampToValueAtTime(Math.max(1,slide),start+duration);
    gain.gain.setValueAtTime(.0001,start);
    gain.gain.linearRampToValueAtTime(Math.max(.0002,volume||.035),start+(attack||.025));
    gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    osc.connect(gain);gain.connect(master);osc.start(start);osc.stop(start+duration+.04);
    osc.onended=function(){try{osc.disconnect();gain.disconnect();}catch(_){}};
  }
  function noiseSweep(duration,volume,filterType,cutoff,delay){
    if(!settings.enabled||!wakeAudio())return;
    var start=ctx.currentTime+(delay||0),length=Math.max(1,Math.ceil(ctx.sampleRate*duration));
    var buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);
    for(var i=0;i<length;i++)data[i]=(Math.random()*2-1)*(.65+Math.sin(i/length*Math.PI)*.35);
    var source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    source.buffer=buffer;filter.type=filterType||'bandpass';filter.frequency.setValueAtTime(cutoff||1400,start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(100,(cutoff||1400)*.35),start+duration);
    filter.Q.value=.7;gain.gain.setValueAtTime(.0001,start);gain.gain.linearRampToValueAtTime(volume||.04,start+duration*.18);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    source.connect(filter);filter.connect(gain);gain.connect(master);source.start(start);source.stop(start+duration+.03);
    source.onended=function(){try{source.disconnect();filter.disconnect();gain.disconnect();}catch(_){}};
  }
  function chord(notes,duration,volume,wave,spacing){
    notes.forEach(function(note,index){tone(note,duration,volume,wave||'sine',null,(spacing||.06)*index,duration*.18);});
  }
  function stopAmbient(){
    ambientNodes.forEach(function(node){try{if(node.stop)node.stop();node.disconnect();}catch(_){}});
    ambientNodes=[];ambientStarted=false;
  }
  function startAmbient(){
    stopAmbient();
    if(!settings.enabled||settings.theme==='off'||!wakeAudio())return;
    var theme=THEMES[settings.theme];if(!theme||!theme.notes.length)return;
    theme.notes.forEach(function(note,index){
      var osc=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();
      osc.type=theme.wave;osc.frequency.value=note;
      if(index===0)osc.frequency.value=note*.5;
      filter.type='lowpass';filter.frequency.value=theme.filter;
      gain.gain.value=index===0?.025:.008+(index%2)*.004;
      osc.connect(filter);filter.connect(gain);gain.connect(master);osc.start();
      ambientNodes.push(osc,gain,filter);
      if(index>0){
        var lfo=ctx.createOscillator(),lfoGain=ctx.createGain();
        lfo.frequency.value=theme.rate+(index*.006);lfoGain.gain.value=.0035;
        lfo.connect(lfoGain);lfoGain.connect(gain.gain);lfo.start();ambientNodes.push(lfo,lfoGain);
      }
    });
    ambientStarted=true;
  }
  function play(name){
    if(!settings.enabled)return false;
    switch(name){
      case 'click':
        tone(640,.075,.023,'sine',480,0,.008);tone(1180,.045,.008,'sine',920,.008,.005);break;
      case 'hover':
        tone(980,.06,.006,'sine',1240,0,.025);break;
      case 'nav':
        tone(420,.12,.018,'sine',610,0,.02);tone(780,.12,.01,'sine',990,.045,.03);break;
      case 'notification':
        chord([880,1174.66,1396.91],.38,.024,'sine',.075);break;
      case 'message':
        tone(740,.17,.022,'sine',620);tone(988,.23,.025,'sine',1180,.14,.04);break;
      case 'achievement':
        chord([523.25,659.25,783.99,1046.5],.65,.032,'triangle',.095);tone(1568,.55,.018,'sine',1250,.26,.1);break;
      case 'match':
        chord([392,493.88,587.33,783.99],.52,.022,'sine',.09);break;
      case 'success':
        chord([659.25,830.61,987.77],.34,.025,'sine',.065);break;
      case 'wallet':
        chord([523.25,659.25,1046.5],.4,.027,'sine',.08);tone(1318.5,.24,.012,'sine',1568,.18,.06);break;
      case 'ai':
        tone(330,.4,.018,'sine',660,0,.15);tone(880,.28,.014,'sine',1320,.16,.1);break;
      case 'discovery':
        tone(587.33,.22,.022,'sine',880,0,.06);tone(1174.66,.32,.014,'sine',1480,.12,.07);break;
      case 'media':
        tone(440,.16,.015,'sine',660,0,.04);tone(660,.19,.018,'sine',880,.09,.05);break;
      case 'impact':
        tone(58,.95,.12,'triangle',32,0,.35);tone(130,.7,.038,'sine',65,.02,.23);tone(1550,.25,.025,'sine',210,.035,.02);noiseSweep(.7,.04,'lowpass',750,.01);break;
      case 'engine':
        tone(64,1.4,.055,'sawtooth',165,0,.18);tone(96,1.2,.026,'triangle',220,.06,.2);tone(440,.45,.012,'sine',880,.4,.2);break;
      case 'acceleration':
        noiseSweep(1.0,.065,'bandpass',2200,0);tone(95,1.1,.055,'sawtooth',310,0,.12);tone(180,1.0,.024,'triangle',520,.08,.16);break;
      case 'whoosh':
        noiseSweep(.9,.075,'bandpass',3000,0);tone(180,.7,.024,'sine',680,0,.3);break;
      case 'global':
        chord([65.41,98,130.81,196,261.63,329.63],1.65,.025,'sine',.12);tone(440,1.2,.013,'triangle',660,.35,.4);noiseSweep(1.3,.015,'lowpass',900,.2);break;
      case 'reveal':
        tone(48,1.05,.105,'triangle',34,0,.35);chord([130.81,196,261.63,329.63,392],1.25,.033,'sine',.11);tone(783.99,.9,.025,'sine',1046.5,.38,.35);break;
      case 'voice':
        tone(740,.15,.015,'sine',950);break;
      default:return false;
    }
    return true;
  }
  function updateDock(){
    var dock=$('soSoundDock'),toggle=$('soSoundToggle'),theme=$('soSoundTheme'),volume=$('soSoundVolume'),voice=$('soSoundVoice');
    if(dock)dock.dataset.enabled=String(settings.enabled);
    if(toggle){toggle.setAttribute('aria-pressed',String(settings.enabled));toggle.setAttribute('aria-label',settings.enabled?'Turn StudentOS sounds off':'Turn StudentOS sounds on');var label=toggle.querySelector('.so-sound-label');if(label)label.textContent=settings.enabled?'Sound on':'Sound off';}
    if(theme)theme.value=settings.theme;
    if(volume)volume.value=String(settings.volume);
    if(voice)voice.checked=settings.voiceover;
    var panelToggle=$('soSoundSettings');if(panelToggle)panelToggle.setAttribute('aria-expanded',String($('soSoundPanel')&&!$('soSoundPanel').hidden));
  }
  function setEnabled(enabled){
    settings.enabled=Boolean(enabled);saveSettings();wakeAudio();
    if(!settings.enabled){
      stopAmbient();
      if(window.speechSynthesis){try{window.speechSynthesis.cancel();}catch(_){}}
      if(master&&ctx)master.gain.setTargetAtTime(0,ctx.currentTime,.025);
    }else if(settings.theme!=='off')startAmbient();
    updateDock();
  }
  function setTheme(theme){
    settings.theme=THEMES[theme]?theme:'off';
    if(settings.theme!=='off')settings.enabled=true;
    saveSettings();wakeAudio();
    if(settings.theme==='off')stopAmbient();else startAmbient();
    updateDock();
    if(settings.enabled&&settings.theme!=='off')play('discovery');
  }
  function modalMarkup(){
    var points=scenes.map(function(_,i){return '<i'+(i===0?' class="active"':'')+'></i>';}).join('');
    return '<div id="soIntroOverlay" class="so-intro-overlay" data-scene="car" role="dialog" aria-modal="true" aria-label="StudentOS cinematic introduction" aria-describedby="soIntroDescription" hidden>'+
      '<div class="so-intro-stars" aria-hidden="true"></div><div class="so-intro-stage" aria-hidden="true">'+
      '<div class="so-intro-horizon"></div><div class="so-intro-city"></div><div class="so-intro-tunnel"></div>'+
      '<div class="so-intro-car"><svg viewBox="0 0 680 260" role="img" aria-label="Stylized futuristic sports car">'+
      '<defs><linearGradient id="soCarBody" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="#e2e8f0"/><stop offset=".32" stop-color="#64748b"/><stop offset=".65" stop-color="#1e293b"/><stop offset="1" stop-color="#020617"/></linearGradient><linearGradient id="soCarGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bae6fd"/><stop offset=".55" stop-color="#1e40af"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs>'+
      '<ellipse cx="337" cy="204" rx="245" ry="22" fill="#000" opacity=".58"/><path d="M73 169 L112 153 Q143 142 172 139 L240 80 Q266 58 307 59 L409 69 Q444 72 469 99 L515 141 Q554 148 590 168 L604 190 L574 207 L104 208 L65 193Z" fill="url(#soCarBody)" stroke="#bfdbfe" stroke-opacity=".75" stroke-width="2"/>'+
      '<path d="M193 137 L249 88 Q267 72 302 73 L347 77 L341 137Z" fill="url(#soCarGlass)" stroke="#bae6fd" stroke-opacity=".8"/><path d="M356 78 L406 83 Q432 86 452 111 L472 138 L356 137Z" fill="url(#soCarGlass)" stroke="#bae6fd" stroke-opacity=".8"/>'+
      '<path d="M72 171 L159 157 L523 157 L584 174 L598 190 L543 190 L514 170 L158 170 L130 191 L74 191Z" fill="#020617" opacity=".84"/><path d="M89 172 L145 160 L126 177 L88 181Z" fill="#7dd3fc" class="so-car-light"/><path d="M537 161 L582 177 L561 178 L533 169Z" fill="#fb7185" style="filter:drop-shadow(0 0 8px #fb7185)"/>'+
      '<path d="M184 142 L479 142" stroke="#cbd5e1" stroke-opacity=".45" stroke-width="2"/><path d="M222 158 L504 158" stroke="#67e8f9" stroke-opacity=".7" stroke-width="2"/>'+
      '<circle cx="179" cy="200" r="35" fill="#020617" stroke="#64748b" stroke-width="8"/><circle cx="179" cy="200" r="17" fill="#94a3b8" stroke="#0f172a" stroke-width="7"/><circle cx="179" cy="200" r="5" fill="#dbeafe"/><circle cx="493" cy="200" r="35" fill="#020617" stroke="#64748b" stroke-width="8"/><circle cx="493" cy="200" r="17" fill="#94a3b8" stroke="#0f172a" stroke-width="7"/><circle cx="493" cy="200" r="5" fill="#dbeafe"/>'+
      '<path d="M129 215 L557 215" stroke="#67e8f9" stroke-width="2" stroke-linecap="round" opacity=".8" class="so-car-light"/></svg></div>'+
      '<div class="so-intro-globe-wrap"><div class="so-intro-globe"></div><div class="so-intro-globe-ring"></div><div class="so-intro-globe-ring ring-two"></div><div class="so-intro-globe-ring ring-three"></div></div>'+
      '<div class="so-intro-logo"><div class="so-intro-logo-mark">S<span>O</span></div></div></div>'+
      '<button class="so-intro-actions so-intro-skip" type="button" data-sound-action="close-intro">Skip intro ×</button>'+
      '<div class="so-intro-content"><div id="soIntroKicker" class="so-intro-kicker">01 / FIRST CONTACT</div><h1 id="soIntroTitle" class="so-intro-title">The future starts here.</h1><p id="soIntroDescription" class="so-intro-description">A new kind of student experience is coming into view.</p>'+
      '<div class="so-intro-progress" aria-hidden="true">'+points+'</div><div class="so-intro-actions"><button id="soIntroEnter" class="primary" type="button" data-sound-action="enter-intro" hidden>Explore StudentOS ↗</button></div></div></div>';
  }
  function uiMarkup(){
    return '<div class="so-intro-banner"><div class="so-intro-banner-copy"><div class="so-intro-banner-kicker">OPTIONAL IMMERSIVE PREVIEW</div><strong>Your future. One connected universe.</strong><small>A short cinematic StudentOS reveal with optional browser-generated sound. Sound stays off until you choose to start.</small></div><button class="so-intro-launch" type="button" data-sound-action="intro">▶ Launch experience</button></div>'+
      '<div id="soSoundDock" class="so-sound-dock" data-enabled="false"><button id="soSoundToggle" type="button" data-sound-action="toggle-sound" aria-pressed="false" aria-label="Turn StudentOS sounds on"><span class="so-sound-indicator" aria-hidden="true"></span><span class="so-sound-label">Sound off</span></button><button id="soSoundSettings" class="so-sound-gear" type="button" data-sound-action="toggle-panel" aria-expanded="false" aria-controls="soSoundPanel" aria-label="Sound settings">⚙</button></div>'+
      '<section id="soSoundPanel" class="so-sound-panel" aria-label="StudentOS sound settings" hidden><div class="so-sound-panel-head"><div><strong>Soundscape</strong><small>Shape the atmosphere. Your settings stay on this device.</small></div><button type="button" class="so-sound-close" data-sound-action="toggle-panel" aria-label="Close sound settings">×</button></div>'+
      '<div class="so-sound-row"><label for="soSoundTheme">Ambient theme</label><select id="soSoundTheme"><option value="off">Off · silence</option><option value="future">Future City</option><option value="global">Global Explorer</option><option value="study">Study Mode</option><option value="premium">Premium Experience</option></select></div>'+
      '<div class="so-sound-row"><label for="soSoundVolume">Volume</label><input id="soSoundVolume" type="range" min="0" max="0.5" step="0.01" value="0.18"></div>'+
      '<div class="so-sound-row"><label for="soSoundVoice">Spoken intro reveal</label><input id="soSoundVoice" type="checkbox" checked></div>'+
      '<button type="button" class="so-sound-intro-btn" data-sound-action="intro">▶ Replay cinematic intro</button>'+
      '<div class="so-sound-note">Audio is synthesized locally in your browser; no soundtrack is downloaded or streamed. Speech uses your browser voice when available. Choose Off or turn sound off any time.</div></section>'+
      modalMarkup();
  }
  function renderScene(index){
    activeScene=index;
    var scene=scenes[index],overlay=$('soIntroOverlay');
    if(!scene||!overlay)return;
    overlay.dataset.scene=scene.id;
    $('soIntroKicker').textContent=scene.kicker;
    $('soIntroTitle').innerHTML=scene.title;
    $('soIntroDescription').textContent=scene.description;
    overlay.querySelectorAll('.so-intro-progress i').forEach(function(dot,i){dot.classList.toggle('active',i===index);});
    var enter=$('soIntroEnter');if(enter)enter.hidden=index!==scenes.length-1;
    if(index===0){play('impact');setTimeout(function(){play('engine');},210);}
    if(index===1)play('acceleration');
    if(index===2)play('whoosh');
    if(index===3)play('global');
    if(index===4){
      play('reveal');
      if(settings.voiceover&&window.speechSynthesis&&window.SpeechSynthesisUtterance){
        try{
          window.speechSynthesis.cancel();
          var utterance=new SpeechSynthesisUtterance('Welcome to StudentOS. The global operating system for student life.');
          utterance.rate=.91;utterance.pitch=.92;utterance.volume=Math.min(1,settings.volume*2.2);
          var voices=window.speechSynthesis.getVoices();
          var voice=voices.find(function(v){return /^en(-|_)/i.test(v.lang)&&(/female|natural|samantha|aria|jenny|zira/i.test(v.name));})||voices.find(function(v){return /^en(-|_)/i.test(v.lang);});
          if(voice)utterance.voice=voice;
          window.speechSynthesis.speak(utterance);
        }catch(_){}
      }
    }
  }
  function advanceIntro(){
    window.clearTimeout(introTimer);
    if(activeScene>=scenes.length-1){
      if($('soIntroEnter'))$('soIntroEnter').focus();
      return;
    }
    introTimer=window.setTimeout(function(){renderScene(activeScene+1);advanceIntro();},scenes[activeScene].duration);
  }
  function closeIntro(){
    window.clearTimeout(introTimer);
    var overlay=$('soIntroOverlay');
    if(overlay){overlay.classList.add('is-leaving');window.setTimeout(function(){overlay.hidden=true;overlay.classList.remove('is-leaving');},620);}
    if(window.speechSynthesis){try{window.speechSynthesis.cancel();}catch(_){}}
    document.body.classList.remove('so-intro-open');
    if(settings.enabled&&settings.theme!=='off')startAmbient();
    var launch=document.querySelector('[data-sound-action="intro"]');if(launch)launch.focus({preventScroll:true});
  }
  function playIntro(){
    if(!settings.enabled){settings.enabled=true;saveSettings();wakeAudio();updateDock();}
    else wakeAudio();
    var overlay=$('soIntroOverlay');if(!overlay)return;
    if($('soSoundPanel'))$('soSoundPanel').hidden=true;
    updateDock();
    overlay.hidden=false;overlay.classList.remove('is-leaving');document.body.classList.add('so-intro-open');
    renderScene(0);advanceIntro();
    var skip=overlay.querySelector('[data-sound-action="close-intro"]');if(skip)skip.focus({preventScroll:true});
  }
  function ripple(element,event){
    if(!element||element.disabled||window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    var rect=element.getBoundingClientRect(),x=(event.clientX||rect.left+rect.width/2)-rect.left,y=(event.clientY||rect.top+rect.height/2)-rect.top;
    var wave=document.createElement('span');wave.className='so-ripple-wave';wave.style.left=x+'px';wave.style.top=y+'px';element.classList.add('so-sound-ripple');element.appendChild(wave);
    window.setTimeout(function(){wave.remove();},620);
  }
  function init(){
    var launcher=$('studentosLaunchpad');
    if(launcher&&!$('soSoundDock')){
      var title=launcher.querySelector('.so-title');
      var banner=document.createElement('div');banner.innerHTML=uiMarkup();
      var introBanner=banner.querySelector('.so-intro-banner');
      if(title&&title.nextElementSibling)title.nextElementSibling.insertAdjacentElement('afterend',introBanner);
      else launcher.prepend(introBanner);
      document.body.appendChild(banner.querySelector('#soSoundDock'));
      document.body.appendChild(banner.querySelector('#soSoundPanel'));
      document.body.appendChild(banner.querySelector('#soIntroOverlay'));
    }
    updateDock();
    if(typeof window.toast==='function'&&!window.toast.__studentOSSoundsWrapped){
      var originalToast=window.toast;
      var wrappedToast=function(){var result=originalToast.apply(this,arguments);play('notification');return result;};
      wrappedToast.__studentOSSoundsWrapped=true;
      window.toast=wrappedToast;
    }
    document.addEventListener('click',function(event){
      var button=event.target.closest('button,[role="button"],a');
      if(!button)return;
      var action=button.dataset.soundAction;
      if(action){
        event.preventDefault();
        switch(action){
          case 'intro':playIntro();return;
          case 'close-intro':closeIntro();return;
          case 'enter-intro':closeIntro();play('success');return;
          case 'toggle-sound':
            if(!settings.enabled){setEnabled(true);play('success');}
            else {setEnabled(false);}
            return;
          case 'toggle-panel':
            if($('soSoundPanel'))$('soSoundPanel').hidden=!$('soSoundPanel').hidden;
            updateDock();play('click');return;
        }
      }
      if(!settings.enabled||button.disabled)return;
      if(button.id==='soSoundToggle'||button.id==='soSoundSettings')return;
      if(button.dataset.soPreset){play('discovery');return;}
      if(button.dataset.soAction==='assistant'){play('ai');return;}
      if(button.dataset.soAction==='save-location'||button.dataset.soAction==='use-location'){play('click');return;}
      if(button.dataset.soPage||button.dataset.soMode){play('nav');return;}
      if(button.dataset.soType&&['media_video','music','podcast','student_original','creator'].indexOf(button.dataset.soType)>=0){play('media');return;}
      if(button.closest('#studentosGlobal')&&button.textContent.toLowerCase().indexOf('save location')>=0){play('click');return;}
      if(button.matches('.so-global-link,.so-media-card,.so-location-pill,.so-mode-btn')){play('discovery');return;}
      if(button.type==='submit'){play('click');return;}
      play('click');
    });
    document.addEventListener('mouseover',function(event){
      if(!settings.enabled)return;
      var button=event.target.closest('button,a,[role="button"]');
      if(!button||button.contains(event.relatedTarget)||button.disabled)return;
      var now=Date.now();if(now-lastHover<320)return;lastHover=now;
      if(button.matches('.so-launch-card,.so-media-card,.so-map-pin,.so-global-link,.so-intro-launch'))play('hover');
    });
    document.addEventListener('pointerdown',function(event){
      var button=event.target.closest('button,.so-launch-card,.so-media-card,.so-global-link');
      if(!button||button.disabled||button.closest('#soSoundDock,#soSoundPanel,#soIntroOverlay'))return;
      ripple(button,event);
    },{passive:true});
    document.addEventListener('change',function(event){
      if(event.target.id==='soSoundTheme')setTheme(event.target.value);
      if(event.target.id==='soSoundVolume'){
        settings.volume=Math.min(.5,Math.max(0,Number(event.target.value)||0));saveSettings();
        if(master)master.gain.setTargetAtTime(settings.enabled?settings.volume:0,ctx.currentTime,.04);
      }
      if(event.target.id==='soSoundVoice'){settings.voiceover=event.target.checked;saveSettings();}
    });
    document.addEventListener('keydown',function(event){
      if(event.key==='Escape'&&$('soIntroOverlay')&&!$('soIntroOverlay').hidden)closeIntro();
      if(event.key==='Escape'&&$('soSoundPanel')&&!$('soSoundPanel').hidden){$('soSoundPanel').hidden=true;updateDock();}
    });
    ['studentos:notification','studentos:message','studentos:achievement','studentos:match-success','studentos:wallet-success','studentos:media-transition','studentos:discovery'].forEach(function(eventName){
      document.addEventListener(eventName,function(){var map={'studentos:notification':'notification','studentos:message':'message','studentos:achievement':'achievement','studentos:match-success':'match','studentos:wallet-success':'wallet','studentos:media-transition':'media','studentos:discovery':'discovery'};play(map[eventName]);});
    });
    document.addEventListener('visibilitychange',function(){if(document.hidden&&ctx&&ctx.state==='running'){/* Keep the pad alive quietly; the browser may suspend it itself. */}});
  }
  window.StudentOSSounds={
    play:play,
    playIntro:playIntro,
    setEnabled:setEnabled,
    setTheme:setTheme,
    startAmbient:startAmbient,
    stopAmbient:stopAmbient,
    getSettings:function(){return Object.assign({},settings);},
    notify:function(){play('notification');},
    message:function(){play('message');},
    achievement:function(){play('achievement');},
    matchSuccess:function(){play('match');},
    walletSuccess:function(){play('wallet');},
    discover:function(){play('discovery');}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
