import{$ as l,Oc as M,Ta as h,_ as a,ba as u,da as r,ga as f,ib as y,jb as D,ma as p,na as g,qa as v,va as m,vb as w}from"./chunk-VKTSMD3X.js";var d=new WeakMap,T=(()=>{class e{_appRef;_injector=r(p);_environmentInjector=r(f);load(n){let t=this._appRef=this._appRef||this._injector.get(w),i=d.get(t);i||(i={loaders:new Set,refs:[]},d.set(t,i),t.onDestroy(()=>{d.get(t)?.refs.forEach(_=>_.destroy()),d.delete(t)})),i.loaders.has(n)||(i.loaders.add(n),i.refs.push(M(n,{environmentInjector:this._environmentInjector})))}static \u0275fac=function(t){return new(t||e)};static \u0275prov=a({token:e,factory:e.\u0275fac,providedIn:"root"})}return e})();var F=(()=>{class e{static \u0275fac=function(t){return new(t||e)};static \u0275cmp=y({type:e,selectors:[["ng-component"]],exportAs:["cdkVisuallyHidden"],decls:0,vars:0,template:function(t,i){},styles:[`.cdk-visually-hidden {
  border: 0;
  clip: rect(0 0 0 0);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  width: 1px;
  white-space: nowrap;
  outline: 0;
  -webkit-appearance: none;
  -moz-appearance: none;
  left: 0;
}
[dir=rtl] .cdk-visually-hidden {
  left: auto;
  right: 0;
}
`],encapsulation:2,changeDetection:0})}return e})(),s;function b(){if(s===void 0&&(s=null,typeof window<"u")){let e=window;e.trustedTypes!==void 0&&(s=e.trustedTypes.createPolicy("angular#components",{createHTML:o=>o}))}return s}function j(e){return b()?.createHTML(e)||e}function O(e,o,n){let t=n.sanitize(h.HTML,o);e.innerHTML=j(t||"")}var E=new u("cdk-dir-doc",{providedIn:"root",factory:()=>r(g)}),S=/^(ar|ckb|dv|he|iw|fa|nqo|ps|sd|ug|ur|yi|.*[-_](Adlm|Arab|Hebr|Nkoo|Rohg|Thaa))(?!.*[-_](Latn|Cyrl)($|-|_))($|-|_)/i;function I(e){let o=e?.toLowerCase()||"";return o==="auto"&&typeof navigator<"u"&&navigator?.language?S.test(navigator.language)?"rtl":"ltr":o==="rtl"?"rtl":"ltr"}var C=(()=>{class e{get value(){return this.valueSignal()}valueSignal=m("ltr");change=new v;constructor(){let n=r(E,{optional:!0});if(n){let t=n.body?n.body.dir:null,i=n.documentElement?n.documentElement.dir:null;this.valueSignal.set(I(t||i||"ltr"))}}ngOnDestroy(){this.change.complete()}static \u0275fac=function(t){return new(t||e)};static \u0275prov=a({token:e,factory:e.\u0275fac,providedIn:"root"})}return e})();var J=(()=>{class e{static \u0275fac=function(t){return new(t||e)};static \u0275mod=D({type:e});static \u0275inj=l({})}return e})();export{T as a,F as b,j as c,O as d,C as e,J as f};
