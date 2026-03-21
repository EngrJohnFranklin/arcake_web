(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))s(r);new MutationObserver(r=>{for(const o of r)if(o.type==="childList")for(const i of o.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&s(i)}).observe(document,{childList:!0,subtree:!0});function n(r){const o={};return r.integrity&&(o.integrity=r.integrity),r.referrerPolicy&&(o.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?o.credentials="include":r.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function s(r){if(r.ep)return;r.ep=!0;const o=n(r);fetch(r.href,o)}})();const F="modulepreload",W=function(e,t){return new URL(e,t).href},P={},E=function(t,n,s){if(!n||n.length===0)return t();const r=document.getElementsByTagName("link");return Promise.all(n.map(o=>{if(o=W(o,s),o in P)return;P[o]=!0;const i=o.endsWith(".css"),a=i?'[rel="stylesheet"]':"";if(!!s)for(let p=r.length-1;p>=0;p--){const h=r[p];if(h.href===o&&(!i||h.rel==="stylesheet"))return}else if(document.querySelector(`link[href="${o}"]${a}`))return;const d=document.createElement("link");if(d.rel=i?"stylesheet":F,i||(d.as="script",d.crossOrigin=""),d.href=o,document.head.appendChild(d),i)return new Promise((p,h)=>{d.addEventListener("load",p),d.addEventListener("error",()=>h(new Error(`Unable to preload CSS for ${o}`)))})})).then(()=>t()).catch(o=>{const i=new Event("vite:preloadError",{cancelable:!0});if(i.payload=o,window.dispatchEvent(i),!i.defaultPrevented)throw o})};class I{constructor({onDetected:t,onError:n}){this.onDetected=t,this.onError=n,this._lastShape=null,this._consecutiveHits=0,this._confirmed=!1,this.REQUIRED_HITS=3,this._intervalId=null,this._tipTimeoutId=null,this.stream=null,this._container=null,this._video=null,this._canvas=null,this._ctx=null,this._finder=null,this._statusLabel=null}async start(){this._buildUI();try{this.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment",width:640,height:480}})}catch{this.onError("Camera access denied. Please allow camera permissions and try again."),this.stop();return}this._video.srcObject=this.stream,await this._video.play(),this._intervalId=setInterval(()=>this._scanFrame(),600),this._tipTimeoutId=setTimeout(()=>{this._confirmed||(this._statusLabel.textContent="Tip: hold camera directly above the cake for best results")},3e4)}stop(){clearInterval(this._intervalId),clearTimeout(this._tipTimeoutId),this.stream&&(this.stream.getTracks().forEach(t=>t.stop()),this.stream=null),this._container&&this._container.parentNode&&this._container.remove()}_buildUI(){const t=document.createElement("div");t.style.cssText="position:fixed;inset:0;background:#000;z-index:9999;display:flex;align-items:center;justify-content:center;",this._container=t;const n=document.createElement("video");n.setAttribute("playsinline",""),n.setAttribute("muted",""),n.style.cssText="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;",this._video=n,t.appendChild(n);const s=document.createElement("div");s.style.cssText="position:absolute;width:260px;height:260px;border:2.5px dashed rgba(255,255,255,0.75);border-radius:16px;transition:border-color 0.35s ease;pointer-events:none;",this._finder=s,t.appendChild(s);const r=document.createElement("div");r.textContent="Point camera at your cake",r.style.cssText="position:absolute;bottom:110px;background:rgba(0,0,0,0.50);color:#fff;font-size:15px;padding:8px 20px;border-radius:20px;pointer-events:none;",this._statusLabel=r,t.appendChild(r);const o=document.createElement("button");o.textContent="← Back",o.style.cssText="position:absolute;top:22px;left:18px;background:rgba(255,255,255,0.15);color:#fff;border:none;border-radius:20px;padding:8px 18px;font-size:14px;cursor:pointer;",o.addEventListener("click",()=>{this.stop()}),t.appendChild(o);const i=document.createElement("div");i.textContent="Scan your cake",i.style.cssText="position:absolute;top:30px;color:#fff;font-size:16px;font-weight:600;pointer-events:none;",t.appendChild(i);const a=document.createElement("button");a.textContent="Select shape manually instead",a.style.cssText="position:absolute;bottom:68px;background:none;border:none;color:rgba(255,255,255,0.55);font-size:13px;text-decoration:underline;cursor:pointer;",a.addEventListener("click",()=>{this.stop(),this.onDetected(null)}),t.appendChild(a);const u=document.createElement("canvas");u.width=320,u.height=240,u.style.display="none",this._canvas=u,this._ctx=u.getContext("2d"),t.appendChild(u),document.body.appendChild(t)}_scanFrame(){if(this._confirmed||this._video.readyState<2)return;const t=320,n=240;this._canvas.width=t,this._canvas.height=n,this._ctx.drawImage(this._video,0,0,t,n);const s=this._detectShape(this._ctx,t,n);this._handleDetection(s)}_detectShape(t,n,s){const o=t.getImageData(0,0,n,s).data,i=new Uint8Array(n*s);for(let c=0;c<n*s;c++){const l=c*4;i[c]=.299*o[l]+.587*o[l+1]+.114*o[l+2]}const a=new Uint8Array(n*s),u=30;for(let c=1;c<s-1;c++)for(let l=1;l<n-1;l++){const f=i[(c-1)*n+(l-1)],g=i[(c-1)*n+l],v=i[(c-1)*n+(l+1)],x=i[c*n+(l-1)],k=i[c*n+(l+1)],q=i[(c+1)*n+(l-1)],Y=i[(c+1)*n+l],R=i[(c+1)*n+(l+1)],B=-f+v-2*x+2*k-q+R,D=-f-2*g-v+q+2*Y+R;a[c*n+l]=Math.sqrt(B*B+D*D)>u?255:0}let d=n,p=0,h=s,b=0,$=0;for(let c=0;c<s;c++)for(let l=0;l<n;l++)a[c*n+l]===255&&($++,l<d&&(d=l),l>p&&(p=l),c<h&&(h=c),c>b&&(b=c));if($<500)return null;const y=p-d,_=b-h;if(y<60||_<60)return null;const C=y/_;if(_>y*1.35)return"layered";const z=Math.min(y,_)*.18,T=[{cx:d,cy:h},{cx:p,cy:h},{cx:d,cy:b},{cx:p,cy:b}];let A=0;for(let c=0;c<s;c++)for(let l=0;l<n;l++)if(a[c*n+l]===255)for(let f=0;f<4;f++){const g=l-T[f].cx,v=c-T[f].cy;if(Math.sqrt(g*g+v*v)<=z){A++;break}}const X=A/$;if(C>=.82&&C<=1.22&&X>.18)return"square";if(C>=.75&&C<=1.35){const c=Math.floor(_*.22),l=Math.floor(d+y*.35),f=Math.floor(d+y*.65);let g=0;for(let x=h;x<h+c;x++)for(let k=l;k<=f;k++)a[x*n+k]===255&&g++;if(g/(c*(f-l))<.04)return"heart"}return"round"}_handleDetection(t){const n={round:"Round",square:"Square",heart:"Heart",layered:"Layered"};if(t===null){this._lastShape=null,this._consecutiveHits=0,this._statusLabel.textContent="Point camera at your cake",this._finder.style.borderColor="rgba(255,255,255,0.75)";return}t===this._lastShape?this._consecutiveHits++:(this._lastShape=t,this._consecutiveHits=1),this._statusLabel.textContent=`Scanning… looks like a ${n[t]} cake`,this._consecutiveHits>=this.REQUIRED_HITS&&(this._confirmed=!0,clearInterval(this._intervalId),this._finder.style.borderColor="#4CAF50",this._statusLabel.textContent=`${n[t]} cake detected!`,setTimeout(()=>this._showConfirmCard(t),450))}_showConfirmCard(t){const n={round:`<circle cx="36" cy="36" r="26"
        fill="none" stroke="#E91E8C" stroke-width="3"/>`,square:`<rect x="10" y="10" width="52" height="52" rx="6"
        fill="none" stroke="#E91E8C" stroke-width="3"/>`,heart:`<path d="M36 58C10 40 6 14 20 10C28 8 36 18 36 18
               C36 18 44 8 52 10C66 14 62 40 36 58Z"
        fill="none" stroke="#E91E8C" stroke-width="3"/>`,layered:`<ellipse cx="36" cy="50" rx="26" ry="11"
        fill="none" stroke="#E91E8C" stroke-width="2.5"/>
      <ellipse cx="36" cy="28" rx="18" ry="9"
        fill="none" stroke="#E91E8C" stroke-width="2.5"/>`},r={round:"Round",square:"Square",heart:"Heart",layered:"Layered"}[t],o=n[t],i=document.createElement("div");i.style.cssText="position:absolute;bottom:0;left:0;right:0;background:#fff;border-radius:20px 20px 0 0;padding:28px 24px 40px;text-align:center;box-shadow:0 -4px 24px rgba(0,0,0,0.15);",i.innerHTML=`
      <svg width="72" height="72" viewBox="0 0 72 72"
        xmlns="http://www.w3.org/2000/svg"
        style="display:block;margin:0 auto 16px;">
        ${o}
      </svg>
      <p style="margin:0 0 6px;font-size:20px;font-weight:600;color:#1a1a1a">
        We found a ${r} cake
      </p>
      <p style="margin:0 0 24px;font-size:14px;color:#888">
        This shape will be pre-selected in your customizer
      </p>
      <button id="cs-confirm" style="
        display:block;width:100%;padding:14px;
        background:#E91E8C;color:#fff;border:none;
        border-radius:12px;font-size:16px;font-weight:600;
        cursor:pointer;margin-bottom:10px">
        Looks right!
      </button>
      <button id="cs-rescan" style="
        display:block;width:100%;padding:12px;
        background:transparent;color:#888;
        border:1px solid #ddd;border-radius:12px;
        font-size:15px;cursor:pointer">
        Try again
      </button>
    `,i.querySelector("#cs-confirm").addEventListener("click",()=>{this.stop(),this.onDetected(t)}),i.querySelector("#cs-rescan").addEventListener("click",()=>{i.remove(),this._confirmed=!1,this._lastShape=null,this._consecutiveHits=0,this._finder.style.borderColor="rgba(255,255,255,0.75)",this._statusLabel.textContent="Point camera at your cake",this._intervalId=setInterval(()=>this._scanFrame(),600)}),this._container.appendChild(i)}}class Q{constructor(t,n,s){this._state=t,this._onBack=n,this._onSaveScreenshot=s||null,this._stream=null,this._cakeScene=null,this._container=null,this._video=null,this._canvas=null,this._drag={active:!1,startX:0,startY:0},this._offset={x:0,y:0},this._pinch={active:!1,startDist:0,startScale:1},this._scale=1,this._onResize=null}async open(){this._buildUI(),await this._startCamera(),await this._buildCakeScene(),this._startRenderSupport()}_buildUI(){this._container=document.createElement("div"),this._container.className="ar-container",this._video=document.createElement("video"),this._video.className="ar-video",this._video.setAttribute("autoplay",""),this._video.setAttribute("muted",""),this._video.setAttribute("playsinline",""),this._canvas=document.createElement("canvas"),this._canvas.className="ar-canvas";const t=document.createElement("div");t.className="ar-top-bar",t.innerHTML=`
      <button class="ar-top-btn" id="ar-edit-btn">← Edit</button>
      <span>AR Preview</span>
      <button class="ar-top-btn" id="ar-shot-btn">Screenshot</button>
    `;const n=document.createElement("div");n.className="ar-hint",n.textContent="Drag to reposition  ·  Pinch to resize";const s=document.createElement("div");s.className="ar-bottom-bar",s.innerHTML=`
      <button class="sf-btn-primary" id="ar-done-btn"
        style="flex:1;margin:0">Done</button>
    `,this._container.append(this._video,this._canvas,t,n,s),document.body.appendChild(this._container),this._container.querySelector("#ar-edit-btn").onclick=()=>this._close(),this._container.querySelector("#ar-done-btn").onclick=()=>this._close(),this._container.querySelector("#ar-shot-btn").onclick=()=>this._takeShot(),this._attachInteraction()}async _startCamera(){try{this._stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment",width:1280,height:720}}),this._video.srcObject=this._stream,await this._video.play()}catch{this._video.style.display="none",this._container.style.background="#1a1a2e"}}async _buildCakeScene(){const t=window.innerWidth,n=window.innerHeight;this._canvas.width=t,this._canvas.height=n;const{CakeScene:s}=await E(()=>import("./cake-B-OTjfso.js"),__vite__mapDeps([]),import.meta.url);this._cakeScene=new s(this._canvas,{autoRotate:!0,interactive:!1,transparent:!0,float:!0,rotateSpeed:.8}),this._cakeScene.buildCake(this._state),this._applyTransform()}_startRenderSupport(){this._onResize=()=>{this._canvas.width=window.innerWidth,this._canvas.height=window.innerHeight},window.addEventListener("resize",this._onResize)}_applyTransform(){this._canvas.style.transform=`translate(${this._offset.x}px, ${this._offset.y}px) scale(${this._scale})`,this._canvas.style.transformOrigin="center center"}_attachInteraction(){const t=this._canvas;t.addEventListener("mousedown",n=>{this._drag.active=!0,this._drag.startX=n.clientX-this._offset.x,this._drag.startY=n.clientY-this._offset.y}),window.addEventListener("mousemove",n=>{this._drag.active&&(this._offset.x=n.clientX-this._drag.startX,this._offset.y=n.clientY-this._drag.startY,this._applyTransform())}),window.addEventListener("mouseup",()=>{this._drag.active=!1}),t.addEventListener("touchstart",n=>{n.touches.length===1&&(this._drag.active=!0,this._drag.startX=n.touches[0].clientX-this._offset.x,this._drag.startY=n.touches[0].clientY-this._offset.y),n.touches.length===2&&(this._drag.active=!1,this._pinch.active=!0,this._pinch.startDist=H(n.touches),this._pinch.startScale=this._scale)},{passive:!0}),t.addEventListener("touchmove",n=>{if(this._drag.active&&n.touches.length===1&&(this._offset.x=n.touches[0].clientX-this._drag.startX,this._offset.y=n.touches[0].clientY-this._drag.startY,this._applyTransform()),this._pinch.active&&n.touches.length===2){const r=H(n.touches)/this._pinch.startDist;this._scale=Math.min(3.5,Math.max(.4,this._pinch.startScale*r)),this._applyTransform()}},{passive:!0}),t.addEventListener("touchend",()=>{this._drag.active=!1,this._pinch.active=!1})}_takeShot(){const t=window.innerWidth,n=window.innerHeight,s=document.createElement("canvas");s.width=t,s.height=n;const r=s.getContext("2d");this._stream&&this._video.readyState>=2?r.drawImage(this._video,0,0,t,n):(r.fillStyle="#1a1a2e",r.fillRect(0,0,t,n)),r.save(),r.translate(t/2+this._offset.x,n/2+this._offset.y),r.scale(this._scale,this._scale),r.drawImage(this._canvas,-t/2,-n/2,t,n),r.restore();const o=s.toDataURL("image/png"),i=document.createElement("a");i.href=o,i.download=`my-cake-ar-${Date.now()}.png`,i.click(),this._onSaveScreenshot&&this._onSaveScreenshot(o)}_close(){this._onResize&&window.removeEventListener("resize",this._onResize),this._stream&&(this._stream.getTracks().forEach(t=>t.stop()),this._stream=null),this._cakeScene&&typeof this._cakeScene.dispose=="function"&&this._cakeScene.dispose(),this._container&&this._container.remove(),this._onBack&&this._onBack()}}function H(e){const t=e[0].clientX-e[1].clientX,n=e[0].clientY-e[1].clientY;return Math.sqrt(t*t+n*n)}const S={round:"Round",square:"Square",heart:"Heart",layered:"Layered"},M={round:e=>{const t=e*.36,n=e/2;return`<circle cx="${n}" cy="${n}" r="${t}" fill="none" stroke="#E91E8C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="${n-6},${n} ${n-2},${n+4} ${n+6},${n-4}" fill="none" stroke="#E91E8C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`},square:e=>{const t=Math.round(e*.14),n=e-t*2,s=e/2;return`<rect x="${t}" y="${t}" width="${n}" height="${n}" rx="4" fill="none" stroke="#E91E8C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="${s-6},${s} ${s-2},${s+4} ${s+6},${s-4}" fill="none" stroke="#E91E8C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`},heart:e=>{const t=e/2;return`<path d="M${t} ${e*.83}C${e*.11} ${e*.56} ${e*.08} ${e*.19} ${e*.28} ${e*.14}C${e*.39} ${e*.11} ${t} ${e*.28} ${t} ${e*.28}C${t} ${e*.28} ${e*.61} ${e*.11} ${e*.72} ${e*.14}C${e*.92} ${e*.19} ${e*.89} ${e*.56} ${t} ${e*.83}Z" fill="none" stroke="#E91E8C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="${t-6},${t-1} ${t-2},${t+3} ${t+7},${t-5}" fill="none" stroke="#E91E8C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`},layered:e=>{const t=e/2;return`<ellipse cx="${t}" cy="${e*.72}" rx="${e*.36}" ry="${e*.17}" fill="none" stroke="#E91E8C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <ellipse cx="${t}" cy="${e*.39}" rx="${e*.25}" ry="${e*.14}" fill="none" stroke="#E91E8C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="${t-7},${t-1} ${t-3},${t+3} ${t+5},${t-5}" fill="none" stroke="#E91E8C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`}},G=`<svg width="36" height="36" viewBox="0 0 36 36"
  fill="none" stroke="#E91E8C" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="8" width="32" height="22" rx="4"/>
  <circle cx="18" cy="19" r="6"/>
  <path d="M12 8l2-4h8l2 4"/>
</svg>`;function U(e,t){const n=(M[e]||M.round)(t);return`<svg width="${t}" height="${t}" viewBox="0 0 ${t} ${t}"
    fill="none" xmlns="http://www.w3.org/2000/svg">${n}</svg>`}function V(e,t){J(e,t)}function J(e,t){const n=S[e]||e,s=document.createElement("div");s.style.cssText="position:fixed;inset:0;z-index:8500;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;";const r=document.createElement("div");r.style.cssText="background:#fff;border-radius:20px;padding:28px 24px 24px;width:min(380px,90vw);text-align:center;box-shadow:0 8px 40px rgba(0,0,0,0.18);",r.innerHTML=`
    <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a1a1a">
      Detect shape automatically?
    </h3>
    <p style="margin:0 0 24px;font-size:13px;color:#999;line-height:1.6">
      Scan a real cake with your camera to auto-fill the shape,
      or pick manually.
    </p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <button class="ssp-btn" id="ssp-scan">
        ${G}
        Scan my cake
        <small>auto-detect</small>
      </button>
      <button class="ssp-btn" id="ssp-manual">
        ${U(e,36)}
        Use ${n}
        <small>(manual)</small>
      </button>
    </div>
  `,s.appendChild(r),document.body.appendChild(s);const o=()=>s.remove();r.querySelector("#ssp-scan").onclick=()=>{o(),Z(e,t)},r.querySelector("#ssp-manual").onclick=()=>{o(),t(e)},s.onclick=i=>{i.target===s&&(o(),t(e))}}function Z(e,t){new I({onDetected:s=>{if(!s){t(e);return}K(s,e,t)},onError:s=>{t(e)}}).start()}function K(e,t,n){const s=S[e]||e,r=S[t]||t,o=document.createElement("div");o.className="sf-confirm-card",o.innerHTML=`
    ${U(e,64)}
    <h3>We found a ${s} cake</h3>
    <p>Shape auto-detected from your camera.</p>
    <button class="sf-btn-primary" id="ssp-use-detected">
      Use ${s} shape
    </button>
    <button class="sf-btn-secondary" id="ssp-use-fallback">
      Use ${r} instead
    </button>
  `,document.body.appendChild(o),o.querySelector("#ssp-use-detected").onclick=()=>{o.remove(),n(e)},o.querySelector("#ssp-use-fallback").onclick=()=>{o.remove(),n(t)}}function tt(e,t){et(e,t),nt(e,t),ot(e,t),rt(e,t),at(e,t),it(e,t),st(e),j(e);let n=null;e.onChange(()=>{clearTimeout(n),n=setTimeout(()=>{try{t.buildCake(e.getState())}catch(s){console.error("[ARCake] Fallback rebuild error:",s)}},60),N(e)}),t.buildCake(e.getState())}function et(e,t){document.querySelectorAll(".option-group[data-option]").forEach(s=>{const r=s.dataset.option;if(r==="frostingColor"||r==="boardColor")return;const o=s.querySelectorAll(".option-btn");o.forEach(i=>{i.addEventListener("click",()=>{if(r==="shape"){V(i.dataset.value,a=>{o.forEach(d=>d.classList.remove("active"));const u=s.querySelector(`.option-btn[data-value="${a}"]`);u&&u.classList.add("active"),e.set("shape",a);try{t.buildCake(e.getState())}catch(d){console.error("[ARCake]",d)}});return}o.forEach(a=>a.classList.remove("active")),i.classList.add("active"),e.set(r,i.dataset.value);try{t.buildCake(e.getState())}catch(a){console.error("[ARCake]",a)}})})})}function nt(e,t){const n=document.querySelector('.preset-colors[data-option="frostingColor"]');if(n){const o=n.querySelectorAll(".color-swatch");o.forEach(i=>{i.addEventListener("click",()=>{o.forEach(a=>a.classList.remove("active")),i.classList.add("active"),e.set("frostingColor",i.dataset.value);try{t.buildCake(e.getState())}catch(a){console.error("[ARCake]",a)}})})}const s=document.getElementById("customFrostingColor");if(s){let o=null;s.addEventListener("input",()=>{clearTimeout(o),o=setTimeout(()=>{n&&n.querySelectorAll(".color-swatch").forEach(i=>i.classList.remove("active")),e.set("frostingColor",s.value);try{t.buildCake(e.getState())}catch(i){console.error("[ARCake]",i)}},80)})}const r=document.querySelector('.preset-colors[data-option="boardColor"]');if(r){const o=r.querySelectorAll(".color-swatch");o.forEach(i=>{i.addEventListener("click",()=>{o.forEach(a=>a.classList.remove("active")),i.classList.add("active"),e.set("boardColor",i.dataset.value);try{t.buildCake(e.getState())}catch(a){console.error("[ARCake]",a)}})})}}function ot(e,t){const n=["sprinkles","fruits","decorations"];document.querySelectorAll(".topping-option-btn").forEach(s=>{s.addEventListener("click",()=>{const r=s.dataset.category;e.setTopping(r,s.dataset.value),n.includes(r)&&n.forEach(o=>{o!==r&&(e.clearTopping(o),w(o,e))}),w(r,e);try{t.buildCake(e.getState())}catch(o){console.error("[ARCake]",o)}})}),document.querySelectorAll(".topping-clear-btn").forEach(s=>{s.addEventListener("click",()=>{e.clearTopping(s.dataset.category),w(s.dataset.category,e);try{t.buildCake(e.getState())}catch(r){console.error("[ARCake]",r)}})}),document.querySelectorAll(".topping-qty-btn").forEach(s=>{s.addEventListener("click",()=>{const{category:r,action:o}=s.dataset;if(!e.getTopping(r)){const u=document.querySelector(`.topping-option-btn[data-category="${r}"]`);u&&(e.setTopping(r,u.dataset.value),w(r,e))}const i=e.getToppingQuantity(r),a=o==="inc"?i+1:i-1;e.setToppingQuantity(r,a),L(r,e);try{t.buildCake(e.getState())}catch(u){console.error("[ARCake] Error rebuilding cake on qty change:",u)}})}),document.querySelectorAll(".topping-qty-input").forEach(s=>{s.addEventListener("change",()=>{const{category:r}=s.dataset,o=parseInt(s.value,10);if(!isNaN(o)){e.setToppingQuantity(r,o),L(r,e);try{t.buildCake(e.getState())}catch(i){console.error("[ARCake] Error rebuilding cake on qty input:",i)}}}),s.addEventListener("keydown",r=>{r.key==="Enter"&&s.blur()})})}function w(e,t){document.querySelectorAll(`.topping-option-btn[data-category="${e}"]`).forEach(n=>{n.classList.toggle("active",t.isToppingActive(e,n.dataset.value))}),(e==="fruits"||e==="candles")&&L(e,t)}function L(e,t){const n=document.querySelector(`.topping-qty-row[data-category="${e}"]`);if(!n)return;const s=t.getTopping(e);n.classList.toggle("visible",s!==null);const r=n.querySelector(".topping-qty-input"),o=t.getToppingQuantity(e);r&&(r.value=o);const i=parseInt((r==null?void 0:r.getAttribute("min"))||"1",10),a=parseInt((r==null?void 0:r.getAttribute("max"))||"12",10),u=n.querySelector('[data-action="dec"]'),d=n.querySelector('[data-action="inc"]');u&&(u.disabled=o<=i),d&&(d.disabled=o>=a)}function N(e){const t=document.querySelector(".topping-count");if(!t)return;const n=e.getToppingCount();t.textContent=n>0?`${n} active`:""}function rt(e,t){const n=document.getElementById("cakeText");if(n){let o=null;n.addEventListener("input",()=>{clearTimeout(o),o=setTimeout(()=>{e.set("cakeText",n.value);try{t.buildCake(e.getState())}catch(i){console.error("[ARCake]",i)}},250)})}const s=document.getElementById("textFont");s&&s.addEventListener("change",()=>{e.set("textFont",s.value);try{t.buildCake(e.getState())}catch(o){console.error("[ARCake]",o)}});const r=document.getElementById("textColor");if(r){let o=null;r.addEventListener("input",()=>{clearTimeout(o),o=setTimeout(()=>{e.set("textColor",r.value);try{t.buildCake(e.getState())}catch(i){console.error("[ARCake]",i)}},80)})}}function st(e,t){const n=document.getElementById("ar-preview-btn");n&&n.addEventListener("click",()=>{new Q(e.getState(),()=>{},r=>m("AR screenshot saved!","success")).open()})}function it(e,t){const n=document.getElementById("btnScanShape");n&&n.addEventListener("click",()=>{new I({onDetected:r=>{if(r){e.set("shape",r);const o=document.querySelector('.option-group[data-option="shape"]');o&&o.querySelectorAll(".option-btn").forEach(i=>{i.classList.toggle("active",i.dataset.value===r)});try{t.buildCake(e.getState())}catch(i){console.error("[ARCake]",i)}m(`${r.charAt(0).toUpperCase()+r.slice(1)} shape detected!`,"success")}},onError:r=>{console.warn("[CakeScanner]",r),m(r,"error")}}).start()})}function at(e,t){const n=document.getElementById("btnSave");n&&n.addEventListener("click",()=>{try{const o=e.getState(),i=t.takeScreenshot(),a=JSON.parse(localStorage.getItem("arcake_designs")||"[]");a.push({id:Date.now(),date:new Date().toISOString(),state:o,screenshot:i}),localStorage.setItem("arcake_designs",JSON.stringify(a)),m("Design Saved!","success")}catch(o){console.error("[ARCake] Save error:",o),m("Error saving design","error")}});const s=document.getElementById("btnScreenshot");s&&s.addEventListener("click",()=>{try{const o=t.takeScreenshot(),i=document.createElement("a");i.download=`arcake-design-${Date.now()}.png`,i.href=o,i.click(),m("Screenshot taken!","success")}catch(o){console.error("[ARCake] Screenshot error:",o),m("Error taking screenshot","error")}});const r=document.getElementById("btnReset");r&&r.addEventListener("click",()=>{e.reset(),j(e);const o=document.getElementById("cakeText");o&&(o.value=""),m("Cake reset!","success")})}function j(e){const t=e.getState();["shape","size","flavor","frostingStyle"].forEach(o=>{const i=document.querySelector(`.option-group[data-option="${o}"]`);i&&i.querySelectorAll(".option-btn").forEach(a=>{a.classList.toggle("active",a.dataset.value===t[o])})});const n=document.querySelector('.preset-colors[data-option="frostingColor"]');n&&n.querySelectorAll(".color-swatch").forEach(o=>{o.classList.toggle("active",o.dataset.value===t.frostingColor)});const s=document.querySelector('.preset-colors[data-option="boardColor"]');s&&s.querySelectorAll(".color-swatch").forEach(o=>{o.classList.toggle("active",o.dataset.value===t.boardColor)}),document.querySelectorAll(".topping-option-btn").forEach(o=>{const{category:i,value:a}=o.dataset;o.classList.toggle("active",e.isToppingActive(i,a))}),["fruits","candles"].forEach(o=>L(o,e)),N(e)}function m(e,t=""){const n=document.getElementById("toast");n&&(n.textContent=e,n.className="toast",t&&n.classList.add(t),n.offsetWidth,n.classList.add("show"),setTimeout(()=>n.classList.remove("show"),2500))}function ct(){const e=document.getElementById("navToggle"),t=document.getElementById("navMenu");e&&t&&(e.addEventListener("click",()=>t.classList.toggle("open")),t.querySelectorAll("a").forEach(r=>{r.addEventListener("click",()=>t.classList.remove("open"))}));const n=document.querySelectorAll(".fade-in");if(n.length>0){const r=new IntersectionObserver(o=>{o.forEach(i=>{i.isIntersecting&&(i.target.classList.add("visible"),r.unobserve(i.target))})},{threshold:.15});n.forEach(o=>r.observe(o))}const s=document.getElementById("loading");s&&setTimeout(()=>s.classList.add("hidden"),600)}function lt(e){dt(e)}function dt(e){const t=Object.assign(document.createElement("div"),{id:"ssc-overlay"});Object.assign(t.style,{position:"fixed",inset:"0",zIndex:"9999",background:"rgba(0,0,0,0.52)",display:"flex",alignItems:"center",justifyContent:"center"});const n=document.createElement("div");Object.assign(n.style,{background:"#fff",borderRadius:"24px",padding:"36px 28px 28px",width:"min(420px, 92vw)",textAlign:"center",boxShadow:"0 8px 40px rgba(0,0,0,0.18)"}),n.innerHTML=`
    <h2 style="margin:0 0 8px;font-size:22px;
               font-weight:700;color:#1a1a1a">
      How do you want to start?
    </h2>
    <p style="margin:0 0 28px;font-size:14px;
              color:#999;line-height:1.6">
      Scan a real cake to auto-detect its shape,
      or jump straight into the customizer.
    </p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">

      <button id="ssc-scan-btn" style="
        display:flex;flex-direction:column;align-items:center;
        gap:10px;padding:24px 14px 20px;border:2px solid #f0f0f0;
        border-radius:16px;background:#fafafa;cursor:pointer;
        font-size:15px;font-weight:600;color:#1a1a1a;
        transition:border-color 0.18s,background 0.18s;
        font-family:inherit">
        <svg width="44" height="44" viewBox="0 0 44 44"
             fill="none" stroke="#E91E8C" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="10" width="40" height="28" rx="5"/>
          <circle cx="22" cy="24" r="8"/>
          <path d="M14 10l3-5h10l3 5"/>
        </svg>
        Scan shape
        <small style="font-size:11px;font-weight:400;
                      color:#bbb;font-family:inherit">
          Point at a real cake
        </small>
      </button>

      <button id="ssc-direct-btn" style="
        display:flex;flex-direction:column;align-items:center;
        gap:10px;padding:24px 14px 20px;border:2px solid #f0f0f0;
        border-radius:16px;background:#fafafa;cursor:pointer;
        font-size:15px;font-weight:600;color:#1a1a1a;
        transition:border-color 0.18s,background 0.18s;
        font-family:inherit">
        <svg width="44" height="44" viewBox="0 0 44 44"
             fill="none" stroke="#E91E8C" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round">
          <rect x="6" y="6" width="32" height="32" rx="6"/>
          <line x1="14" y1="22" x2="30" y2="22"/>
          <line x1="14" y1="16" x2="30" y2="16"/>
          <line x1="14" y1="28" x2="22" y2="28"/>
        </svg>
        Customize directly
        <small style="font-size:11px;font-weight:400;
                      color:#bbb;font-family:inherit">
          Pick shape yourself
        </small>
      </button>
    </div>
  `,t.appendChild(n),document.body.appendChild(t);const s=()=>{const r=document.getElementById("ssc-overlay");r&&r.remove()};["ssc-scan-btn","ssc-direct-btn"].forEach(r=>{const o=n.querySelector("#"+r);o.addEventListener("mouseenter",()=>{o.style.borderColor="#E91E8C",o.style.background="#fff0f6"}),o.addEventListener("mouseleave",()=>{o.style.borderColor="#f0f0f0",o.style.background="#fafafa"})}),n.querySelector("#ssc-scan-btn").addEventListener("click",()=>{s(),ut(e)}),n.querySelector("#ssc-direct-btn").addEventListener("click",()=>{s(),e("round")}),t.addEventListener("click",r=>{r.target===t&&(s(),e("round"))})}function ut(e){let t;try{t=new I({onDetected:n=>{if(!n){e("round");return}ht(n,e)},onError:()=>{e("round")}}),t.start()}catch(n){console.warn("[StartFlow] CakeScanner failed to start:",n),e("round")}}function ht(e,t){const n={round:"Round",square:"Square",heart:"Heart",layered:"Layered"},s={round:`<circle cx="32" cy="32" r="24" fill="none"
                stroke="#E91E8C" stroke-width="3"/>`,square:`<rect x="8" y="8" width="48" height="48" rx="6"
                fill="none" stroke="#E91E8C" stroke-width="3"/>`,heart:`<path d="M32 54C6 36 4 10 18 6C26 4 32 16 32 16
                       C32 16 38 4 46 6C60 10 58 36 32 54Z"
                fill="none" stroke="#E91E8C" stroke-width="3"/>`,layered:`<ellipse cx="32" cy="46" rx="24" ry="10"
                fill="none" stroke="#E91E8C" stroke-width="2.5"/>
              <ellipse cx="32" cy="24" rx="16" ry="8"
                fill="none" stroke="#E91E8C" stroke-width="2.5"/>`},r=document.createElement("div");r.id="ssc-confirm-card",Object.assign(r.style,{position:"fixed",bottom:"0",left:"0",right:"0",zIndex:"10000",background:"#fff",borderRadius:"20px 20px 0 0",padding:"28px 24px 44px",textAlign:"center",boxShadow:"0 -4px 32px rgba(0,0,0,0.14)"});const o=n[e]||"Round";r.innerHTML=`
    <svg width="72" height="72" viewBox="0 0 64 64"
         style="display:block;margin:0 auto;">
      ${s[e]||s.round}
    </svg>
    <h3 style="margin:10px 0 6px;font-size:20px;
               font-weight:700;color:#1a1a1a">
      We found a ${o} cake
    </h3>
    <p style="margin:0 0 24px;font-size:14px;color:#999">
      This shape will be pre-selected in your customizer.
    </p>
    <button id="ssc-use-shape" style="
      display:block;width:100%;padding:14px;
      background:#E91E8C;color:#fff;border:none;
      border-radius:12px;font-size:16px;font-weight:700;
      cursor:pointer;margin-bottom:10px;font-family:inherit">
      Use ${o} shape
    </button>
    <button id="ssc-skip-shape" style="
      display:block;width:100%;padding:12px;
      background:transparent;color:#888;
      border:1.5px solid #e0e0e0;border-radius:12px;
      font-size:15px;cursor:pointer;font-family:inherit">
      Choose shape myself
    </button>
  `,document.body.appendChild(r);const i=()=>{const a=document.getElementById("ssc-confirm-card");a&&a.remove()};r.querySelector("#ssc-use-shape").addEventListener("click",()=>{i(),t(e)}),r.querySelector("#ssc-skip-shape").addEventListener("click",()=>{i(),t("round")})}async function O(){console.log("[ARCake] Initializing..."),ct();const e=window.location.pathname;e.includes("customize")?await ft():e.includes("gallery")?await mt():await pt()}async function pt(){console.log("[ARCake] Home page");const e=document.getElementById("start-btn");e&&e.addEventListener("click",n=>{n.preventDefault(),lt(s=>{const r=["round","square","heart","layered"].includes(s)?s:"round";window.location.href=`./pages/customize.html?shape=${r}`})});const t=document.getElementById("heroCanvas");if(t)try{const{createHeroPreview:n}=await E(()=>import("./cake-B-OTjfso.js"),__vite__mapDeps([]),import.meta.url);n(t),console.log("[ARCake] Hero preview loaded")}catch(n){console.error("[ARCake] Error loading hero preview:",n)}}async function ft(){console.log("[ARCake] Customizer page");const e=document.getElementById("cakeCanvas");if(e)try{const{CakeScene:t}=await E(()=>import("./cake-B-OTjfso.js"),__vite__mapDeps([]),import.meta.url),{CustomizationState:n}=await E(()=>import("./customization-CkFc-sC2.js"),__vite__mapDeps([]),import.meta.url),s=new n,r=new URLSearchParams(window.location.search).get("shape");r&&["round","square","heart","layered"].includes(r)&&s.set("shape",r);const o=sessionStorage.getItem("arcake_loadDesign");if(o)try{const a=JSON.parse(o);s.loadState(a),sessionStorage.removeItem("arcake_loadDesign")}catch(a){console.warn("[ARCake] Could not load saved design:",a)}const i=new t(e);window.customizationState=s,window.cakeScene=i,tt(s,i),console.log("[ARCake] Customizer initialized")}catch(t){console.error("[ARCake] Error initializing customizer:",t)}}async function mt(){console.log("[ARCake] Gallery page");try{const{initGallery:e}=await E(()=>import("./gallery-CUYLh_AM.js"),__vite__mapDeps([]),import.meta.url);e(),console.log("[ARCake] Gallery initialized")}catch(e){console.error("[ARCake] Error initializing gallery:",e)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",O):O();
function __vite__mapDeps(indexes) {
  if (!__vite__mapDeps.viteFileDeps) {
    __vite__mapDeps.viteFileDeps = []
  }
  return indexes.map((i) => __vite__mapDeps.viteFileDeps[i])
}