import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

(function(){
  'use strict';
  var state={
    renderer:null,scene:null,camera:null,canvas:null,car:null,model:null,
    wheels:[],ready:false,loading:null,frame:0,lastTime:0,sceneName:'car',
    sceneStart:0,baseScale:1,viewW:0,viewH:0,resizeObserver:null,
    visible:false,modelMaterials:[],shadow:null,underGlow:null,failed:false,
    globeGroup:null,globeSphere:null,globeRoutes:[],globeNodes:[],globeOrbits:[],
    tunnelGroup:null,tunnelRings:[],globeBuilt:false
  };
  var $=function(id){return document.getElementById(id);};
  var clamp=function(value,min,max){return Math.max(min,Math.min(max,value));};
  var ease=function(value){var x=clamp(value,0,1);return 1-Math.pow(1-x,3);};
  function setStatus(label,ready){
    var status=$('soCinemaStatus');
    if(!status)return;
    var text=status.querySelector('[data-so3d-status]');
    if(text)text.textContent=label;
    status.classList.toggle('is-ready',Boolean(ready));
    status.classList.toggle('is-fallback',label.indexOf('fallback')>=0);
  }
  function createGlowTexture(){
    var canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
    var ctx=canvas.getContext('2d');
    if(!ctx)return null;
    var g=ctx.createRadialGradient(64,64,2,64,64,62);
    g.addColorStop(0,'rgba(60,220,255,.58)');g.addColorStop(.3,'rgba(53,110,255,.28)');
    g.addColorStop(.66,'rgba(139,92,246,.09)');g.addColorStop(1,'rgba(3,7,22,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
    var texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
  }
  function setup(){
    state.canvas=$('soCinemaCar3d');
    if(!state.canvas)return false;
    if(state.renderer)return true;
    try{
      state.renderer=new THREE.WebGLRenderer({
        canvas:state.canvas,alpha:true,antialias:true,
        powerPreference:'high-performance',stencil:false,depth:true,preserveDrawingBuffer:false
      });
      state.renderer.setClearColor(0x000000,0);
      state.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
      state.renderer.outputColorSpace=THREE.SRGBColorSpace;
      state.renderer.toneMapping=THREE.ACESFilmicToneMapping;
      state.renderer.toneMappingExposure=1.24;
      state.renderer.setSize(Math.max(1,state.canvas.clientWidth),Math.max(1,state.canvas.clientHeight),false);
      state.scene=new THREE.Scene();
      state.camera=new THREE.PerspectiveCamera(36,1,.1,100);
      state.camera.position.set(4.55,2.65,6.9);
      state.camera.lookAt(0,.42,0);
      state.scene.add(new THREE.HemisphereLight(0xbfeeff,0x10152d,2.0));
      var key=new THREE.DirectionalLight(0xe7f4ff,4.1);key.position.set(-3.5,7,5);state.scene.add(key);
      var fill=new THREE.DirectionalLight(0x7c9bff,2.0);fill.position.set(4,3,-4);state.scene.add(fill);
      var cyan=new THREE.PointLight(0x20dff8,27,12,2);cyan.position.set(-3,.7,1.5);state.scene.add(cyan);
      var violet=new THREE.PointLight(0xb46bff,20,10,2);violet.position.set(3,1,-2.5);state.scene.add(violet);
      state.car=new THREE.Group();state.scene.add(state.car);
      buildTunnel();
      // Soft, transparent light pools provide a stylized wet-road reflection without an opaque floor.
      var glowMap=createGlowTexture();
      if(glowMap){
        state.underGlow=new THREE.Mesh(new THREE.PlaneGeometry(3.1,5.5),new THREE.MeshBasicMaterial({map:glowMap,transparent:true,opacity:.55,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
        state.underGlow.rotation.x=-Math.PI/2;state.underGlow.position.y=.024;state.underGlow.renderOrder=1;state.car.add(state.underGlow);
        state.shadow=new THREE.Mesh(new THREE.PlaneGeometry(3.0,4.9),new THREE.MeshBasicMaterial({map:glowMap,transparent:true,opacity:.65,depthWrite:false,side:THREE.DoubleSide,color:0x06122a}));
        state.shadow.rotation.x=-Math.PI/2;state.shadow.position.y=.02;state.shadow.renderOrder=0;state.car.add(state.shadow);
      }
      state.visible=true;
      if(window.ResizeObserver){
        state.resizeObserver=new ResizeObserver(function(){resize();});
        state.resizeObserver.observe(state.canvas);
      }else window.addEventListener('resize',resize);
      document.addEventListener('visibilitychange',function(){
        if(document.hidden){if(state.frame)cancelAnimationFrame(state.frame);state.frame=0;}
        else if(state.visible&&state.ready)requestFrame();
      });
      return true;
    }catch(error){
      state.failed=true;setStatus('WebGL unavailable · canvas fallback',false);
      return false;
    }
  }
  function resize(){
    if(!state.renderer||!state.canvas)return;
    var bounds=state.canvas.getBoundingClientRect(),w=Math.max(1,bounds.width),h=Math.max(1,bounds.height);
    if(w===state.viewW&&h===state.viewH)return;
    state.viewW=w;state.viewH=h;
    state.renderer.setSize(w,h,false);
    state.camera.aspect=w/h;state.camera.updateProjectionMatrix();
  }
  function tuneMaterial(material){
    if(!material)return material;
    var name=String(material.name||'').toLowerCase();
    if(/body/.test(name)){
      // Keep physically based normal detail; remove the source colour map so the paint gets a clean pearl-blue finish.
      material.map=null;
      material.color.set('#176ba6');
      material.metalness=.88;material.roughness=.19;
      material.emissive=new THREE.Color('#04182d');material.emissiveIntensity=.29;
      if('clearcoat' in material){material.clearcoat=.98;material.clearcoatRoughness=.12;}
    }else if(/hubcap/.test(name)){
      material.color.set('#78f2fb');material.metalness=.88;material.roughness=.23;
      material.emissive=new THREE.Color('#08253b');material.emissiveIntensity=.24;
    }else if(/trim_white/.test(name)){
      material.color.set('#e0e7ff');material.metalness=.55;material.roughness=.25;
    }else if(/window_glass/.test(name)){
      material.color.set('#79cfff');material.metalness=.55;material.roughness=.12;
      if('clearcoat' in material)material.clearcoat=.95;
    }else if(/rim_charcoal/.test(name)){
      material.color.set('#647c9f');material.metalness=.82;material.roughness=.28;
    }
    material.needsUpdate=true;
    return material;
  }
  function load(){
    if(state.ready)return Promise.resolve(true);
    if(state.loading)return state.loading;
    if(!setup())return Promise.resolve(false);
    setStatus('Loading 3D vehicle · preparing materials',false);
    state.loading=new Promise(function(resolve){
      var loader=new GLTFLoader();
      loader.load('/assets/studentos-sports-car.glb',function(gltf){
        try{
          state.model=gltf.scene;
          state.model.traverse(function(node){
            if(node.isMesh){
              node.castShadow=true;node.receiveShadow=true;
              if(Array.isArray(node.material))node.material=node.material.map(function(m){return tuneMaterial(m.clone());});
              else node.material=tuneMaterial(node.material.clone());
              (Array.isArray(node.material)?node.material:[node.material]).forEach(function(m){state.modelMaterials.push({material:m,opacity:m.opacity,transparent:m.transparent});});
            }
            if(/wheel/i.test(node.name||''))state.wheels.push({node:node,rotation:node.rotation.x});
          });
          var bounds=new THREE.Box3().setFromObject(state.model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
          if(!isFinite(size.x)||!isFinite(size.y)||!isFinite(size.z))throw new Error('Invalid 3D model bounds');
          state.model.position.set(-center.x,-bounds.min.y,-center.z);
          state.baseScale=4.25/Math.max(size.x,size.y,size.z);
          state.model.scale.setScalar(state.baseScale);
          // The asset's wheels and body remain independently animated in the actual 3D scene.
          state.car.add(state.model);
          addCarAccents();
          buildGlobe();
          state.ready=true;state.failed=false;
          if(state.canvas)state.canvas.classList.add('is-loaded');
          setStatus('3D vehicle online · real-time render',true);
          // Re-apply the active scene after late loading, including the globe/reveal stages.
          setScene(state.sceneName,state.sceneStart);
          resize();requestFrame();resolve(true);
        }catch(error){
          state.failed=true;setStatus('3D fallback active',false);resolve(false);
        }
      },function(progress){
        if(progress&&progress.total){var percent=Math.round(progress.loaded/progress.total*100);setStatus('Loading 3D vehicle · '+percent+'%',false);}
      },function(){
        state.failed=true;setStatus('3D model unavailable · canvas fallback',false);resolve(false);
      });
    });
    return state.loading;
  }
  function addTube(parent,points,radius,color,opacity){
    var curve=new THREE.CatmullRomCurve3(points.map(function(p){return new THREE.Vector3(p[0],p[1],p[2]);}));
    var geometry=new THREE.TubeGeometry(curve,Math.max(24,points.length*12),radius,5,false);
    var material=new THREE.MeshStandardMaterial({color:color,emissive:color,emissiveIntensity:1.15,metalness:.5,roughness:.25,transparent:opacity<1,opacity:opacity});
    var mesh=new THREE.Mesh(geometry,material);mesh.renderOrder=3;parent.add(mesh);return mesh;
  }
  function addCarAccents(){
    if(!state.model)return;
    // Fine luminous design accents follow the actual 3D body instead of replacing it with a flat drawing.
    var cyan='#67e8f9',violet='#a78bfa';
    addTube(state.model,[[-.58,.25,1.73],[-.52,.38,1.23],[-.42,.42,.48],[-.38,.39,-.5],[-.50,.31,-1.55]],.009,cyan,.93);
    addTube(state.model,[[.58,.25,1.73],[.52,.38,1.23],[.42,.42,.48],[.38,.39,-.5],[.50,.31,-1.55]],.009,cyan,.93);
    addTube(state.model,[[-.46,.47,.8],[-.28,.55,.25],[.28,.55,.25],[.46,.47,.8]],.006,violet,.85);
    addTube(state.model,[[-.72,.18,1.67],[-.89,.13,.8],[-.9,.13,-.8],[-.72,.18,-1.57]],.008,violet,.7);
    var lampMaterial=new THREE.MeshStandardMaterial({color:cyan,emissive:cyan,emissiveIntensity:4.0,roughness:.15,metalness:.1});
    [[-.57,.29,1.86],[.57,.29,1.86]].forEach(function(pos){
      var lamp=new THREE.Mesh(new THREE.SphereGeometry(.038,16,12),lampMaterial);
      lamp.position.set(pos[0],pos[1],pos[2]);state.model.add(lamp);
    });
  }
  function createEarthTexture(){
    var canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;
    var c=canvas.getContext('2d');if(!c)return null;
    var bg=c.createLinearGradient(0,0,0,1024);bg.addColorStop(0,'#07152d');bg.addColorStop(.48,'#0a3c67');bg.addColorStop(1,'#06162d');
    c.fillStyle=bg;c.fillRect(0,0,2048,1024);
    var oceanGlow=c.createRadialGradient(1024,480,20,1024,480,900);oceanGlow.addColorStop(0,'rgba(47,140,214,.28)');oceanGlow.addColorStop(1,'rgba(4,18,42,0)');
    c.fillStyle=oceanGlow;c.fillRect(0,0,2048,1024);
    c.strokeStyle='rgba(125,211,252,.15)';c.lineWidth=1;
    for(var lat=-75;lat<=75;lat+=15){var y=(90-lat)/180*1024;c.beginPath();c.moveTo(0,y);c.lineTo(2048,y);c.stroke();}
    for(var lon=-180;lon<180;lon+=15){var x=(lon+180)/360*2048;c.beginPath();c.moveTo(x,0);c.lineTo(x,1024);c.stroke();}
    var land=[
      [[-168,70],[-144,72],[-125,56],[-110,50],[-96,27],[-81,8],[-99,18],[-116,32],[-131,47],[-153,57]],
      [[-80,10],[-66,6],[-52,-2],[-35,-12],[-46,-35],[-70,-56],[-78,-31]],
      [[-12,36],[-8,58],[14,70],[36,59],[44,44],[30,35],[17,22],[3,31]],
      [[-17,36],[8,37],[33,20],[48,-11],[35,-34],[20,-35],[5,-14],[-12,5]],
      [[28,70],[55,61],[75,55],[93,73],[128,60],[160,53],[145,33],[116,18],[104,2],[79,8],[60,29],[40,38]],
      [[112,-11],[153,-11],[153,-38],[133,-44],[115,-30]],
      [[-53,82],[-24,80],[-19,61],[-43,58],[-55,70]],
      [[43,-13],[51,-20],[47,-26],[43,-18]]
    ];
    land.forEach(function(poly,index){
      c.beginPath();
      poly.forEach(function(pt,i){var x=(pt[0]+180)/360*2048,y=(90-pt[1])/180*1024;if(i)c.lineTo(x,y);else c.moveTo(x,y);});
      c.closePath();
      var g=c.createLinearGradient(0,220+index*12,2048,810-index*8);
      g.addColorStop(0,'#0f766e');g.addColorStop(.36,'#2dd4bf');g.addColorStop(.72,'#38bdf8');g.addColorStop(1,'#0f766e');
      c.fillStyle=g;c.fill();c.strokeStyle='rgba(167,243,252,.88)';c.lineWidth=2;c.stroke();
      // fine, irregular interior lines create the impression of terrain and coast detail.
      c.save();c.clip();c.strokeStyle='rgba(204,251,241,.24)';c.lineWidth=1.5;
      for(var k=0;k<5;k++){c.beginPath();var x0=(poly[k%poly.length][0]+180)/360*2048,y0=(90-poly[k%poly.length][1])/180*1024;c.moveTo(x0,y0);c.bezierCurveTo(x0+24+k*13,y0-31,x0-35+k*17,y0+36,x0+42,y0+50);c.stroke();}
      c.restore();
    });
    // Daylight sheen and polar aurora cap.
    var aura=c.createLinearGradient(0,0,0,240);aura.addColorStop(0,'rgba(103,232,249,.24)');aura.addColorStop(1,'rgba(103,232,249,0)');c.fillStyle=aura;c.fillRect(0,0,2048,240);
    var v=c.createLinearGradient(0,790,0,1024);v.addColorStop(0,'rgba(167,139,250,0)');v.addColorStop(1,'rgba(139,92,246,.14)');c.fillStyle=v;c.fillRect(0,790,2048,234);
    var tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;tex.needsUpdate=true;return tex;
  }
  function earthPoint(lon,lat,radius){
    var a=lat*Math.PI/180,b=lon*Math.PI/180,cos=Math.cos(a);
    return new THREE.Vector3(radius*cos*Math.sin(b),radius*Math.sin(a),radius*cos*Math.cos(b));
  }
  function buildGlobe(){
    if(state.globeBuilt)return;
    state.globeGroup=new THREE.Group();state.globeGroup.position.set(0,.24,0);state.scene.add(state.globeGroup);
    var radius=1.34,earthTexture=createEarthTexture();
    var earthMaterial=new THREE.MeshPhysicalMaterial({
      map:earthTexture,color:0xffffff,metalness:.19,roughness:.48,clearcoat:.4,clearcoatRoughness:.34,
      emissive:new THREE.Color('#07152f'),emissiveIntensity:.36
    });
    state.globeSphere=new THREE.Mesh(new THREE.SphereGeometry(radius,112,80),earthMaterial);
    state.globeSphere.rotation.y=Math.PI*.05;
    state.globeSphere.renderOrder=1;state.globeGroup.add(state.globeSphere);
    var atmosphere=new THREE.Mesh(new THREE.SphereGeometry(radius*1.045,88,64),new THREE.MeshBasicMaterial({color:0x38bdf8,side:THREE.BackSide,transparent:true,opacity:.20,blending:THREE.AdditiveBlending,depthWrite:false}));
    state.globeGroup.add(atmosphere);
    var outerAtmos=new THREE.Mesh(new THREE.SphereGeometry(radius*1.09,64,48),new THREE.MeshBasicMaterial({color:0x8b5cf6,side:THREE.BackSide,transparent:true,opacity:.07,blending:THREE.AdditiveBlending,depthWrite:false}));
    state.globeGroup.add(outerAtmos);
    var rings=[
      {rotation:[.34,.15,-.42],scale:[1.52,.47,1],radius:radius*1.25,color:0x67e8f9,opacity:.72},
      {rotation:[1.17,.6,.16],scale:[1.5,.30,1],radius:radius*1.35,color:0xa78bfa,opacity:.62},
      {rotation:[.65,-.35,.85],scale:[1.75,.18,1],radius:radius*1.43,color:0xf0abfc,opacity:.36}
    ];
    rings.forEach(function(item){
      var ring=new THREE.Mesh(new THREE.TorusGeometry(item.radius,.0065,7,240),new THREE.MeshBasicMaterial({color:item.color,transparent:true,opacity:item.opacity,depthWrite:false,blending:THREE.AdditiveBlending}));
      ring.rotation.set(item.rotation[0],item.rotation[1],item.rotation[2]);ring.scale.set(item.scale[0],item.scale[1],item.scale[2]);state.globeGroup.add(ring);state.globeOrbits.push(ring);
    });
    var destinations=[
      [-74,40],[0,52],[36,-1],[77,28],[116,40],[151,-27],[-46,-16],[18,-30],[139,36],[-3,6]
    ];
    destinations.forEach(function(point,index){
      var onEarth=earthPoint(point[0],point[1],radius*1.008);
      var node=new THREE.Mesh(new THREE.SphereGeometry(.026,14,10),new THREE.MeshBasicMaterial({color:index%3===0?0xf0abfc:0x99f6e4}));
      node.position.copy(onEarth);state.globeGroup.add(node);
      var halo=new THREE.Mesh(new THREE.SphereGeometry(.052,12,9),new THREE.MeshBasicMaterial({color:index%3===0?0xd946ef:0x22d3ee,transparent:true,opacity:.17,depthWrite:false,blending:THREE.AdditiveBlending}));
      halo.position.copy(onEarth);state.globeGroup.add(halo);
      state.globeNodes.push({node:node,halo:halo,index:index,point:point});
    });
    var routes=[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,0],[1,8],[7,2],[9,1],[4,8]];
    routes.forEach(function(pair,index){
      var p1=earthPoint(destinations[pair[0]][0],destinations[pair[0]][1],radius*1.02);
      var p2=earthPoint(destinations[pair[1]][0],destinations[pair[1]][1],radius*1.02);
      var mid=p1.clone().add(p2).normalize().multiplyScalar(radius*(1.13+(index%4)*.09));
      var curve=new THREE.QuadraticBezierCurve3(p1,mid,p2);
      var geo=new THREE.BufferGeometry().setFromPoints(curve.getPoints(72));
      var mat=new THREE.LineDashedMaterial({color:index%4===0?0xe879f9:0x67e8f9,dashSize:.045,gapSize:.035,transparent:true,opacity:.8,depthWrite:false});
      var line=new THREE.Line(geo,mat);line.computeLineDistances();line.renderOrder=3;state.globeGroup.add(line);
      var pulse=new THREE.Mesh(new THREE.SphereGeometry(.022,10,8),new THREE.MeshBasicMaterial({color:0xffffff}));
      pulse.userData={route:line,phase:index*.071,curve:curve};state.globeGroup.add(pulse);
      state.globeRoutes.push({line:line,material:mat,pulse:pulse,curve:curve,phase:index*.071});
    });
    var cloud=new THREE.Mesh(new THREE.SphereGeometry(radius*1.015,72,48),new THREE.MeshBasicMaterial({color:0x0ea5e9,transparent:true,opacity:.04,wireframe:true,depthWrite:false}));
    cloud.scale.set(1.002,1.002,1.002);state.globeGroup.add(cloud);
    state.globeGroup.visible=false;state.globeBuilt=true;
  }
  function buildTunnel(){
    state.tunnelGroup=new THREE.Group();state.scene.add(state.tunnelGroup);
    for(var i=0;i<17;i++){
      var color=i%4===0?0xe879f9:i%3===0?0xa78bfa:0x67e8f9;
      var ring=new THREE.Mesh(new THREE.TorusGeometry(2.65+(i%3)*.11,.012+(i%4)*.002,6,96),new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:.32+(i%4)*.1,blending:THREE.AdditiveBlending,depthWrite:false}));
      ring.position.set(Math.sin(i*1.7)*.23,.2+Math.cos(i*1.2)*.18,-i*1.15);
      ring.rotation.z=Math.sin(i*1.5)*.035;ring.rotation.y=Math.cos(i*1.2)*.06;
      state.tunnelGroup.add(ring);state.tunnelRings.push({mesh:ring,baseZ:ring.position.z,index:i});
    }
    // Axial laser rails add near-field parallax while the torus frames rush past.
    for(var side=-1;side<=1;side+=2){
      var pts=[];for(var z=3;z>=-19;z-=1.5)pts.push([side*(1.95+Math.sin(z*.4)*.12),.2+Math.sin(z*.5)*.1,z]);
      addTube(state.tunnelGroup,pts,.009,side>0?'#22d3ee':'#d946ef',.7);
    }
    state.tunnelGroup.visible=false;
  }
  function setScene(name,startedAt){
    state.sceneName=name||'car';state.sceneStart=Number(startedAt)||performance.now();
    var carVisible=['car','acceleration','tunnel'].indexOf(state.sceneName)>=0;
    var globeVisible=['globe','reveal'].indexOf(state.sceneName)>=0;
    if(state.canvas)state.canvas.style.opacity=(carVisible||globeVisible)&&state.ready?'1':'0';
    if(state.car)state.car.visible=carVisible;
    if(state.globeGroup)state.globeGroup.visible=globeVisible;
    if(state.tunnelGroup)state.tunnelGroup.visible=state.sceneName==='tunnel';
    if(carVisible||globeVisible)state.visible=true;
    else state.visible=false;
    if((carVisible||globeVisible)&&state.ready&&!document.hidden)requestFrame();
    else if(state.frame){cancelAnimationFrame(state.frame);state.frame=0;}
  }
  function animate(now){
    state.frame=0;
    if(!state.renderer||!state.ready||!state.car||!state.visible||document.hidden)return;
    resize();
    var name=state.sceneName,elapsed=Math.max(0,now-state.sceneStart),seconds=now*.001;
    var carActive=['car','acceleration','tunnel'].indexOf(name)>=0;
    var globeActive=['globe','reveal'].indexOf(name)>=0;
    state.car.visible=carActive; if(state.globeGroup)state.globeGroup.visible=globeActive;
    if(state.tunnelGroup)state.tunnelGroup.visible=name==='tunnel';
    var camPos=new THREE.Vector3(3.35,2.0,5.65);
    var target=new THREE.Vector3(0,.37,0);
    if(name==='tunnel'){camPos.set(0,.65,6.5);target.set(0,.3,-4.5);}
    if(globeActive){
      var globep=clamp(elapsed/(name==='reveal'?1200:1250),0,1),ge=ease(globep);
      camPos.set(0,.24,6.55);target.set(0,.24,0);
      state.globeGroup.scale.setScalar(name==='globe'?.15+.90*ge:1.0+.13*ge);
      state.globeGroup.rotation.y=seconds*.115;
      state.globeGroup.rotation.x=.035+Math.sin(seconds*.23)*.018;
      state.globeOrbits.forEach(function(orbit,index){
        orbit.rotation.y+=.0007*(index%2?-1:1);
        orbit.material.opacity=(index===2?.28:.52)+.2*(.5+.5*Math.sin(seconds*1.3+index));
      });
      state.globeNodes.forEach(function(item){
        var pulse=.85+.25*(.5+.5*Math.sin(seconds*2.2+item.index));
        item.node.scale.setScalar(pulse);item.halo.scale.setScalar(1.0+.34*(.5+.5*Math.sin(seconds*2+item.index)));
      });
      state.globeRoutes.forEach(function(route,index){
        route.material.dashOffset=-seconds*1.5-route.phase*2;
        route.material.opacity=.43+.35*(.5+.5*Math.sin(seconds*1.5+index));
        var u=(seconds*.075+route.phase)%1;
        route.pulse.position.copy(route.curve.getPoint(u));
        route.pulse.visible=u<.985;
      });
    }
    if(carActive){
      var p=clamp(elapsed/(name==='tunnel'?2050:1700),0,1),e=ease(p);
      state.car.rotation.x=Math.sin(seconds*.8)*.008;
      state.car.position.y=.015+Math.sin(seconds*2.0)*.018;
      state.car.position.x=0;state.car.position.z=0;
      state.car.scale.setScalar(state.baseScale);
      if(name==='car'){
        state.car.scale.setScalar(state.baseScale*(.70+.37*e));
        state.car.position.x=-.11+.04*e;state.car.position.z=.10*e;
        state.car.rotation.y=-.26+Math.sin(seconds*.55)*.02;
      }else if(name==='acceleration'){
        state.car.scale.setScalar(state.baseScale*(1.05+.12*e));
        state.car.position.x=-.2+1.28*e;state.car.position.z=.15+.8*e;
        state.car.rotation.y=-.2-.12*e+Math.sin(seconds*2)*.016;state.car.rotation.z=-.015-.035*e;
      }else if(name==='tunnel'){
        state.car.scale.setScalar(state.baseScale*(1.02+.22*e));
        state.car.position.x=Math.sin(seconds*1.4)*.055*(1-p);state.car.position.z=-.25-4.7*e;
        state.car.rotation.y=-.19+Math.sin(seconds*1.3)*.025*(1-p);state.car.rotation.z=Math.sin(seconds*1.6)*.009*(1-p);
      }
      var spin=now*.001*(name==='acceleration'?3.7:name==='tunnel'?2.2:1.15);
      state.wheels.forEach(function(item,index){item.node.rotation.x=item.rotation+spin*(index%2?-1:1);});
      if(state.underGlow){state.underGlow.material.opacity=.39+.12*(.5+.5*Math.sin(seconds*2.3));state.underGlow.position.x=state.car.position.x;}
      if(state.shadow){state.shadow.material.opacity=.48+.1*(.5+.5*Math.sin(seconds*2.0));state.shadow.position.x=state.car.position.x;state.shadow.scale.set(1+e*.08,1+e*.08,1);}
      if(name==='car'){camPos.set(3.35,2.0,5.65);target.set(0,.37,0);}
      if(name==='acceleration'){camPos.set(3.45+e*.2,2.05,5.85);target.set(state.car.position.x*.38,.33,-.1);}
      if(name==='tunnel'){camPos.set(0,.9,6.8);target.set(0,.22,-2.9);}
    }
    state.camera.position.lerp(camPos,.085);
    state.camera.lookAt(target);
    state.camera.fov=globeActive?32:36;state.camera.updateProjectionMatrix();
    if(state.tunnelGroup&&name==='tunnel'){
      state.tunnelRings.forEach(function(item){
        var z=((item.baseZ+((seconds*9.5)%19.55)+19.55)%19.55)-19.55;
        item.mesh.position.z=z;
        item.mesh.rotation.x=Math.sin(seconds*.35+item.index)*.045;
        item.mesh.rotation.y=Math.cos(seconds*.28+item.index)*.06;
        item.mesh.material.opacity=.20+.42*(.5+.5*Math.sin(seconds*2.1-item.index*.5));
      });
      state.tunnelGroup.children.forEach(function(node){if(node.type==='Mesh'&&node.geometry&&node.geometry.type==='TubeGeometry')node.material.opacity=.48+.3*(.5+.5*Math.sin(seconds*1.7));});
    }
    state.renderer.render(state.scene,state.camera);
    if(!window.matchMedia||!window.matchMedia('(prefers-reduced-motion: reduce)').matches)state.frame=requestAnimationFrame(animate);
  }
  function requestFrame(){
    if(state.frame||!state.ready||document.hidden)return;
    state.frame=requestAnimationFrame(animate);
  }
  window.StudentOS3D={
    load:load,
    isReady:function(){return state.ready;},
    setScene:setScene,
    resize:resize,
    isFailed:function(){return state.failed;},
    hasGlobe:function(){return state.globeBuilt;}
  };
})();
