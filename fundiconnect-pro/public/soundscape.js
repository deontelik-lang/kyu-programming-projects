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
  var defaults={enabled:false,volume:0.18,theme:'off',voiceover:true,userMuted:false};
  function readSettings(){
    try{
      var parsed=JSON.parse(localStorage.getItem(KEY)||'{}');
      return {
        enabled:parsed.enabled===true,
        volume:Math.min(0.5,Math.max(0,Number.isFinite(Number(parsed.volume))?Number(parsed.volume):defaults.volume)),
        theme:THEMES[parsed.theme]?parsed.theme:'off',
        voiceover:parsed.voiceover!==false,
        userMuted:parsed.userMuted===true
      };
    }catch(_){return Object.assign({},defaults);}
  }
  var settings=readSettings(),ctx=null,master=null,ambientNodes=[],introTimer=0,activeScene=0,lastHover=0,ambientStarted=false;
  var $=function(id){return document.getElementById(id);};
  var cinemaCanvas=null,cinemaCtx=null,cinemaFrameId=0,cinemaStart=0,cinemaDpr=1,cinemaWidth=0,cinemaHeight=0,cinemaStars=[],cinemaLastTime=0,ambientBeatTimer=0,cinemaSnapshotCanvas=null,cinemaSnapshotCtx=null,cinemaHasFrame=false,cinemaSceneTransitionAt=0,cinemaSceneTransitionDuration=860,cinemaSceneTransitionTimer=0;
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
    if(ambientBeatTimer){window.clearInterval(ambientBeatTimer);ambientBeatTimer=0;}
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
    // A quiet, clocked lo-fi pulse turns Study Mode into a gentle focus rhythm.
    if(settings.theme==='study'){
      var beat=0;
      ambientBeatTimer=window.setInterval(function(){
        if(!settings.enabled||!ctx||ctx.state!=='running')return;
        tone(beat%4===0?58:beat%2===0?92:146,.13,beat%4===0?.028:.009,'sine',beat%4===0?43:80,0,.008);
        if(beat%2===1)noiseSweep(.045,.004,'highpass',5800,.025);
        if(beat%4===2)tone(392,.075,.004,'triangle',350,.035,.006);
        beat++;
      },720);
    }
    if(settings.theme==='future'){
      ambientBeatTimer=window.setInterval(function(){if(settings.enabled&&ctx&&ctx.state==='running')noiseSweep(.48,.005,'bandpass',380,.02);},4600);
    }
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
    settings.enabled=Boolean(enabled);settings.userMuted=!settings.enabled;saveSettings();wakeAudio();
    if(!settings.enabled){
      stopAmbient();
      if(window.speechSynthesis){try{window.speechSynthesis.cancel();}catch(_){}}
      if(master&&ctx)master.gain.setTargetAtTime(0,ctx.currentTime,.025);
    }else if(settings.theme!=='off')startAmbient();
    updateDock();
  }
  function setTheme(theme){
    settings.theme=THEMES[theme]?theme:'off';
    if(settings.theme!=='off'){settings.enabled=true;settings.userMuted=false;}
    saveSettings();wakeAudio();
    if(settings.theme==='off')stopAmbient();else startAmbient();
    updateDock();
    if(settings.enabled&&settings.theme!=='off')play('discovery');
  }
  function modalMarkup(){
    var points=scenes.map(function(_,i){return '<i'+(i===0?' class="active"':'')+'></i>';}).join('');
    return '<div id="soIntroOverlay" class="so-intro-overlay" data-scene="car" role="dialog" aria-modal="true" aria-label="StudentOS cinematic introduction" aria-describedby="soIntroDescription" hidden>'+
      '<div class="so-intro-stage" aria-hidden="true"><canvas id="soCinemaCanvas" class="so-cinema-canvas"></canvas>'+
      '<div class="so-intro-logo"><div class="so-intro-logo-mark">S<span>O</span></div></div></div>'+
      '<button class="so-intro-actions so-intro-skip" type="button" data-sound-action="close-intro">Skip intro ×</button>'+
      '<div class="so-intro-content"><div id="soIntroKicker" class="so-intro-kicker">01 / FIRST CONTACT</div><h1 id="soIntroTitle" class="so-intro-title">The future starts here.</h1><p id="soIntroDescription" class="so-intro-description">A new kind of student experience is coming into view.</p>'+
      '<div class="so-intro-progress" aria-hidden="true">'+points+'</div><div class="so-intro-actions"><button id="soIntroEnter" class="primary" type="button" data-sound-action="enter-intro" hidden>Explore StudentOS ↗</button></div></div></div>';
  }
  function uiMarkup(){
    return '<div class="so-intro-banner"><div class="so-intro-banner-copy"><div class="so-intro-banner-kicker">OPTIONAL IMMERSIVE PREVIEW</div><strong>Your future. One connected universe.</strong><small>A short cinematic StudentOS reveal with optional browser-generated sound. Sound stays off until you choose to start.</small></div><button class="so-intro-launch" type="button" data-sound-action="intro">▶ Launch experience</button></div>'+
      '<div id="soSoundDock" class="so-sound-dock" data-enabled="false"><button id="soSoundToggle" type="button" data-sound-action="toggle-sound" aria-pressed="false" aria-label="Turn StudentOS sounds on"><span class="so-sound-indicator" aria-hidden="true"></span><span class="so-sound-label">Sound off</span></button><button id="soSoundSettings" class="so-sound-gear" type="button" data-sound-action="toggle-panel" aria-expanded="false" aria-controls="soSoundPanel" aria-label="Sound settings">⚙</button></div>'+
      '<section id="soSoundPanel" class="so-sound-panel" aria-label="StudentOS sound settings" hidden><div class="so-sound-panel-head"><div><strong>Soundscape</strong><small>Shape the atmosphere. Your settings stay on this device.</small></div><button type="button" class="so-sound-close" data-sound-action="toggle-panel" aria-label="Close sound settings">×</button></div>'+
      '<div class="so-sound-row"><label for="soSoundTheme">Ambient theme</label><select id="soSoundTheme"><option value="off">No background music</option><option value="future">Future City</option><option value="global">Global Explorer</option><option value="study">Study Mode</option><option value="premium">Premium Experience</option></select></div>'+
      '<div class="so-sound-row"><label for="soSoundVolume">Volume</label><input id="soSoundVolume" type="range" min="0" max="0.5" step="0.01" value="0.18"></div>'+
      '<div class="so-sound-row"><label for="soSoundVoice">Spoken intro reveal</label><input id="soSoundVoice" type="checkbox" checked></div>'+
      '<button type="button" class="so-sound-intro-btn" data-sound-action="intro">▶ Replay cinematic intro</button>'+
      '<div class="so-sound-note">Audio is synthesized locally in your browser; no soundtrack is downloaded or streamed. Speech uses your browser voice when available. Choose Off or turn sound off any time.</div></section>'+
      modalMarkup();
  }
  function renderScene(index){
    var scene=scenes[index],overlay=$('soIntroOverlay');
    if(!scene||!overlay)return;
    var reducedMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Capture the outgoing frame before changing scene state; the next frame blends from it.
    if(cinemaCtx&&cinemaCanvas&&cinemaHasFrame&&overlay.dataset.scene!==scene.id&&!reducedMotion){
      try{
        if(!cinemaSnapshotCanvas)cinemaSnapshotCanvas=document.createElement('canvas');
        cinemaSnapshotCanvas.width=cinemaCanvas.width;cinemaSnapshotCanvas.height=cinemaCanvas.height;
        cinemaSnapshotCtx=cinemaSnapshotCanvas.getContext('2d');
        if(cinemaSnapshotCtx){cinemaSnapshotCtx.clearRect(0,0,cinemaSnapshotCanvas.width,cinemaSnapshotCanvas.height);cinemaSnapshotCtx.drawImage(cinemaCanvas,0,0);cinemaSceneTransitionAt=performance.now();}
        else cinemaSnapshotCanvas=null;
      }catch(_){cinemaSnapshotCanvas=null;cinemaSnapshotCtx=null;}
      overlay.classList.add('so-scene-transition');
      window.clearTimeout(cinemaSceneTransitionTimer);
      cinemaSceneTransitionTimer=window.setTimeout(function(){overlay.classList.remove('so-scene-transition');},cinemaSceneTransitionDuration+80);
    }else{
      cinemaSnapshotCanvas=null;cinemaSnapshotCtx=null;
      overlay.classList.remove('so-scene-transition');
    }
    activeScene=index;
    overlay.dataset.scene=scene.id;
    $('soIntroKicker').textContent=scene.kicker;
    $('soIntroTitle').innerHTML=scene.title;
    $('soIntroDescription').textContent=scene.description;
    // The scene copy has its own entrance motion, independent of the continuously rendered canvas.
    [$('soIntroKicker'),$('soIntroTitle'),$('soIntroDescription')].forEach(function(node){
      if(!node)return;node.classList.remove('so-scene-copy-enter');void node.offsetWidth;node.classList.add('so-scene-copy-enter');
    });
    overlay.querySelectorAll('.so-intro-progress i').forEach(function(dot,i){dot.classList.toggle('active',i===index);});
    var enter=$('soIntroEnter');if(enter)enter.hidden=index!==scenes.length-1;
    if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches&&cinemaCtx)paintCinemaScene(0,scene.id);
    if(index===0){play('impact');setTimeout(function(){play('engine');},210);}
    if(index===1)play('acceleration');
    if(index===2)play('whoosh');
    if(index===3)play('global');
    if(index===4){
      play('reveal');
      if(settings.enabled&&settings.voiceover&&window.speechSynthesis&&window.SpeechSynthesisUtterance){
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
  function cinemaResize(){
    if(!cinemaCanvas)return;
    var box=cinemaCanvas.getBoundingClientRect(),dpr=Math.min(1.8,window.devicePixelRatio||1);
    cinemaDpr=dpr;cinemaWidth=Math.max(1,box.width);cinemaHeight=Math.max(1,box.height);
    var pw=Math.round(cinemaWidth*dpr),ph=Math.round(cinemaHeight*dpr);
    if(cinemaCanvas.width!==pw||cinemaCanvas.height!==ph){cinemaCanvas.width=pw;cinemaCanvas.height=ph;}
    cinemaCtx=cinemaCanvas.getContext('2d',{alpha:false,desynchronized:true});
    if(cinemaCtx)cinemaCtx.setTransform(dpr,0,0,dpr,0,0);
    cinemaStars=Array.from({length:Math.min(180,Math.max(70,Math.round(cinemaWidth*cinemaHeight/8500)))},function(){return {x:Math.random(),y:Math.random(),z:.22+Math.random()*.78,r:.35+Math.random()*1.25,p:Math.random()*Math.PI*2};});
  }
  function cinemaPath(points,close){
    var c=cinemaCtx;if(!points.length)return;c.beginPath();c.moveTo(points[0][0],points[0][1]);
    for(var i=1;i<points.length;i++)c.lineTo(points[i][0],points[i][1]);
    if(close!==false)c.closePath();
  }
  function cinemaGlow(x,y,r,color,alpha){
    var c=cinemaCtx,g=c.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,color.replace('ALPHA',String(alpha)));
    g.addColorStop(1,color.replace('ALPHA','0'));
    c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
  }
  function cinemaBackground(t,scene){
    var c=cinemaCtx,w=cinemaWidth,h=cinemaHeight;
    var bg=c.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#040713');bg.addColorStop(.42,'#09142d');bg.addColorStop(.72,'#10102e');bg.addColorStop(1,'#030611');
    c.fillStyle=bg;c.fillRect(0,0,w,h);
    cinemaGlow(w*.2,h*.22,w*.5,'rgba(39,113,255,ALPHA)',.22);
    cinemaGlow(w*.82,h*.44,w*.48,'rgba(134,56,245,ALPHA)',.18);
    cinemaGlow(w*.51,h*.78,w*.38,'rgba(8,194,226,ALPHA)',.12);
    cinemaStars.forEach(function(star){
      var drift=(t*.0025*star.z)%1,x=((star.x-drift*.12+1)%1)*w,y=((star.y+t*.0009*star.z)%1)*h;
      var twinkle=.3+.7*(.5+.5*Math.sin(t*.0012+star.p));
      c.globalAlpha=twinkle*star.z;c.fillStyle=star.z>.78?'#e0f2fe':'#93c5fd';
      c.beginPath();c.arc(x,y,star.r*star.z,0,Math.PI*2);c.fill();
    });
    c.globalAlpha=1;
    // layered glass towers give the horizon depth and gentle parallax.
    for(var layer=0;layer<3;layer++){
      var base=h*(.69+layer*.035),speed=(layer+1)*.004,ww=14+layer*7;
      c.fillStyle=['#091a38','#0b1730','#10132e'][layer];
      c.beginPath();c.moveTo(0,base);
      for(var i=0;i<Math.ceil(w/ww)+3;i++){
        var x=i*ww-((t*speed*ww)%ww);
        var bh=(.025+((Math.sin(i*12.989+layer*37)*43758.5453)%1+1)%1*.15)*h;
        c.lineTo(x,base);c.lineTo(x,base-bh);c.lineTo(x+ww*.7,base-bh);c.lineTo(x+ww*.7,base);
      }
      c.lineTo(w,base);c.lineTo(w,h);c.lineTo(0,h);c.closePath();c.fill();
      c.strokeStyle=layer===0?'rgba(56,189,248,.26)':'rgba(129,140,248,.14)';c.lineWidth=.7;
      for(var wx=0;wx<w;wx+=ww){
        var wy=base-(h*.03+Math.abs(Math.sin(wx*.07+layer))*h*.1);
        c.beginPath();c.moveTo(wx,wy);c.lineTo(wx,base-4);c.stroke();
      }
    }
    // Perspective road: motion is rendered every frame, not a static illustration.
    var horizon=h*.68;
    var road=c.createLinearGradient(0,horizon,0,h);road.addColorStop(0,'rgba(12,35,78,.05)');road.addColorStop(1,'rgba(8,14,37,.92)');
    c.fillStyle=road;c.fillRect(0,horizon,w,h-horizon);
    c.strokeStyle='rgba(72,203,255,.21)';c.lineWidth=1;
    // Perspective grid and road markings travel toward the lens to establish forward motion.
    var roadPhase=(t*.00019)%1;
    for(var line=0;line<=18;line++){
      var q=((line/18)+roadPhase)%1;
      q=.018+q*.982;
      var yy=horizon+Math.pow(q,2.05)*(h-horizon);
      c.globalAlpha=.10+q*.31;c.beginPath();c.moveTo(0,yy);c.lineTo(w,yy);c.stroke();
    }
    for(var col=-8;col<=8;col++){
      c.globalAlpha=.17;c.beginPath();c.moveTo(w*.5+col*2,horizon);c.lineTo(w*.5+col*w*.115,h);c.stroke();
    }
    // Segmented lane markers expand from the vanishing point like a moving camera shot.
    var lanePhase=(t*.00034)%1;
    for(var dash=0;dash<13;dash++){
      var dq=((dash/13)+lanePhase)%1,dy=horizon+Math.pow(dq,1.9)*(h-horizon);
      var dashLen=2+dq*h*.052,dashWide=.5+dq*1.5;
      c.globalAlpha=.12+dq*.55;c.strokeStyle=dash%4===0?'#d8fbff':'#69e3ff';c.lineWidth=dashWide;
      c.beginPath();c.moveTo(w*.5-dq*w*.018,dy);c.lineTo(w*.5+dq*w*.018,dy+dashLen);c.stroke();
    }
    c.globalAlpha=1;
    // A soft, animated pool of cyan/violet light is reflected on the road surface.
    var reflectX=w*(.5+Math.sin(t*.00034)*.12),reflectY=h*.83;
    var reflection=c.createRadialGradient(reflectX,reflectY,0,reflectX,reflectY,w*.48);
    reflection.addColorStop(0,scene==='acceleration'?'rgba(34,211,238,.12)':'rgba(99,102,241,.08)');
    reflection.addColorStop(.45,'rgba(139,92,246,.035)');reflection.addColorStop(1,'rgba(3,6,18,0)');
    c.fillStyle=reflection;c.fillRect(0,horizon,w,h-horizon);
    if(scene==='acceleration'){
      for(var streak=0;streak<95;streak++){
        var progress=((streak*.137+t*.00055*(.35+(streak%7)*.1))%1),angle=streak*2.39996;
        var inner=8+progress*Math.min(w,h)*.43,outer=inner*(1.16+progress*.65);
        var x=w*.5+Math.cos(angle)*inner,y=h*.48+Math.sin(angle)*inner;
        c.strokeStyle=streak%4===0?'rgba(217,70,239,.8)':streak%3===0?'rgba(103,232,249,.85)':'rgba(96,165,250,.48)';
        c.lineWidth=.5+progress*1.6;c.globalAlpha=.25+progress*.66;
        c.beginPath();c.moveTo(x,y);c.lineTo(w*.5+Math.cos(angle)*outer,h*.48+Math.sin(angle)*outer);c.stroke();
      }
      c.globalAlpha=1;
    }
  }
  function cinemaCar(t,scene){
    var c=cinemaCtx,w=cinemaWidth,h=cinemaHeight;
    var scale=Math.min(1.12,w/590,h/430),cx=w*.5,cy=h*.555;
    if(scene==='acceleration'){cx=w*.66+Math.sin(t*.002)*w*.035;cy=h*.59;scale*=.96;}
    if(scene==='tunnel'){scale*=Math.max(.22,1-((t*.0001)%1)*.7);cy=h*.59;}
    if(scene==='globe'||scene==='reveal')return;
    c.save();c.translate(cx,cy);c.scale(scale,scale);
    var bob=Math.sin(t*.0038)*2.3;c.translate(0,bob);
    // Motion trails behind the body.
    if(scene==='acceleration'){
      for(var streak=0;streak<14;streak++){
        var sy=10+streak*6,sl=45+((streak*73+Math.floor(t*.14))%180);
        var lg=c.createLinearGradient(-285-sl,sy,-250,sy);lg.addColorStop(0,'rgba(103,232,249,0)');lg.addColorStop(1,streak%3===0?'rgba(217,70,239,.75)':'rgba(103,232,249,.76)');
        c.strokeStyle=lg;c.lineWidth=1+(streak%3);c.beginPath();c.moveTo(-285-sl,sy);c.lineTo(-255,sy);c.stroke();
      }
    }
    // Forward-facing headlight beams sweep over the virtual road during acceleration.
    if(scene==='acceleration'){
      c.save();c.globalAlpha=.17+.08*(.5+.5*Math.sin(t*.009));
      var beam=c.createLinearGradient(220,25,500,40);beam.addColorStop(0,'rgba(103,232,249,.42)');beam.addColorStop(.4,'rgba(103,232,249,.12)');beam.addColorStop(1,'rgba(103,232,249,0)');
      c.fillStyle=beam;c.beginPath();c.moveTo(230,22);c.lineTo(560,-6);c.lineTo(570,97);c.lineTo(242,44);c.closePath();c.fill();
      var magentaBeam=c.createLinearGradient(190,48,450,75);magentaBeam.addColorStop(0,'rgba(217,70,239,.17)');magentaBeam.addColorStop(1,'rgba(217,70,239,0)');
      c.fillStyle=magentaBeam;c.beginPath();c.moveTo(195,48);c.lineTo(470,70);c.lineTo(450,104);c.closePath();c.fill();c.restore();
    }
    // Soft contact shadow with subtle road-reflection shimmer.
    c.fillStyle='rgba(0,0,0,.57)';c.beginPath();c.ellipse(0,70,264,24,0,0,Math.PI*2);c.fill();
    // Underbody neon reflecting onto wet glass.
    var under=c.createLinearGradient(0,38,0,83);under.addColorStop(0,'rgba(103,232,249,.42)');under.addColorStop(1,'rgba(109,40,217,0)');
    c.fillStyle=under;c.beginPath();c.ellipse(0,64,252,24,0,0,Math.PI*2);c.fill();
    // Futuristic sculpted car silhouette.
    c.save();c.shadowColor='#60a5fa';c.shadowBlur=24;
    var body=c.createLinearGradient(-60,-70,80,77);body.addColorStop(0,'#f8fafc');body.addColorStop(.17,'#94a3b8');body.addColorStop(.39,'#475569');body.addColorStop(.65,'#17243d');body.addColorStop(.84,'#080e1d');body.addColorStop(1,'#1e293b');
    cinemaPath([[-286,36],[-260,16],[-203,3],[-154,-5],[-103,-55],[-60,-77],[49,-72],[104,-51],[163,-10],[222,0],[260,19],[278,41],[257,56],[207,64],[159,60],[113,65],[-135,65],[-204,60],[-269,54]],true);
    c.fillStyle=body;c.fill();c.shadowBlur=0;c.strokeStyle='rgba(226,242,255,.8)';c.lineWidth=1.3;c.stroke();
    // Aerodynamic shoulder lines and glass roof.
    var glass=c.createLinearGradient(0,-78,0,-6);glass.addColorStop(0,'#dbeafe');glass.addColorStop(.18,'#60a5fa');glass.addColorStop(.63,'#12366b');glass.addColorStop(1,'#050e20');
    cinemaPath([[-145,-5],[-95,-53],[-58,-68],[42,-65],[80,-47],[133,-6]],true);c.fillStyle=glass;c.fill();c.strokeStyle='rgba(165,243,252,.82)';c.lineWidth=1.3;c.stroke();
    c.strokeStyle='rgba(226,232,240,.38)';c.lineWidth=1;c.beginPath();c.moveTo(-10,-65);c.lineTo(5,-6);c.stroke();
    var sweep=((t*.075)%650)-325;
    var highlight=c.createLinearGradient(sweep-145,-26,sweep+110,34);highlight.addColorStop(0,'rgba(255,255,255,0)');highlight.addColorStop(.36,'rgba(255,255,255,.035)');highlight.addColorStop(.59,'rgba(186,230,253,.75)');highlight.addColorStop(.78,'rgba(103,232,249,.18)');highlight.addColorStop(1,'rgba(255,255,255,0)');
    c.strokeStyle=highlight;c.lineWidth=3;c.beginPath();c.moveTo(-220,17);c.bezierCurveTo(-96,-3,96,-12,218,20);c.stroke();
    // front fascia and animated headlamp cores.
    c.fillStyle='#020617';c.beginPath();c.moveTo(205,16);c.lineTo(268,34);c.lineTo(264,48);c.lineTo(208,49);c.closePath();c.fill();
    c.save();c.shadowColor='#67e8f9';c.shadowBlur=18;c.strokeStyle='#a5f3fc';c.lineWidth=3;c.beginPath();c.moveTo(223,24);c.lineTo(262,35);c.stroke();c.restore();
    c.save();c.shadowColor='#fb7185';c.shadowBlur=14;c.strokeStyle='#fb7185';c.lineWidth=3;c.beginPath();c.moveTo(-276,34);c.lineTo(-247,29);c.stroke();c.restore();
    c.strokeStyle='rgba(103,232,249,.62)';c.lineWidth=1.6;c.beginPath();c.moveTo(-202,60);c.lineTo(205,59);c.stroke();
    // Wheel wells, rim spokes rotate continuously.
    [[-179,56],[174,55]].forEach(function(pos,index){
      c.fillStyle='#030712';c.beginPath();c.ellipse(pos[0],pos[1],43,43,0,0,Math.PI*2);c.fill();
      c.strokeStyle='#64748b';c.lineWidth=4;c.stroke();
      c.save();c.translate(pos[0],pos[1]);c.rotate(t*.0018*(scene==='acceleration'?3:1)*(index?1:-1));
      c.fillStyle='#111827';c.beginPath();c.arc(0,0,31,0,Math.PI*2);c.fill();
      c.strokeStyle='#dbeafe';c.lineWidth=2.2;
      for(var spoke=0;spoke<10;spoke++){c.save();c.rotate(spoke*Math.PI/5);c.beginPath();c.moveTo(0,-6);c.lineTo(0,-27);c.stroke();c.restore();}
      c.fillStyle='#7dd3fc';c.beginPath();c.arc(0,0,5,0,Math.PI*2);c.fill();c.restore();
    });
    c.restore();c.restore();
  }
  function cinemaTunnel(t){
    var c=cinemaCtx,w=cinemaWidth,h=cinemaHeight,cx=w*.5,cy=h*.45,span=Math.min(w,h)*.48;
    cinemaGlow(cx,cy,span*1.5,'rgba(34,211,238,ALPHA)',.14);
    for(var i=0;i<19;i++){
      var z=((i/19+t*.00038)%1),s=.08+z*2.35;
      c.save();c.translate(cx,cy);c.rotate(Math.sin(t*.00022+z*2)*.06);
      var rw=span*s,rh=span*.7*s;
      var g=c.createLinearGradient(-rw,-rh,rw,rh);g.addColorStop(0,i%3===0?'rgba(217,70,239,.8)':'rgba(103,232,249,.88)');g.addColorStop(.55,'rgba(96,165,250,.6)');g.addColorStop(1,'rgba(196,181,253,.05)');
      c.strokeStyle=g;c.lineWidth=Math.max(.6,2.3*(1-z));c.globalAlpha=Math.pow(1-z*.54,1.2);
      c.shadowColor=i%3===0?'#d946ef':'#67e8f9';c.shadowBlur=9+z*6;
      c.beginPath();c.moveTo(-rw*.8,-rh);c.quadraticCurveTo(-rw*1.08,-rh*.8,-rw,-rh*.25);c.lineTo(-rw,-rh*.25);c.quadraticCurveTo(-rw*1.08,rh*.95,-rw*.62,rh);c.lineTo(rw*.62,rh);c.quadraticCurveTo(rw*1.08,rh*.95,rw,rh*.25);c.lineTo(rw,-rh*.25);c.quadraticCurveTo(rw*1.08,-rh*.8,rw*.8,-rh);c.closePath();c.stroke();
      c.restore();
    }
    c.globalAlpha=1;c.shadowBlur=0;
    for(var ray=0;ray<44;ray++){
      var a=ray*Math.PI*2/44+t*.00035,inner=span*.08,outer=span*(.3+((ray*13)%17)/9);
      c.strokeStyle=ray%4===0?'rgba(217,70,239,.64)':'rgba(103,232,249,.45)';c.lineWidth=ray%4===0?1.4:.65;
      c.beginPath();c.moveTo(cx+Math.cos(a)*inner,cy+Math.sin(a)*inner);c.lineTo(cx+Math.cos(a)*outer,cy+Math.sin(a)*outer);c.stroke();
    }
  }
  var continentShapes=[
    [[-168,67],[-145,72],[-125,57],[-105,50],[-83,25],[-98,15],[-112,28],[-130,43],[-152,55]],
    [[-81,12],[-68,7],[-49,-4],[-36,-13],[-50,-37],[-70,-55],[-78,-30]],
    [[-10,36],[3,59],[29,70],[47,58],[39,41],[23,35],[12,22],[-6,31]],
    [[-18,36],[12,37],[34,20],[47,-11],[30,-35],[17,-34],[3,-10],[-14,4]],
    [[-10,70],[20,73],[50,59],[70,55],[94,70],[132,60],[160,52],[142,31],[114,20],[99,6],[75,9],[58,31],[41,45],[20,38],[7,55]],
    [[112,-11],[153,-12],[153,-38],[134,-43],[115,-29]],
    [[-51,80],[-25,79],[-21,61],[-43,58],[-54,69]],
    [[45,-13],[51,-22],[47,-26],[43,-18]]
  ];
  function sphereProject(lon,lat,rot,cx,cy,r){
    var phi=lat*Math.PI/180,lambda=lon*Math.PI/180+rot;
    return {x:cx+r*Math.cos(phi)*Math.sin(lambda),y:cy-r*Math.sin(phi),z:Math.cos(phi)*Math.cos(lambda)};
  }
  function cinemaGlobe(t,small){
    var c=cinemaCtx,w=cinemaWidth,h=cinemaHeight;
    var cx=w*.5,cy=h*.425,r=Math.min(w*.235,h*.285,204)*(small?.68:1),rot=t*.00025;
    cinemaGlow(cx,cy,r*2.05,'rgba(59,130,246,ALPHA)',.2);
    // orbital connections behind the globe
    c.save();c.translate(cx,cy);c.strokeStyle='rgba(125,211,252,.45)';c.lineWidth=1.1;
    for(var orb=0;orb<3;orb++){
      c.save();c.rotate([-.38,.52,1.1][orb]);c.scale(1,[.36,.23,.45][orb]);c.beginPath();c.ellipse(0,0,r*(1.42+orb*.1),r*.7,0,0,Math.PI*2);c.stroke();c.restore();
    }
    c.restore();
    var sphere=c.createRadialGradient(cx-r*.42,cy-r*.46,r*.02,cx+r*.16,cy+r*.17,r*1.25);
    sphere.addColorStop(0,'#c4b5fd');sphere.addColorStop(.18,'#60a5fa');sphere.addColorStop(.48,'#1854a7');sphere.addColorStop(.76,'#0c254f');sphere.addColorStop(1,'#030918');
    c.save();c.shadowColor='#60a5fa';c.shadowBlur=34;c.fillStyle=sphere;c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.fill();c.restore();
    c.save();c.beginPath();c.arc(cx,cy,r*.995,0,Math.PI*2);c.clip();
    // Longitudes and latitudes rotate every frame, giving a genuinely animated sphere.
    c.strokeStyle='rgba(125,211,252,.25)';c.lineWidth=.75;
    for(var k=-5;k<=5;k++){
      var lon=k*Math.PI/6+rot;
      c.beginPath();
      for(var step=0;step<=100;step++){var lat=(step/100-.5)*Math.PI,p=sphereProject(lon*180/Math.PI,lat*180/Math.PI,0,cx,cy,r);if(step===0)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y);}
      c.stroke();
    }
    for(var band=-3;band<=3;band++){
      var latitude=band*Math.PI/10,ry=Math.cos(latitude)*r,yy=cy-Math.sin(latitude)*r;
      c.beginPath();c.ellipse(cx,yy,r,ry*.19,0,0,Math.PI*2);c.stroke();
    }
    // Stylized continent silhouettes, projected to the lit hemisphere.
    continentShapes.forEach(function(shape,index){
      var points=shape.map(function(pt){return sphereProject(pt[0],pt[1],rot,cx,cy,r);});
      var centre=points.reduce(function(a,p){return a+p.z;},0)/points.length;
      if(centre<-.1)return;
      c.beginPath();var first=true;
      points.forEach(function(p){if(p.z>-.05){if(first){c.moveTo(p.x,p.y);first=false;}else c.lineTo(p.x,p.y);}});
      if(first)return;c.closePath();
      c.fillStyle=index%2?'rgba(45,212,191,.62)':'rgba(103,232,249,.68)';c.strokeStyle='rgba(207,250,254,.62)';c.lineWidth=.85;c.fill();c.stroke();
    });
    // Animated intercontinental links illuminate one by one across the rotating globe.
    var nodes=[[-74,40],[0,52],[36,-1],[77,28],[116,40],[151,-27],[-46,-16],[18,-30]];
    var visibleNodes=[];
    nodes.forEach(function(pt,i){
      var p=sphereProject(pt[0],pt[1],rot,cx,cy,r);
      if(p.z>=0)visibleNodes.push({p:p,index:i});
    });
    c.save();c.setLineDash([3,5]);c.lineDashOffset=-(t*.014)%28;c.lineWidth=1.15;
    for(var route=0;route<visibleNodes.length;route++){
      var from=visibleNodes[route],to=visibleNodes[(route+2)%visibleNodes.length];
      if(!from||!to)continue;
      var routeAlpha=.2+.34*(.5+.5*Math.sin(t*.0016+route));
      c.strokeStyle=route%3===0?'rgba(240,171,252,'+routeAlpha+')':'rgba(103,232,249,'+routeAlpha+')';
      c.beginPath();c.moveTo(from.p.x,from.p.y);
      c.quadraticCurveTo(cx+(from.p.x+to.p.x-cx)*.24,cy+(from.p.y+to.p.y-cy)*.18,to.p.x,to.p.y);c.stroke();
    }
    c.setLineDash([]);
    visibleNodes.forEach(function(item){
      var i=item.index,p=item.p,pulse=2+1.8*(.5+.5*Math.sin(t*.003+i));
      c.save();c.globalAlpha=.65+.35*(.5+.5*Math.sin(t*.002+i));c.shadowColor='#a5f3fc';c.shadowBlur=12;
      c.fillStyle='#e0f2fe';c.beginPath();c.arc(p.x,p.y,pulse,0,Math.PI*2);c.fill();
      c.strokeStyle='rgba(103,232,249,.7)';c.lineWidth=.7;c.beginPath();c.arc(p.x,p.y,pulse+3.2,0,Math.PI*2);c.stroke();c.restore();
    });
    c.restore();
    var sheen=c.createLinearGradient(cx-r,cy-r,cx+r,cy+r);sheen.addColorStop(0,'rgba(255,255,255,.2)');sheen.addColorStop(.35,'rgba(255,255,255,.02)');sheen.addColorStop(1,'rgba(0,0,0,.34)');
    c.fillStyle=sheen;c.fillRect(cx-r,cy-r,r*2,r*2);c.restore();
    c.strokeStyle='rgba(191,219,254,.7)';c.lineWidth=1.3;c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.stroke();
    cinemaGlow(cx-r*.38,cy-r*.4,r*.46,'rgba(224,242,254,ALPHA)',.12);
  }
  function paintCinemaScene(t,scene){
    var c=cinemaCtx,w=cinemaWidth,h=cinemaHeight;
    cinemaBackground(t,scene);
    if(scene==='tunnel'){cinemaTunnel(t);cinemaCar(t,scene);}
    else if(scene==='globe'){cinemaGlobe(t,false);cinemaCar(t,scene);}
    else if(scene==='reveal'){cinemaGlobe(t,true);cinemaGlow(w*.5,h*.43,Math.min(w,h)*.28,'rgba(139,92,246,ALPHA)',.16);}
    else cinemaCar(t,scene);
    if(scene==='car'||scene==='reveal'){
      for(var i=0;i<16;i++){
        var a=t*.00021+i*Math.PI/8,rad=Math.min(w,h)*(.19+(i%5)*.035),x=w*.5+Math.cos(a)*rad*1.22,y=h*.48+Math.sin(a)*rad*.62;
        c.globalAlpha=.25+.55*(.5+.5*Math.sin(t*.002+i));c.fillStyle=i%3?'#67e8f9':'#c4b5fd';c.beginPath();c.arc(x,y,1+(i%2),0,Math.PI*2);c.fill();
      }
      c.globalAlpha=1;
    }
  }
  function cinemaFrame(time){
    var overlay=$('soIntroOverlay');
    if(!overlay||overlay.hidden){cinemaFrameId=0;return;}
    if(!cinemaCtx||!cinemaCanvas||!cinemaCanvas.width)cinemaResize();
    if(!cinemaCtx){cinemaFrameId=window.requestAnimationFrame(cinemaFrame);return;}
    var now=time||performance.now(),t=now-cinemaStart,scene=overlay.dataset.scene||'car';
    paintCinemaScene(t,scene);
    // Blend from the actual outgoing rendered frame. This avoids the hard scene cuts of a slide-show.
    if(cinemaSnapshotCanvas&&cinemaSnapshotCtx&&cinemaSceneTransitionAt){
      var progress=Math.max(0,Math.min(1,(now-cinemaSceneTransitionAt)/cinemaSceneTransitionDuration));
      var eased=progress*progress*(3-2*progress);
      cinemaCtx.save();cinemaCtx.globalAlpha=1-eased;cinemaCtx.drawImage(cinemaSnapshotCanvas,0,0,cinemaWidth,cinemaHeight);cinemaCtx.restore();
      if(progress>=1){cinemaSnapshotCanvas=null;cinemaSnapshotCtx=null;cinemaSceneTransitionAt=0;}
    }
    cinemaHasFrame=true;
    var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduced){cinemaFrameId=0;return;}
    cinemaFrameId=window.requestAnimationFrame(cinemaFrame);
  }
  function startCinema(){
    cinemaCanvas=$('soCinemaCanvas');
    if(!cinemaCanvas)return;
    cinemaCtx=cinemaCanvas.getContext('2d',{alpha:false,desynchronized:true});
    cinemaResize();cinemaStart=performance.now();cinemaLastTime=cinemaStart;
    cinemaHasFrame=false;cinemaSnapshotCanvas=null;cinemaSnapshotCtx=null;cinemaSceneTransitionAt=0;
    window.addEventListener('resize',cinemaResize);
    if(cinemaFrameId)window.cancelAnimationFrame(cinemaFrameId);
    cinemaFrameId=window.requestAnimationFrame(cinemaFrame);
  }
  function stopCinema(){
    if(cinemaFrameId)window.cancelAnimationFrame(cinemaFrameId);
    cinemaFrameId=0;window.removeEventListener('resize',cinemaResize);
  }
  function closeIntro(){
    window.clearTimeout(introTimer);
    var overlay=$('soIntroOverlay');
    if(overlay){overlay.classList.add('is-leaving');window.setTimeout(function(){overlay.hidden=true;overlay.classList.remove('is-leaving');},620);}
    if(window.speechSynthesis){try{window.speechSynthesis.cancel();}catch(_){}}
    document.body.classList.remove('so-intro-open');
    stopCinema();
    if(settings.enabled&&settings.theme!=='off')startAmbient();
    var launch=document.querySelector('[data-sound-action="intro"]');if(launch)launch.focus({preventScroll:true});
  }
  function playIntro(){
    if(!settings.enabled&&!settings.userMuted){settings.enabled=true;saveSettings();wakeAudio();updateDock();}
    else if(settings.enabled)wakeAudio();
    var overlay=$('soIntroOverlay');if(!overlay)return;
    if($('soSoundPanel'))$('soSoundPanel').hidden=true;
    updateDock();
    overlay.hidden=false;overlay.classList.remove('is-leaving');document.body.classList.add('so-intro-open');
    startCinema();
    if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){renderScene(scenes.length-1);}
    else {renderScene(0);advanceIntro();}
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
