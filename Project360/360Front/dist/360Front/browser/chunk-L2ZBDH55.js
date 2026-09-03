import{a as Me,b as Pe,c as Ie,d as we,e as Re,f as De}from"./chunk-CNVP45MA.js";import{a as Ee}from"./chunk-UXJZTRDF.js";import{b as _e,c as he,d as ue,e as ge,f as fe,g as ve,h as Ce,i as ye,j as xe,k as ke,l as Te}from"./chunk-PUC2VX47.js";import{a as Oe}from"./chunk-7QBBKIMW.js";import{a as be,b as pe}from"./chunk-NYYIDRZ4.js";import{a as ce,b as me}from"./chunk-SK4N4STM.js";import"./chunk-ARYHMSKE.js";import{C as nt,F as pt,G as Jt,H as te,K as ne,L as ae,R as re,S as se,X as le,Z as de,_ as ht,c as bt,h as qt,l as Kt,s as Yt,u as Ut,v as Xt}from"./chunk-N2G6TVG2.js";import{a as ie,b as oe}from"./chunk-V66YIDGM.js";import{a as Zt,e as _t,f as ee}from"./chunk-DAHIYQ2P.js";import{c as jt,d as Qt,e as Vt,k as Wt,t as $t,v as Gt}from"./chunk-67IOLARZ.js";import{$ as Ot,$a as Z,A as W,Ab as lt,B as wt,Ba as B,Bb as dt,Ca as Lt,Cb as ct,Db as m,Eb as o,Fb as r,G as Rt,Gb as k,Ic as tt,Kb as f,Lb as v,Lc as y,Mc as et,Nb as z,R as Dt,Rb as T,S as $,T as Et,Tb as _,U as F,Ub as K,Vb as Y,Wa as d,Wb as U,Xb as j,Yb as u,Zb as g,_a as q,ba as L,bb as ot,bc as mt,c as E,cb as A,cc as Ht,da as b,dc as C,e as Tt,eb as Bt,ec as X,fc as l,g as V,gc as h,hc as M,ia as I,ib as O,ic as J,ja as w,jb as At,jc as zt,kb as S,l as Mt,ma as it,n as Pt,nb as H,ob as p,pb as Ft,qa as x,qc as Q,ra as N,wb as Nt,xb as R,ya as St,yb as rt,z as It,za as G,zb as st}from"./chunk-VKTSMD3X.js";var Ct=["*"];function $e(n,i){n&1&&Y(0)}var Ge=["tabListContainer"],qe=["tabList"],Ze=["tabListInner"],Ke=["nextPaginator"],Ye=["previousPaginator"],Ue=["content"];function Xe(n,i){}var Je=["tabBodyWrapper"],tn=["tabHeader"];function en(n,i){}function nn(n,i){if(n&1&&p(0,en,0,0,"ng-template",12),n&2){let t=_().$implicit;m("cdkPortalOutlet",t.templateLabel)}}function an(n,i){if(n&1&&l(0),n&2){let t=_().$implicit;h(t.textLabel)}}function on(n,i){if(n&1){let t=z();o(0,"div",7,2),T("click",function(){let a=I(t),s=a.$implicit,c=a.$index,P=_(),D=mt(1);return w(P._handleClick(s,D,c))})("cdkFocusChange",function(a){let s=I(t).$index,c=_();return w(c._tabFocusChanged(a,s))}),k(2,"span",8)(3,"div",9),o(4,"span",10)(5,"span",11),rt(6,nn,1,1,null,12)(7,an,1,1),r()()()}if(n&2){let t=i.$implicit,e=i.$index,a=mt(1),s=_();X(t.labelClass),C("mdc-tab--active",s.selectedIndex===e),m("id",s._getTabLabelId(t,e))("disabled",t.disabled)("fitInkBarToContent",s.fitInkBarToContent),R("tabIndex",s._getTabIndex(e))("aria-posinset",e+1)("aria-setsize",s._tabs.length)("aria-controls",s._getTabContentId(e))("aria-selected",s.selectedIndex===e)("aria-label",t.ariaLabel||null)("aria-labelledby",!t.ariaLabel&&t.ariaLabelledby?t.ariaLabelledby:null),d(3),m("matRippleTrigger",a)("matRippleDisabled",t.disabled||s.disableRipple),d(3),st(t.templateLabel?6:7)}}function rn(n,i){n&1&&Y(0)}function sn(n,i){if(n&1){let t=z();o(0,"mat-tab-body",13),T("_onCentered",function(){I(t);let a=_();return w(a._removeTabBodyWrapperHeight())})("_onCentering",function(a){I(t);let s=_();return w(s._setTabBodyWrapperHeight(a))})("_beforeCentering",function(a){I(t);let s=_();return w(s._bodyCentered(a))}),r()}if(n&2){let t=i.$implicit,e=i.$index,a=_();X(t.bodyClass),m("id",a._getTabContentId(e))("content",t.content)("position",t.position)("animationDuration",a.animationDuration)("preserveContent",a.preserveContent),R("tabindex",a.contentTabIndex!=null&&a.selectedIndex===e?a.contentTabIndex:null)("aria-labelledby",a._getTabLabelId(t,e))("aria-hidden",a.selectedIndex!==e)}}var ln=new L("MatTabContent"),dn=(()=>{class n{template=b(Z);constructor(){}static \u0275fac=function(e){return new(e||n)};static \u0275dir=S({type:n,selectors:[["","matTabContent",""]],features:[Q([{provide:ln,useExisting:n}])]})}return n})(),cn=new L("MatTabLabel"),Ae=new L("MAT_TAB"),yt=(()=>{class n extends de{_closestTab=b(Ae,{optional:!0});static \u0275fac=(()=>{let t;return function(a){return(t||(t=G(n)))(a||n)}})();static \u0275dir=S({type:n,selectors:[["","mat-tab-label",""],["","matTabLabel",""]],features:[Q([{provide:cn,useExisting:n}]),H]})}return n})(),Fe=new L("MAT_TAB_GROUP"),xt=(()=>{class n{_viewContainerRef=b(Bt);_closestTabGroup=b(Fe,{optional:!0});disabled=!1;get templateLabel(){return this._templateLabel}set templateLabel(t){this._setTemplateLabelInput(t)}_templateLabel;_explicitContent=void 0;_implicitContent;textLabel="";ariaLabel;ariaLabelledby;labelClass;bodyClass;id=null;_contentPortal=null;get content(){return this._contentPortal}_stateChanges=new V;position=null;origin=null;isActive=!1;constructor(){b(Zt).load(Jt)}ngOnChanges(t){(t.hasOwnProperty("textLabel")||t.hasOwnProperty("disabled"))&&this._stateChanges.next()}ngOnDestroy(){this._stateChanges.complete()}ngOnInit(){this._contentPortal=new le(this._explicitContent||this._implicitContent,this._viewContainerRef)}_setTemplateLabelInput(t){t&&t._closestTab===this&&(this._templateLabel=t)}static \u0275fac=function(e){return new(e||n)};static \u0275cmp=O({type:n,selectors:[["mat-tab"]],contentQueries:function(e,a,s){if(e&1&&U(s,yt,5)(s,dn,7,Z),e&2){let c;u(c=g())&&(a.templateLabel=c.first),u(c=g())&&(a._explicitContent=c.first)}},viewQuery:function(e,a){if(e&1&&j(Z,7),e&2){let s;u(s=g())&&(a._implicitContent=s.first)}},hostAttrs:["hidden",""],hostVars:1,hostBindings:function(e,a){e&2&&R("id",null)},inputs:{disabled:[2,"disabled","disabled",y],textLabel:[0,"label","textLabel"],ariaLabel:[0,"aria-label","ariaLabel"],ariaLabelledby:[0,"aria-labelledby","ariaLabelledby"],labelClass:"labelClass",bodyClass:"bodyClass",id:"id"},exportAs:["matTab"],features:[Q([{provide:Ae,useExisting:n}]),St],ngContentSelectors:Ct,decls:1,vars:0,template:function(e,a){e&1&&(K(),Ft(0,$e,1,0,"ng-template"))},encapsulation:2})}return n})(),ut="mdc-tab-indicator--active",Se="mdc-tab-indicator--no-transition",gt=class{_items;_currentItem;constructor(i){this._items=i}hide(){this._items.forEach(i=>i.deactivateInkBar()),this._currentItem=void 0}alignToElement(i){let t=this._items.find(a=>a.elementRef.nativeElement===i),e=this._currentItem;if(t!==e&&(e?.deactivateInkBar(),t)){let a=e?.elementRef.nativeElement.getBoundingClientRect?.();t.activateInkBar(a),this._currentItem=t}}},mn=(()=>{class n{_elementRef=b(B);_inkBarElement=null;_inkBarContentElement=null;_fitToContent=!1;get fitInkBarToContent(){return this._fitToContent}set fitInkBarToContent(t){this._fitToContent!==t&&(this._fitToContent=t,this._inkBarElement&&this._appendInkBarElement())}activateInkBar(t){let e=this._elementRef.nativeElement;if(!t||!e.getBoundingClientRect||!this._inkBarContentElement){e.classList.add(ut);return}let a=e.getBoundingClientRect(),s=t.width/a.width,c=t.left-a.left;e.classList.add(Se),this._inkBarContentElement.style.setProperty("transform",`translateX(${c}px) scaleX(${s})`),e.getBoundingClientRect(),e.classList.remove(Se),e.classList.add(ut),this._inkBarContentElement.style.setProperty("transform","")}deactivateInkBar(){this._elementRef.nativeElement.classList.remove(ut)}ngOnInit(){this._createInkBarElement()}ngOnDestroy(){this._inkBarElement?.remove(),this._inkBarElement=this._inkBarContentElement=null}_createInkBarElement(){let t=this._elementRef.nativeElement.ownerDocument||document,e=this._inkBarElement=t.createElement("span"),a=this._inkBarContentElement=t.createElement("span");e.className="mdc-tab-indicator",a.className="mdc-tab-indicator__content mdc-tab-indicator__content--underline",e.appendChild(this._inkBarContentElement),this._appendInkBarElement()}_appendInkBarElement(){this._inkBarElement;let t=this._fitToContent?this._elementRef.nativeElement.querySelector(".mdc-tab__content"):this._elementRef.nativeElement;t.appendChild(this._inkBarElement)}static \u0275fac=function(e){return new(e||n)};static \u0275dir=S({type:n,inputs:{fitInkBarToContent:[2,"fitInkBarToContent","fitInkBarToContent",y]}})}return n})();var Ne=(()=>{class n extends mn{elementRef=b(B);disabled=!1;focus(){this.elementRef.nativeElement.focus()}getOffsetLeft(){return this.elementRef.nativeElement.offsetLeft}getOffsetWidth(){return this.elementRef.nativeElement.offsetWidth}static \u0275fac=(()=>{let t;return function(a){return(t||(t=G(n)))(a||n)}})();static \u0275dir=S({type:n,selectors:[["","matTabLabelWrapper",""]],hostVars:3,hostBindings:function(e,a){e&2&&(R("aria-disabled",!!a.disabled),C("mat-mdc-tab-disabled",a.disabled))},inputs:{disabled:[2,"disabled","disabled",y]},features:[H]})}return n})(),Le={passive:!0},bn=650,pn=100,_n=(()=>{class n{_elementRef=b(B);_changeDetectorRef=b(tt);_viewportRuler=b(se);_dir=b(_t,{optional:!0});_ngZone=b(N);_platform=b(bt);_sharedResizeObserver=b(ae);_injector=b(it);_renderer=b(ot);_animationsDisabled=nt();_eventCleanups;_scrollDistance=0;_selectedIndexChanged=!1;_destroyed=new V;_showPaginationControls=!1;_disableScrollAfter=!0;_disableScrollBefore=!0;_tabLabelCount;_scrollDistanceChanged=!1;_keyManager;_currentTextContent;_stopScrolling=new V;disablePagination=!1;get selectedIndex(){return this._selectedIndex}set selectedIndex(t){let e=isNaN(t)?0:t;this._selectedIndex!=e&&(this._selectedIndexChanged=!0,this._selectedIndex=e,this._keyManager&&this._keyManager.updateActiveItem(e))}_selectedIndex=0;selectFocusedIndex=new x;indexFocused=new x;constructor(){this._eventCleanups=this._ngZone.runOutsideAngular(()=>[this._renderer.listen(this._elementRef.nativeElement,"mouseleave",()=>this._stopInterval())])}ngAfterViewInit(){this._eventCleanups.push(this._renderer.listen(this._previousPaginator.nativeElement,"touchstart",()=>this._handlePaginatorPress("before"),Le),this._renderer.listen(this._nextPaginator.nativeElement,"touchstart",()=>this._handlePaginatorPress("after"),Le))}ngAfterContentInit(){let t=this._dir?this._dir.change:Pt("ltr"),e=this._sharedResizeObserver.observe(this._elementRef.nativeElement).pipe(Rt(32),F(this._destroyed)),a=this._viewportRuler.change(150).pipe(F(this._destroyed)),s=()=>{this.updatePagination(),this._alignInkBarToSelectedTab()};this._keyManager=new Ut(this._items).withHorizontalOrientation(this._getLayoutDirection()).withHomeAndEnd().withWrap().skipPredicate(()=>!1),this._keyManager.updateActiveItem(Math.max(this._selectedIndex,0)),q(s,{injector:this._injector}),W(t,a,e,this._items.changes,this._itemsResized()).pipe(F(this._destroyed)).subscribe(()=>{this._ngZone.run(()=>{Promise.resolve().then(()=>{this._scrollDistance=Math.max(0,Math.min(this._getMaxScrollDistance(),this._scrollDistance)),s()})}),this._keyManager?.withHorizontalOrientation(this._getLayoutDirection())}),this._keyManager.change.subscribe(c=>{this.indexFocused.emit(c),this._setTabFocus(c)})}_itemsResized(){return typeof ResizeObserver!="function"?Mt:this._items.changes.pipe($(this._items),Et(t=>new Tt(e=>this._ngZone.runOutsideAngular(()=>{let a=new ResizeObserver(s=>e.next(s));return t.forEach(s=>a.observe(s.elementRef.nativeElement)),()=>{a.disconnect()}}))),Dt(1),wt(t=>t.some(e=>e.contentRect.width>0&&e.contentRect.height>0)))}ngAfterContentChecked(){this._tabLabelCount!=this._items.length&&(this.updatePagination(),this._tabLabelCount=this._items.length,this._changeDetectorRef.markForCheck()),this._selectedIndexChanged&&(this._scrollToLabel(this._selectedIndex),this._checkScrollingControls(),this._alignInkBarToSelectedTab(),this._selectedIndexChanged=!1,this._changeDetectorRef.markForCheck()),this._scrollDistanceChanged&&(this._updateTabScrollPosition(),this._scrollDistanceChanged=!1,this._changeDetectorRef.markForCheck())}ngOnDestroy(){this._eventCleanups.forEach(t=>t()),this._keyManager?.destroy(),this._destroyed.next(),this._destroyed.complete(),this._stopScrolling.complete()}_handleKeydown(t){if(!Yt(t))switch(t.keyCode){case 13:case 32:if(this.focusIndex!==this.selectedIndex){let e=this._items.get(this.focusIndex);e&&!e.disabled&&(this.selectFocusedIndex.emit(this.focusIndex),this._itemSelected(t))}break;default:this._keyManager?.onKeydown(t)}}_onContentChanges(){let t=this._elementRef.nativeElement.textContent;t!==this._currentTextContent&&(this._currentTextContent=t||"",this._ngZone.run(()=>{this.updatePagination(),this._alignInkBarToSelectedTab(),this._changeDetectorRef.markForCheck()}))}updatePagination(){this._checkPaginationEnabled(),this._checkScrollingControls(),this._updateTabScrollPosition()}get focusIndex(){return this._keyManager?this._keyManager.activeItemIndex:0}set focusIndex(t){!this._isValidIndex(t)||this.focusIndex===t||!this._keyManager||this._keyManager.setActiveItem(t)}_isValidIndex(t){return this._items?!!this._items.toArray()[t]:!0}_setTabFocus(t){if(this._showPaginationControls&&this._scrollToLabel(t),this._items&&this._items.length){this._items.toArray()[t].focus();let e=this._tabListContainer.nativeElement;this._getLayoutDirection()=="ltr"?e.scrollLeft=0:e.scrollLeft=e.scrollWidth-e.offsetWidth}}_getLayoutDirection(){return this._dir&&this._dir.value==="rtl"?"rtl":"ltr"}_updateTabScrollPosition(){if(this.disablePagination)return;let t=this.scrollDistance,e=this._getLayoutDirection()==="ltr"?-t:t;this._tabList.nativeElement.style.transform=`translateX(${Math.round(e)}px)`,(this._platform.TRIDENT||this._platform.EDGE)&&(this._tabListContainer.nativeElement.scrollLeft=0)}get scrollDistance(){return this._scrollDistance}set scrollDistance(t){this._scrollTo(t)}_scrollHeader(t){let e=this._tabListContainer.nativeElement.offsetWidth,a=(t=="before"?-1:1)*e/3;return this._scrollTo(this._scrollDistance+a)}_handlePaginatorClick(t){this._stopInterval(),this._scrollHeader(t)}_scrollToLabel(t){if(this.disablePagination)return;let e=this._items?this._items.toArray()[t]:null;if(!e)return;let a=this._tabListContainer.nativeElement.offsetWidth,{offsetLeft:s,offsetWidth:c}=e.elementRef.nativeElement,P,D;this._getLayoutDirection()=="ltr"?(P=s,D=P+c):(D=this._tabListInner.nativeElement.offsetWidth-s,P=D-c);let at=this.scrollDistance,kt=this.scrollDistance+a;P<at?this.scrollDistance-=at-P:D>kt&&(this.scrollDistance+=Math.min(D-kt,P-at))}_checkPaginationEnabled(){if(this.disablePagination)this._showPaginationControls=!1;else{let t=this._tabListInner.nativeElement.scrollWidth,e=this._elementRef.nativeElement.offsetWidth,a=t-e>=5;a||(this.scrollDistance=0),a!==this._showPaginationControls&&(this._showPaginationControls=a,this._changeDetectorRef.markForCheck())}}_checkScrollingControls(){this.disablePagination?this._disableScrollAfter=this._disableScrollBefore=!0:(this._disableScrollBefore=this.scrollDistance==0,this._disableScrollAfter=this.scrollDistance==this._getMaxScrollDistance(),this._changeDetectorRef.markForCheck())}_getMaxScrollDistance(){let t=this._tabListInner.nativeElement.scrollWidth,e=this._tabListContainer.nativeElement.offsetWidth;return t-e||0}_alignInkBarToSelectedTab(){let t=this._items&&this._items.length?this._items.toArray()[this.selectedIndex]:null,e=t?t.elementRef.nativeElement:null;e?this._inkBar.alignToElement(e):this._inkBar.hide()}_stopInterval(){this._stopScrolling.next()}_handlePaginatorPress(t,e){e&&e.button!=null&&e.button!==0||(this._stopInterval(),It(bn,pn).pipe(F(W(this._stopScrolling,this._destroyed))).subscribe(()=>{let{maxScrollDistance:a,distance:s}=this._scrollHeader(t);(s===0||s>=a)&&this._stopInterval()}))}_scrollTo(t){if(this.disablePagination)return{maxScrollDistance:0,distance:0};let e=this._getMaxScrollDistance();return this._scrollDistance=Math.max(0,Math.min(e,t)),this._scrollDistanceChanged=!0,this._checkScrollingControls(),{maxScrollDistance:e,distance:this._scrollDistance}}static \u0275fac=function(e){return new(e||n)};static \u0275dir=S({type:n,inputs:{disablePagination:[2,"disablePagination","disablePagination",y],selectedIndex:[2,"selectedIndex","selectedIndex",et]},outputs:{selectFocusedIndex:"selectFocusedIndex",indexFocused:"indexFocused"}})}return n})(),hn=(()=>{class n extends _n{_items;_tabListContainer;_tabList;_tabListInner;_nextPaginator;_previousPaginator;_inkBar;ariaLabel;ariaLabelledby;disableRipple=!1;ngAfterContentInit(){this._inkBar=new gt(this._items),super.ngAfterContentInit()}_itemSelected(t){t.preventDefault()}static \u0275fac=(()=>{let t;return function(a){return(t||(t=G(n)))(a||n)}})();static \u0275cmp=O({type:n,selectors:[["mat-tab-header"]],contentQueries:function(e,a,s){if(e&1&&U(s,Ne,4),e&2){let c;u(c=g())&&(a._items=c)}},viewQuery:function(e,a){if(e&1&&j(Ge,7)(qe,7)(Ze,7)(Ke,5)(Ye,5),e&2){let s;u(s=g())&&(a._tabListContainer=s.first),u(s=g())&&(a._tabList=s.first),u(s=g())&&(a._tabListInner=s.first),u(s=g())&&(a._nextPaginator=s.first),u(s=g())&&(a._previousPaginator=s.first)}},hostAttrs:[1,"mat-mdc-tab-header"],hostVars:4,hostBindings:function(e,a){e&2&&C("mat-mdc-tab-header-pagination-controls-enabled",a._showPaginationControls)("mat-mdc-tab-header-rtl",a._getLayoutDirection()=="rtl")},inputs:{ariaLabel:[0,"aria-label","ariaLabel"],ariaLabelledby:[0,"aria-labelledby","ariaLabelledby"],disableRipple:[2,"disableRipple","disableRipple",y]},features:[H],ngContentSelectors:Ct,decls:13,vars:10,consts:[["previousPaginator",""],["tabListContainer",""],["tabList",""],["tabListInner",""],["nextPaginator",""],["mat-ripple","",1,"mat-mdc-tab-header-pagination","mat-mdc-tab-header-pagination-before",3,"click","mousedown","touchend","matRippleDisabled"],[1,"mat-mdc-tab-header-pagination-chevron"],[1,"mat-mdc-tab-label-container",3,"keydown"],["role","tablist",1,"mat-mdc-tab-list",3,"cdkObserveContent"],[1,"mat-mdc-tab-labels"],["mat-ripple","",1,"mat-mdc-tab-header-pagination","mat-mdc-tab-header-pagination-after",3,"mousedown","click","touchend","matRippleDisabled"]],template:function(e,a){e&1&&(K(),o(0,"div",5,0),T("click",function(){return a._handlePaginatorClick("before")})("mousedown",function(c){return a._handlePaginatorPress("before",c)})("touchend",function(){return a._stopInterval()}),k(2,"div",6),r(),o(3,"div",7,1),T("keydown",function(c){return a._handleKeydown(c)}),o(5,"div",8,2),T("cdkObserveContent",function(){return a._onContentChanges()}),o(7,"div",9,3),Y(9),r()()(),o(10,"div",10,4),T("mousedown",function(c){return a._handlePaginatorPress("after",c)})("click",function(){return a._handlePaginatorClick("after")})("touchend",function(){return a._stopInterval()}),k(12,"div",6),r()),e&2&&(C("mat-mdc-tab-header-pagination-disabled",a._disableScrollBefore),m("matRippleDisabled",a._disableScrollBefore||a.disableRipple),d(3),C("_mat-animation-noopable",a._animationsDisabled),d(2),R("aria-label",a.ariaLabel||null)("aria-labelledby",a.ariaLabelledby||null),d(5),C("mat-mdc-tab-header-pagination-disabled",a._disableScrollAfter),m("matRippleDisabled",a._disableScrollAfter||a.disableRipple))},dependencies:[pt,Kt],styles:[`.mat-mdc-tab-header {
  display: flex;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
}

.mdc-tab-indicator .mdc-tab-indicator__content {
  transition-duration: var(--mat-tab-animation-duration, 250ms);
}

.mat-mdc-tab-header-pagination {
  -webkit-user-select: none;
  user-select: none;
  position: relative;
  display: none;
  justify-content: center;
  align-items: center;
  min-width: 32px;
  cursor: pointer;
  z-index: 2;
  -webkit-tap-highlight-color: transparent;
  touch-action: none;
  box-sizing: content-box;
  outline: 0;
}
.mat-mdc-tab-header-pagination::-moz-focus-inner {
  border: 0;
}
.mat-mdc-tab-header-pagination .mat-ripple-element {
  opacity: 0.12;
  background-color: var(--mat-tab-inactive-ripple-color, var(--mat-sys-on-surface));
}
.mat-mdc-tab-header-pagination-controls-enabled .mat-mdc-tab-header-pagination {
  display: flex;
}

.mat-mdc-tab-header-pagination-before,
.mat-mdc-tab-header-rtl .mat-mdc-tab-header-pagination-after {
  padding-left: 4px;
}
.mat-mdc-tab-header-pagination-before .mat-mdc-tab-header-pagination-chevron,
.mat-mdc-tab-header-rtl .mat-mdc-tab-header-pagination-after .mat-mdc-tab-header-pagination-chevron {
  transform: rotate(-135deg);
}

.mat-mdc-tab-header-rtl .mat-mdc-tab-header-pagination-before,
.mat-mdc-tab-header-pagination-after {
  padding-right: 4px;
}
.mat-mdc-tab-header-rtl .mat-mdc-tab-header-pagination-before .mat-mdc-tab-header-pagination-chevron,
.mat-mdc-tab-header-pagination-after .mat-mdc-tab-header-pagination-chevron {
  transform: rotate(45deg);
}

.mat-mdc-tab-header-pagination-chevron {
  border-style: solid;
  border-width: 2px 2px 0 0;
  height: 8px;
  width: 8px;
  border-color: var(--mat-tab-pagination-icon-color, var(--mat-sys-on-surface));
}

.mat-mdc-tab-header-pagination-disabled {
  box-shadow: none;
  cursor: default;
  pointer-events: none;
}
.mat-mdc-tab-header-pagination-disabled .mat-mdc-tab-header-pagination-chevron {
  opacity: 0.4;
}

.mat-mdc-tab-list {
  flex-grow: 1;
  position: relative;
  transition: transform 500ms cubic-bezier(0.35, 0, 0.25, 1);
}
._mat-animation-noopable .mat-mdc-tab-list {
  transition: none;
}

.mat-mdc-tab-label-container {
  display: flex;
  flex-grow: 1;
  overflow: hidden;
  z-index: 1;
  border-bottom-style: solid;
  border-bottom-width: var(--mat-tab-divider-height, 1px);
  border-bottom-color: var(--mat-tab-divider-color, var(--mat-sys-surface-variant));
}
.mat-mdc-tab-group-inverted-header .mat-mdc-tab-label-container {
  border-bottom: none;
  border-top-style: solid;
  border-top-width: var(--mat-tab-divider-height, 1px);
  border-top-color: var(--mat-tab-divider-color, var(--mat-sys-surface-variant));
}

.mat-mdc-tab-labels {
  display: flex;
  flex: 1 0 auto;
}
[mat-align-tabs=center] > .mat-mdc-tab-header .mat-mdc-tab-labels {
  justify-content: center;
}
[mat-align-tabs=end] > .mat-mdc-tab-header .mat-mdc-tab-labels {
  justify-content: flex-end;
}
.cdk-drop-list .mat-mdc-tab-labels, .mat-mdc-tab-labels.cdk-drop-list {
  min-height: var(--mat-tab-container-height, 48px);
}

.mat-mdc-tab::before {
  margin: 5px;
}
@media (forced-colors: active) {
  .mat-mdc-tab[aria-disabled=true] {
    color: GrayText;
  }
}
`],encapsulation:2})}return n})(),un=new L("MAT_TABS_CONFIG"),Be=(()=>{class n extends ht{_host=b(ft);_ngZone=b(N);_centeringSub=E.EMPTY;_leavingSub=E.EMPTY;constructor(){super()}ngOnInit(){super.ngOnInit(),this._centeringSub=this._host._beforeCentering.pipe($(this._host._isCenterPosition())).subscribe(t=>{this._host._content&&t&&!this.hasAttached()&&this._ngZone.run(()=>{Promise.resolve().then(),this.attach(this._host._content)})}),this._leavingSub=this._host._afterLeavingCenter.subscribe(()=>{this._host.preserveContent||this._ngZone.run(()=>this.detach())})}ngOnDestroy(){super.ngOnDestroy(),this._centeringSub.unsubscribe(),this._leavingSub.unsubscribe()}static \u0275fac=function(e){return new(e||n)};static \u0275dir=S({type:n,selectors:[["","matTabBodyHost",""]],features:[H]})}return n})(),ft=(()=>{class n{_elementRef=b(B);_dir=b(_t,{optional:!0});_ngZone=b(N);_injector=b(it);_renderer=b(ot);_diAnimationsDisabled=nt();_eventCleanups;_initialized=!1;_fallbackTimer;_positionIndex;_dirChangeSubscription=E.EMPTY;_position;_previousPosition;_onCentering=new x;_beforeCentering=new x;_afterLeavingCenter=new x;_onCentered=new x(!0);_portalHost;_contentElement;_content;animationDuration="500ms";preserveContent=!1;set position(t){this._positionIndex=t,this._computePositionAnimationState()}constructor(){if(this._dir){let t=b(tt);this._dirChangeSubscription=this._dir.change.subscribe(e=>{this._computePositionAnimationState(e),t.markForCheck()})}}ngOnInit(){this._bindTransitionEvents(),this._position==="center"&&(this._setActiveClass(!0),q(()=>this._onCentering.emit(this._elementRef.nativeElement.clientHeight),{injector:this._injector})),this._initialized=!0}ngOnDestroy(){clearTimeout(this._fallbackTimer),this._eventCleanups?.forEach(t=>t()),this._dirChangeSubscription.unsubscribe()}_bindTransitionEvents(){this._ngZone.runOutsideAngular(()=>{let t=this._elementRef.nativeElement,e=a=>{a.target===this._contentElement?.nativeElement&&(this._elementRef.nativeElement.classList.remove("mat-tab-body-animating"),a.type==="transitionend"&&this._transitionDone())};this._eventCleanups=[this._renderer.listen(t,"transitionstart",a=>{a.target===this._contentElement?.nativeElement&&(this._elementRef.nativeElement.classList.add("mat-tab-body-animating"),this._transitionStarted())}),this._renderer.listen(t,"transitionend",e),this._renderer.listen(t,"transitioncancel",e)]})}_transitionStarted(){clearTimeout(this._fallbackTimer);let t=this._position==="center";this._beforeCentering.emit(t),t&&this._onCentering.emit(this._elementRef.nativeElement.clientHeight)}_transitionDone(){this._position==="center"?this._onCentered.emit():this._previousPosition==="center"&&this._afterLeavingCenter.emit()}_setActiveClass(t){this._elementRef.nativeElement.classList.toggle("mat-mdc-tab-body-active",t)}_getLayoutDirection(){return this._dir&&this._dir.value==="rtl"?"rtl":"ltr"}_isCenterPosition(){return this._positionIndex===0}_computePositionAnimationState(t=this._getLayoutDirection()){this._previousPosition=this._position,this._positionIndex<0?this._position=t=="ltr"?"left":"right":this._positionIndex>0?this._position=t=="ltr"?"right":"left":this._position="center",this._animationsDisabled()?this._simulateTransitionEvents():this._initialized&&(this._position==="center"||this._previousPosition==="center")&&(clearTimeout(this._fallbackTimer),this._fallbackTimer=this._ngZone.runOutsideAngular(()=>setTimeout(()=>this._simulateTransitionEvents(),100)))}_simulateTransitionEvents(){this._transitionStarted(),q(()=>this._transitionDone(),{injector:this._injector})}_animationsDisabled(){return this._diAnimationsDisabled||this.animationDuration==="0ms"||this.animationDuration==="0s"}static \u0275fac=function(e){return new(e||n)};static \u0275cmp=O({type:n,selectors:[["mat-tab-body"]],viewQuery:function(e,a){if(e&1&&j(Be,5)(Ue,5),e&2){let s;u(s=g())&&(a._portalHost=s.first),u(s=g())&&(a._contentElement=s.first)}},hostAttrs:[1,"mat-mdc-tab-body"],hostVars:1,hostBindings:function(e,a){e&2&&R("inert",a._position==="center"?null:"")},inputs:{_content:[0,"content","_content"],animationDuration:"animationDuration",preserveContent:"preserveContent",position:"position"},outputs:{_onCentering:"_onCentering",_beforeCentering:"_beforeCentering",_onCentered:"_onCentered"},decls:3,vars:6,consts:[["content",""],["cdkScrollable","",1,"mat-mdc-tab-body-content"],["matTabBodyHost",""]],template:function(e,a){e&1&&(o(0,"div",1,0),p(2,Xe,0,0,"ng-template",2),r()),e&2&&C("mat-tab-body-content-left",a._position==="left")("mat-tab-body-content-right",a._position==="right")("mat-tab-body-content-can-animate",a._position==="center"||a._previousPosition==="center")},dependencies:[Be,re],styles:[`.mat-mdc-tab-body {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  position: absolute;
  display: block;
  overflow: hidden;
  outline: 0;
  flex-basis: 100%;
}
.mat-mdc-tab-body.mat-mdc-tab-body-active {
  position: relative;
  overflow-x: hidden;
  overflow-y: auto;
  z-index: 1;
  flex-grow: 1;
}
.mat-mdc-tab-group.mat-mdc-tab-group-dynamic-height .mat-mdc-tab-body.mat-mdc-tab-body-active {
  overflow-y: hidden;
}

.mat-mdc-tab-body-content {
  height: 100%;
  overflow: auto;
  transform: none;
  visibility: hidden;
}
.mat-tab-body-animating > .mat-mdc-tab-body-content, .mat-mdc-tab-body-active > .mat-mdc-tab-body-content {
  visibility: visible;
}
.mat-tab-body-animating > .mat-mdc-tab-body-content {
  min-height: 1px;
}
.mat-mdc-tab-group-dynamic-height .mat-mdc-tab-body-content {
  overflow: hidden;
}

.mat-tab-body-content-can-animate {
  transition: transform var(--mat-tab-animation-duration) 1ms cubic-bezier(0.35, 0, 0.25, 1);
}
.mat-mdc-tab-body-wrapper._mat-animation-noopable .mat-tab-body-content-can-animate {
  transition: none;
}

.mat-tab-body-content-left {
  transform: translate3d(-100%, 0, 0);
}

.mat-tab-body-content-right {
  transform: translate3d(100%, 0, 0);
}
`],encapsulation:2})}return n})(),He=(()=>{class n{_elementRef=b(B);_changeDetectorRef=b(tt);_ngZone=b(N);_tabsSubscription=E.EMPTY;_tabLabelSubscription=E.EMPTY;_tabBodySubscription=E.EMPTY;_diAnimationsDisabled=nt();_allTabs;_tabBodies;_tabBodyWrapper;_tabHeader;_tabs=new Lt;_indexToSelect=0;_lastFocusedTabIndex=null;_tabBodyWrapperHeight=0;color;get fitInkBarToContent(){return this._fitInkBarToContent}set fitInkBarToContent(t){this._fitInkBarToContent=t,this._changeDetectorRef.markForCheck()}_fitInkBarToContent=!1;stretchTabs=!0;alignTabs=null;dynamicHeight=!1;get selectedIndex(){return this._selectedIndex}set selectedIndex(t){this._indexToSelect=isNaN(t)?null:t}_selectedIndex=null;headerPosition="above";get animationDuration(){return this._animationDuration}set animationDuration(t){let e=t+"";this._animationDuration=/^\d+$/.test(e)?t+"ms":e}_animationDuration;get contentTabIndex(){return this._contentTabIndex}set contentTabIndex(t){this._contentTabIndex=isNaN(t)?null:t}_contentTabIndex=null;disablePagination=!1;disableRipple=!1;preserveContent=!1;get backgroundColor(){return this._backgroundColor}set backgroundColor(t){let e=this._elementRef.nativeElement.classList;e.remove("mat-tabs-with-background",`mat-background-${this.backgroundColor}`),t&&e.add("mat-tabs-with-background",`mat-background-${t}`),this._backgroundColor=t}_backgroundColor;ariaLabel;ariaLabelledby;selectedIndexChange=new x;focusChange=new x;animationDone=new x;selectedTabChange=new x(!0);_groupId;_isServer=!b(bt).isBrowser;constructor(){let t=b(un,{optional:!0});this._groupId=b(Xt).getId("mat-tab-group-"),this.animationDuration=t&&t.animationDuration?t.animationDuration:"500ms",this.disablePagination=t&&t.disablePagination!=null?t.disablePagination:!1,this.dynamicHeight=t&&t.dynamicHeight!=null?t.dynamicHeight:!1,t?.contentTabIndex!=null&&(this.contentTabIndex=t.contentTabIndex),this.preserveContent=!!t?.preserveContent,this.fitInkBarToContent=t&&t.fitInkBarToContent!=null?t.fitInkBarToContent:!1,this.stretchTabs=t&&t.stretchTabs!=null?t.stretchTabs:!0,this.alignTabs=t&&t.alignTabs!=null?t.alignTabs:null}ngAfterContentChecked(){let t=this._indexToSelect=this._clampTabIndex(this._indexToSelect);if(this._selectedIndex!=t){let e=this._selectedIndex==null;if(!e){this.selectedTabChange.emit(this._createChangeEvent(t));let a=this._tabBodyWrapper.nativeElement;a.style.minHeight=a.clientHeight+"px"}Promise.resolve().then(()=>{this._tabs.forEach((a,s)=>a.isActive=s===t),e||(this.selectedIndexChange.emit(t),this._tabBodyWrapper.nativeElement.style.minHeight="")})}this._tabs.forEach((e,a)=>{e.position=a-t,this._selectedIndex!=null&&e.position==0&&!e.origin&&(e.origin=t-this._selectedIndex)}),this._selectedIndex!==t&&(this._selectedIndex=t,this._lastFocusedTabIndex=null,this._changeDetectorRef.markForCheck())}ngAfterContentInit(){this._subscribeToAllTabChanges(),this._subscribeToTabLabels(),this._tabsSubscription=this._tabs.changes.subscribe(()=>{let t=this._clampTabIndex(this._indexToSelect);if(t===this._selectedIndex){let e=this._tabs.toArray(),a;for(let s=0;s<e.length;s++)if(e[s].isActive){this._indexToSelect=this._selectedIndex=s,this._lastFocusedTabIndex=null,a=e[s];break}!a&&e[t]&&Promise.resolve().then(()=>{e[t].isActive=!0,this.selectedTabChange.emit(this._createChangeEvent(t))})}this._changeDetectorRef.markForCheck()})}ngAfterViewInit(){this._tabBodySubscription=this._tabBodies.changes.subscribe(()=>this._bodyCentered(!0))}_subscribeToAllTabChanges(){this._allTabs.changes.pipe($(this._allTabs)).subscribe(t=>{this._tabs.reset(t.filter(e=>e._closestTabGroup===this||!e._closestTabGroup)),this._tabs.notifyOnChanges()})}ngOnDestroy(){this._tabs.destroy(),this._tabsSubscription.unsubscribe(),this._tabLabelSubscription.unsubscribe(),this._tabBodySubscription.unsubscribe()}realignInkBar(){this._tabHeader&&this._tabHeader._alignInkBarToSelectedTab()}updatePagination(){this._tabHeader&&this._tabHeader.updatePagination()}focusTab(t){let e=this._tabHeader;e&&(e.focusIndex=t)}_focusChanged(t){this._lastFocusedTabIndex=t,this.focusChange.emit(this._createChangeEvent(t))}_createChangeEvent(t){let e=new vt;return e.index=t,this._tabs&&this._tabs.length&&(e.tab=this._tabs.toArray()[t]),e}_subscribeToTabLabels(){this._tabLabelSubscription&&this._tabLabelSubscription.unsubscribe(),this._tabLabelSubscription=W(...this._tabs.map(t=>t._stateChanges)).subscribe(()=>this._changeDetectorRef.markForCheck())}_clampTabIndex(t){return Math.min(this._tabs.length-1,Math.max(t||0,0))}_getTabLabelId(t,e){return t.id||`${this._groupId}-label-${e}`}_getTabContentId(t){return`${this._groupId}-content-${t}`}_setTabBodyWrapperHeight(t){if(!this.dynamicHeight||!this._tabBodyWrapperHeight){this._tabBodyWrapperHeight=t;return}let e=this._tabBodyWrapper.nativeElement;e.style.height=this._tabBodyWrapperHeight+"px",this._tabBodyWrapper.nativeElement.offsetHeight&&(e.style.height=t+"px")}_removeTabBodyWrapperHeight(){let t=this._tabBodyWrapper.nativeElement;this._tabBodyWrapperHeight=t.clientHeight,t.style.height="",this._ngZone.run(()=>this.animationDone.emit())}_handleClick(t,e,a){e.focusIndex=a,t.disabled||(this.selectedIndex=a)}_getTabIndex(t){let e=this._lastFocusedTabIndex??this.selectedIndex;return t===e?0:-1}_tabFocusChanged(t,e){t&&t!=="mouse"&&t!=="touch"&&(this._tabHeader.focusIndex=e)}_bodyCentered(t){t&&this._tabBodies?.forEach((e,a)=>e._setActiveClass(a===this._selectedIndex))}_animationsDisabled(){return this._diAnimationsDisabled||this.animationDuration==="0"||this.animationDuration==="0ms"}static \u0275fac=function(e){return new(e||n)};static \u0275cmp=O({type:n,selectors:[["mat-tab-group"]],contentQueries:function(e,a,s){if(e&1&&U(s,xt,5),e&2){let c;u(c=g())&&(a._allTabs=c)}},viewQuery:function(e,a){if(e&1&&j(Je,5)(tn,5)(ft,5),e&2){let s;u(s=g())&&(a._tabBodyWrapper=s.first),u(s=g())&&(a._tabHeader=s.first),u(s=g())&&(a._tabBodies=s)}},hostAttrs:[1,"mat-mdc-tab-group"],hostVars:11,hostBindings:function(e,a){e&2&&(R("mat-align-tabs",a.alignTabs),X("mat-"+(a.color||"primary")),Ht("--mat-tab-animation-duration",a.animationDuration),C("mat-mdc-tab-group-dynamic-height",a.dynamicHeight)("mat-mdc-tab-group-inverted-header",a.headerPosition==="below")("mat-mdc-tab-group-stretch-tabs",a.stretchTabs))},inputs:{color:"color",fitInkBarToContent:[2,"fitInkBarToContent","fitInkBarToContent",y],stretchTabs:[2,"mat-stretch-tabs","stretchTabs",y],alignTabs:[0,"mat-align-tabs","alignTabs"],dynamicHeight:[2,"dynamicHeight","dynamicHeight",y],selectedIndex:[2,"selectedIndex","selectedIndex",et],headerPosition:"headerPosition",animationDuration:"animationDuration",contentTabIndex:[2,"contentTabIndex","contentTabIndex",et],disablePagination:[2,"disablePagination","disablePagination",y],disableRipple:[2,"disableRipple","disableRipple",y],preserveContent:[2,"preserveContent","preserveContent",y],backgroundColor:"backgroundColor",ariaLabel:[0,"aria-label","ariaLabel"],ariaLabelledby:[0,"aria-labelledby","ariaLabelledby"]},outputs:{selectedIndexChange:"selectedIndexChange",focusChange:"focusChange",animationDone:"animationDone",selectedTabChange:"selectedTabChange"},exportAs:["matTabGroup"],features:[Q([{provide:Fe,useExisting:n}])],ngContentSelectors:Ct,decls:9,vars:8,consts:[["tabHeader",""],["tabBodyWrapper",""],["tabNode",""],[3,"indexFocused","selectFocusedIndex","selectedIndex","disableRipple","disablePagination","aria-label","aria-labelledby"],["role","tab","matTabLabelWrapper","","cdkMonitorElementFocus","",1,"mdc-tab","mat-mdc-tab","mat-focus-indicator",3,"id","mdc-tab--active","class","disabled","fitInkBarToContent"],[1,"mat-mdc-tab-body-wrapper"],["role","tabpanel",3,"id","class","content","position","animationDuration","preserveContent"],["role","tab","matTabLabelWrapper","","cdkMonitorElementFocus","",1,"mdc-tab","mat-mdc-tab","mat-focus-indicator",3,"click","cdkFocusChange","id","disabled","fitInkBarToContent"],[1,"mdc-tab__ripple"],["mat-ripple","",1,"mat-mdc-tab-ripple",3,"matRippleTrigger","matRippleDisabled"],[1,"mdc-tab__content"],[1,"mdc-tab__text-label"],[3,"cdkPortalOutlet"],["role","tabpanel",3,"_onCentered","_onCentering","_beforeCentering","id","content","position","animationDuration","preserveContent"]],template:function(e,a){e&1&&(K(),o(0,"mat-tab-header",3,0),T("indexFocused",function(c){return a._focusChanged(c)})("selectFocusedIndex",function(c){return a.selectedIndex=c}),dt(2,on,8,17,"div",4,lt),r(),rt(4,rn,1,0),o(5,"div",5,1),dt(7,sn,1,10,"mat-tab-body",6,lt),r()),e&2&&(m("selectedIndex",a.selectedIndex||0)("disableRipple",a.disableRipple)("disablePagination",a.disablePagination),Nt("aria-label",a.ariaLabel)("aria-labelledby",a.ariaLabelledby),d(2),ct(a._tabs),d(2),st(a._isServer?4:-1),d(),C("_mat-animation-noopable",a._animationsDisabled()),d(2),ct(a._tabs))},dependencies:[hn,Ne,qt,pt,ht,ft],styles:[`.mdc-tab {
  min-width: 90px;
  padding: 0 24px;
  display: flex;
  flex: 1 0 auto;
  justify-content: center;
  box-sizing: border-box;
  border: none;
  outline: none;
  text-align: center;
  white-space: nowrap;
  cursor: pointer;
  z-index: 1;
  touch-action: manipulation;
}

.mdc-tab__content {
  display: flex;
  align-items: center;
  justify-content: center;
  height: inherit;
  pointer-events: none;
}

.mdc-tab__text-label {
  transition: 150ms color linear;
  display: inline-block;
  line-height: 1;
  z-index: 2;
}

.mdc-tab--active .mdc-tab__text-label {
  transition-delay: 100ms;
}

._mat-animation-noopable .mdc-tab__text-label {
  transition: none;
}

.mdc-tab-indicator {
  display: flex;
  position: absolute;
  top: 0;
  left: 0;
  justify-content: center;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.mdc-tab-indicator__content {
  transition: var(--mat-tab-animation-duration, 250ms) transform cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: left;
  opacity: 0;
}

.mdc-tab-indicator__content--underline {
  align-self: flex-end;
  box-sizing: border-box;
  width: 100%;
  border-top-style: solid;
}

.mdc-tab-indicator--active .mdc-tab-indicator__content {
  opacity: 1;
}

._mat-animation-noopable .mdc-tab-indicator__content, .mdc-tab-indicator--no-transition .mdc-tab-indicator__content {
  transition: none;
}

.mat-mdc-tab-ripple.mat-mdc-tab-ripple {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  pointer-events: none;
}

.mat-mdc-tab {
  -webkit-tap-highlight-color: transparent;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-decoration: none;
  background: none;
  height: var(--mat-tab-container-height, 48px);
  font-family: var(--mat-tab-label-text-font, var(--mat-sys-title-small-font));
  font-size: var(--mat-tab-label-text-size, var(--mat-sys-title-small-size));
  letter-spacing: var(--mat-tab-label-text-tracking, var(--mat-sys-title-small-tracking));
  line-height: var(--mat-tab-label-text-line-height, var(--mat-sys-title-small-line-height));
  font-weight: var(--mat-tab-label-text-weight, var(--mat-sys-title-small-weight));
}
.mat-mdc-tab.mdc-tab {
  flex-grow: 0;
}
.mat-mdc-tab .mdc-tab-indicator__content--underline {
  border-color: var(--mat-tab-active-indicator-color, var(--mat-sys-primary));
  border-top-width: var(--mat-tab-active-indicator-height, 2px);
  border-radius: var(--mat-tab-active-indicator-shape, 0);
}
.mat-mdc-tab:hover .mdc-tab__text-label {
  color: var(--mat-tab-inactive-hover-label-text-color, var(--mat-sys-on-surface));
}
.mat-mdc-tab:focus .mdc-tab__text-label {
  color: var(--mat-tab-inactive-focus-label-text-color, var(--mat-sys-on-surface));
}
.mat-mdc-tab.mdc-tab--active .mdc-tab__text-label {
  color: var(--mat-tab-active-label-text-color, var(--mat-sys-on-surface));
}
.mat-mdc-tab.mdc-tab--active .mdc-tab__ripple::before,
.mat-mdc-tab.mdc-tab--active .mat-ripple-element {
  background-color: var(--mat-tab-active-ripple-color, var(--mat-sys-on-surface));
}
.mat-mdc-tab.mdc-tab--active:hover .mdc-tab__text-label {
  color: var(--mat-tab-active-hover-label-text-color, var(--mat-sys-on-surface));
}
.mat-mdc-tab.mdc-tab--active:hover .mdc-tab-indicator__content--underline {
  border-color: var(--mat-tab-active-hover-indicator-color, var(--mat-sys-primary));
}
.mat-mdc-tab.mdc-tab--active:focus .mdc-tab__text-label {
  color: var(--mat-tab-active-focus-label-text-color, var(--mat-sys-on-surface));
}
.mat-mdc-tab.mdc-tab--active:focus .mdc-tab-indicator__content--underline {
  border-color: var(--mat-tab-active-focus-indicator-color, var(--mat-sys-primary));
}
.mat-mdc-tab.mat-mdc-tab-disabled {
  opacity: 0.4;
  pointer-events: none;
}
.mat-mdc-tab.mat-mdc-tab-disabled .mdc-tab__content {
  pointer-events: none;
}
.mat-mdc-tab.mat-mdc-tab-disabled .mdc-tab__ripple::before,
.mat-mdc-tab.mat-mdc-tab-disabled .mat-ripple-element {
  background-color: var(--mat-tab-disabled-ripple-color, var(--mat-sys-on-surface-variant));
}
.mat-mdc-tab .mdc-tab__ripple::before {
  content: "";
  display: block;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: 0;
  pointer-events: none;
  background-color: var(--mat-tab-inactive-ripple-color, var(--mat-sys-on-surface));
}
.mat-mdc-tab .mdc-tab__text-label {
  color: var(--mat-tab-inactive-label-text-color, var(--mat-sys-on-surface));
  display: inline-flex;
  align-items: center;
}
.mat-mdc-tab .mdc-tab__content {
  position: relative;
  pointer-events: auto;
}
.mat-mdc-tab:hover .mdc-tab__ripple::before {
  opacity: 0.04;
}
.mat-mdc-tab.cdk-program-focused .mdc-tab__ripple::before, .mat-mdc-tab.cdk-keyboard-focused .mdc-tab__ripple::before {
  opacity: 0.12;
}
.mat-mdc-tab .mat-ripple-element {
  opacity: 0.12;
  background-color: var(--mat-tab-inactive-ripple-color, var(--mat-sys-on-surface));
}
.mat-mdc-tab-group.mat-mdc-tab-group-stretch-tabs > .mat-mdc-tab-header .mat-mdc-tab {
  flex-grow: 1;
}

.mat-mdc-tab-group {
  display: flex;
  flex-direction: column;
  max-width: 100%;
}
.mat-mdc-tab-group.mat-tabs-with-background > .mat-mdc-tab-header, .mat-mdc-tab-group.mat-tabs-with-background > .mat-mdc-tab-header-pagination {
  background-color: var(--mat-tab-background-color);
}
.mat-mdc-tab-group.mat-tabs-with-background.mat-primary > .mat-mdc-tab-header .mat-mdc-tab .mdc-tab__text-label {
  color: var(--mat-tab-foreground-color);
}
.mat-mdc-tab-group.mat-tabs-with-background.mat-primary > .mat-mdc-tab-header .mdc-tab-indicator__content--underline {
  border-color: var(--mat-tab-foreground-color);
}
.mat-mdc-tab-group.mat-tabs-with-background:not(.mat-primary) > .mat-mdc-tab-header .mat-mdc-tab:not(.mdc-tab--active) .mdc-tab__text-label {
  color: var(--mat-tab-foreground-color);
}
.mat-mdc-tab-group.mat-tabs-with-background:not(.mat-primary) > .mat-mdc-tab-header .mat-mdc-tab:not(.mdc-tab--active) .mdc-tab-indicator__content--underline {
  border-color: var(--mat-tab-foreground-color);
}
.mat-mdc-tab-group.mat-tabs-with-background > .mat-mdc-tab-header .mat-mdc-tab-header-pagination-chevron,
.mat-mdc-tab-group.mat-tabs-with-background > .mat-mdc-tab-header .mat-focus-indicator::before, .mat-mdc-tab-group.mat-tabs-with-background > .mat-mdc-tab-header-pagination .mat-mdc-tab-header-pagination-chevron,
.mat-mdc-tab-group.mat-tabs-with-background > .mat-mdc-tab-header-pagination .mat-focus-indicator::before {
  border-color: var(--mat-tab-foreground-color);
}
.mat-mdc-tab-group.mat-tabs-with-background > .mat-mdc-tab-header .mat-ripple-element, .mat-mdc-tab-group.mat-tabs-with-background > .mat-mdc-tab-header .mdc-tab__ripple::before, .mat-mdc-tab-group.mat-tabs-with-background > .mat-mdc-tab-header-pagination .mat-ripple-element, .mat-mdc-tab-group.mat-tabs-with-background > .mat-mdc-tab-header-pagination .mdc-tab__ripple::before {
  background-color: var(--mat-tab-foreground-color);
}
.mat-mdc-tab-group.mat-tabs-with-background > .mat-mdc-tab-header .mat-mdc-tab-header-pagination-chevron, .mat-mdc-tab-group.mat-tabs-with-background > .mat-mdc-tab-header-pagination .mat-mdc-tab-header-pagination-chevron {
  color: var(--mat-tab-foreground-color);
}
.mat-mdc-tab-group.mat-mdc-tab-group-inverted-header {
  flex-direction: column-reverse;
}
.mat-mdc-tab-group.mat-mdc-tab-group-inverted-header .mdc-tab-indicator__content--underline {
  align-self: flex-start;
}

.mat-mdc-tab-body-wrapper {
  position: relative;
  overflow: hidden;
  display: flex;
  transition: height 500ms cubic-bezier(0.35, 0, 0.25, 1);
}
.mat-mdc-tab-body-wrapper._mat-animation-noopable {
  transition: none !important;
  animation: none !important;
}
`],encapsulation:2})}return n})(),vt=class{index;tab};var ze=(()=>{class n{static \u0275fac=function(e){return new(e||n)};static \u0275mod=At({type:n});static \u0275inj=Ot({imports:[ee]})}return n})();function fn(n,i){n&1&&(o(0,"mat-icon"),l(1,"description"),r(),l(2," Documento y stock "))}function vn(n,i){n&1&&(o(0,"div",15),l(1,"Cargando registro de compra..."),r())}function Cn(n,i){n&1&&(o(0,"th",39),l(1,"Material"),r())}function yn(n,i){if(n&1&&(o(0,"td",40)(1,"strong"),l(2),r()()),n&2){let t=i.$implicit;d(2),h(t.nombreMaterial)}}function xn(n,i){n&1&&(o(0,"th",39),l(1,"Descripcion"),r())}function kn(n,i){if(n&1&&(o(0,"td",40),l(1),r()),n&2){let t=i.$implicit;d(),h(t.descripcionOriginal||"-")}}function Tn(n,i){n&1&&(o(0,"th",39),l(1,"Cantidad"),r())}function Mn(n,i){if(n&1&&(o(0,"td",41),l(1),r()),n&2){let t=i.$implicit;d(),M(" ",t.cantidadSolicitada||t.cantidad," ")}}function Pn(n,i){n&1&&(o(0,"th",39),l(1,"Unidad"),r())}function In(n,i){if(n&1&&(o(0,"td",40),l(1),r()),n&2){let t=i.$implicit;d(),h(t.unidad)}}function wn(n,i){n&1&&(o(0,"th",39),l(1,"Liberado"),r())}function Rn(n,i){if(n&1&&(o(0,"td",41),l(1),r()),n&2){let t=i.$implicit;d(),M(" ",t.cantidadRecibida||0," ")}}function Dn(n,i){n&1&&(o(0,"th",39),l(1,"En remitos"),r())}function En(n,i){if(n&1&&(o(0,"td",41),l(1),r()),n&2){let t=i.$implicit;d(),M(" ",t.cantidadEnRemitos||0," ")}}function On(n,i){n&1&&(o(0,"th",39),l(1,"Pend. liberar"),r())}function Sn(n,i){if(n&1&&(o(0,"td",41),l(1),r()),n&2){let t=i.$implicit,e=_(3);d(),M(" ",e.pendienteLiberarDetalle(t)," ")}}function Ln(n,i){n&1&&(o(0,"th",39),l(1,"Estado liberaci\xF3n"),r())}function Bn(n,i){if(n&1&&(o(0,"td",40)(1,"span",42),l(2),r()()),n&2){let t=i.$implicit;d(),m("ngClass",(t.estadoLiberacion||"PENDIENTE").toLowerCase()),d(),M(" ",t.estadoLiberacion||"PENDIENTE"," ")}}function An(n,i){n&1&&k(0,"tr",43)}function Fn(n,i){n&1&&k(0,"tr",44)}function Nn(n,i){if(n&1&&(o(0,"div",24)(1,"table",25),f(2,26),p(3,Cn,2,0,"th",27)(4,yn,3,1,"td",28),v(),f(5,29),p(6,xn,2,0,"th",27)(7,kn,2,1,"td",28),v(),f(8,30),p(9,Tn,2,0,"th",27)(10,Mn,2,1,"td",31),v(),f(11,32),p(12,Pn,2,0,"th",27)(13,In,2,1,"td",28),v(),f(14,33),p(15,wn,2,0,"th",27)(16,Rn,2,1,"td",31),v(),f(17,34),p(18,Dn,2,0,"th",27)(19,En,2,1,"td",31),v(),f(20,35),p(21,On,2,0,"th",27)(22,Sn,2,1,"td",31),v(),f(23,36),p(24,Ln,2,0,"th",27)(25,Bn,3,2,"td",28),v(),p(26,An,1,0,"tr",37)(27,Fn,1,0,"tr",38),r()()),n&2){let t=_(2);d(),m("dataSource",t.registro.detalle),d(25),m("matHeaderRowDef",t.detalleColumns),d(),m("matRowDefColumns",t.detalleColumns)}}function Hn(n,i){n&1&&(o(0,"div",15),l(1," Este registro no tiene lineas cargadas. "),r())}function zn(n,i){n&1&&(o(0,"div",15),l(1,"Calculando stock liberado..."),r())}function jn(n,i){if(n&1&&(o(0,"tr")(1,"td")(2,"strong"),l(3),r()(),o(4,"td",50),l(5),r(),o(6,"td",50),l(7),r(),o(8,"td",50),l(9),r(),o(10,"td")(11,"span",42),l(12),r()()()),n&2){let t=i.$implicit;d(3),h(t.material),d(2),J("",t.esperado," ",t.unidad),d(2),J("",t.liberado," ",t.unidad),d(2),J("",t.pendiente," ",t.unidad),d(2),m("ngClass",t.estado.toLowerCase()),d(),h(t.estado)}}function Qn(n,i){if(n&1&&(o(0,"div",24)(1,"table",45)(2,"colgroup"),k(3,"col",46)(4,"col",47)(5,"col",47)(6,"col",47)(7,"col",48),r(),o(8,"thead")(9,"tr")(10,"th"),l(11,"Material"),r(),o(12,"th"),l(13,"Esperado"),r(),o(14,"th"),l(15,"Liberado"),r(),o(16,"th"),l(17,"Pendiente"),r(),o(18,"th"),l(19,"Estado"),r()()(),o(20,"tbody"),p(21,jn,13,9,"tr",49),r()()()),n&2){let t=_(2);d(21),m("ngForOf",t.stockLiberado)}}function Vn(n,i){n&1&&(o(0,"div",15),l(1," No hay materiales para calcular stock esperado y liberado. "),r())}function Wn(n,i){if(n&1&&(o(0,"mat-accordion",16)(1,"mat-expansion-panel",17)(2,"mat-expansion-panel-header",18)(3,"mat-panel-title")(4,"span",6),l(5,"Datos generales"),r()()(),o(6,"div",19)(7,"div",20)(8,"span"),l(9,"Numero"),r(),o(10,"strong"),l(11),r()(),o(12,"div",20)(13,"span"),l(14,"Tipo"),r(),o(15,"strong"),l(16),r()(),o(17,"div",20)(18,"span"),l(19,"Fecha"),r(),o(20,"strong"),l(21),r()(),o(22,"div",20)(23,"span"),l(24,"Fecha entrega"),r(),o(25,"strong"),l(26),r()(),o(27,"div",20)(28,"span"),l(29,"Proyecto"),r(),o(30,"strong"),l(31),r()(),o(32,"div",20)(33,"span"),l(34,"Proveedor"),r(),o(35,"strong"),l(36),r()(),o(37,"div",20)(38,"span"),l(39,"Estado de liberaci\xC3\xB3n"),r(),o(40,"strong"),l(41),r()(),o(42,"div",20)(43,"span"),l(44,"CUIT"),r(),o(45,"strong"),l(46),r()(),o(47,"div",21)(48,"span"),l(49,"Observaciones"),r(),o(50,"strong"),l(51),r()()()(),o(52,"mat-expansion-panel",17)(53,"mat-expansion-panel-header",18)(54,"mat-panel-title")(55,"span",6),l(56,"Detalle"),r()(),o(57,"mat-panel-description")(58,"span",22),l(59),r()()(),p(60,Nn,28,3,"div",14)(61,Hn,2,0,"div",10),r(),o(62,"mat-expansion-panel",17)(63,"mat-expansion-panel-header",18)(64,"mat-panel-title")(65,"span",6),l(66,"Stock y liberaciones"),r()(),o(67,"mat-panel-description")(68,"span",23),l(69),r()()(),p(70,zn,2,0,"div",10)(71,Qn,22,1,"div",14)(72,Vn,2,0,"div",10),r()()),n&2){let t=_();d(),m("expanded",!0),d(10),h(t.registro.numero),d(5),h(t.registro.tipo||"OC"),d(5),h(t.formatearFecha(t.registro.fecha)),d(5),h(t.formatearFecha(t.registro.fechaEntrega)),d(5),h((t.registro.proyecto==null?null:t.registro.proyecto.nombre)||"Sin proyecto"),d(5),h(t.registro.proveedor.razonSocial||"-"),d(5),h(t.estadoLiberacionRegistro),d(5),h(t.registro.proveedor.cuit||"-"),d(5),h(t.registro.observaciones||"-"),d(),m("expanded",!0),d(7),M("",t.registro.detalle.length," ITEMS"),d(),m("ngIf",t.registro.detalle.length),d(),m("ngIf",!t.registro.detalle.length),d(),m("expanded",!0),d(7),zt(" ",t.estadoLiberacionRegistro," \xC2\xB7 ",t.materialesLiberadosResumen,"/",t.stockLiberado.length," MATERIALES LIBERADOS "),d(),m("ngIf",t.cargandoStock),d(),m("ngIf",!t.cargandoStock&&t.stockLiberado.length),d(),m("ngIf",!t.cargandoStock&&!t.stockLiberado.length)}}function $n(n,i){n&1&&(o(0,"div",15),l(1," No se pudo cargar el detalle del registro de compra. "),r())}function Gn(n,i){n&1&&(o(0,"mat-icon"),l(1,"assignment"),r(),l(2," Remitos "))}function qn(n,i){n&1&&(o(0,"div",15),l(1,"Cargando remitos..."),r())}function Zn(n,i){n&1&&(o(0,"th",39),l(1,"Numero"),r())}function Kn(n,i){if(n&1&&(o(0,"td",40)(1,"strong"),l(2),r()()),n&2){let t=i.$implicit;d(2),h(t.numero)}}function Yn(n,i){n&1&&(o(0,"th",39),l(1,"Fecha"),r())}function Un(n,i){if(n&1&&(o(0,"td",40),l(1),r()),n&2){let t=i.$implicit,e=_(2);d(),h(e.formatearFecha(t.fecha))}}function Xn(n,i){n&1&&(o(0,"th",39),l(1,"Estado"),r())}function Jn(n,i){if(n&1&&(o(0,"td",40)(1,"span",58),l(2),r()()),n&2){let t=i.$implicit,e=_(2);d(),C("completo",t.liberado)("pendiente",!t.liberado),d(),M(" ",e.estadoRemito(t)," ")}}function ta(n,i){n&1&&(o(0,"th",59),l(1,"Acciones"),r())}function ea(n,i){if(n&1){let t=z();o(0,"td",60)(1,"div",61)(2,"button",62),T("click",function(){let a=I(t).$implicit,s=_(2);return w(s.verRemito(a))}),o(3,"mat-icon"),l(4,"visibility"),r()()()()}}function na(n,i){n&1&&k(0,"tr",43)}function aa(n,i){n&1&&k(0,"tr",44)}function ia(n,i){if(n&1&&(o(0,"div",24)(1,"table",51),f(2,52),p(3,Zn,2,0,"th",27)(4,Kn,3,1,"td",28),v(),f(5,53),p(6,Yn,2,0,"th",27)(7,Un,2,1,"td",28),v(),f(8,54),p(9,Xn,2,0,"th",27)(10,Jn,3,5,"td",28),v(),f(11,55),p(12,ta,2,0,"th",56)(13,ea,5,0,"td",57),v(),p(14,na,1,0,"tr",37)(15,aa,1,0,"tr",38),r()()),n&2){let t=_();d(),m("dataSource",t.remitos),d(13),m("matHeaderRowDef",t.remitosColumns),d(),m("matRowDefColumns",t.remitosColumns)}}function oa(n,i){n&1&&(o(0,"div",15),l(1," Esta orden de compra todavia no tiene remitos cargados. "),r())}var je=class n{constructor(i,t,e,a,s){this.route=i;this.router=t;this.registroCompraService=e;this.remitosService=a;this.snackBar=s;this.idRegistro=this.route.snapshot.paramMap.get("id")}idRegistro;registro=null;remitos=[];stockLiberado=[];detalleColumns=["material","descripcion","cantidad","enRemitos","liberado","pendienteLiberar","unidad","estadoLiberacion"];remitosColumns=["numero","fecha","estado","acciones"];cargando=!1;cargandoRemitos=!1;cargandoStock=!1;ngOnInit(){this.idRegistro&&this.cargarRegistro(Number(this.idRegistro))}cargarRegistro(i){this.cargando=!0,this.registroCompraService.getRegistroById(i).subscribe({next:t=>{this.cargando=!1,this.registro=t,this.cargarRemitos(i),this.cargarStockLiberado(t.detalle??[])},error:t=>{this.cargando=!1,this.snackBar.open(t?.error?.message||"Error al obtener el registro de compra.","Cerrar",{duration:3500})}})}cargarRemitos(i){this.cargandoRemitos=!0,this.remitosService.getRemitosByRegistroCompra(i).subscribe({next:t=>{this.cargandoRemitos=!1,this.remitos=t},error:t=>{this.cargandoRemitos=!1,this.snackBar.open(t?.error?.message||"Error al cargar remitos del registro.","Cerrar",{duration:3500})}})}cargarStockLiberado(i){this.stockLiberado=this.crearStockEsperado(i),this.cargandoStock=!1}crearStockEsperado(i){return i.map(t=>{let e=Number(t.idMaterial),a=Number(t.cantidadSolicitada??t.cantidad??0),s=Number(t.cantidadRecibida??0),c=Math.max(a-s,0);return{idMaterial:t.idMaterial,material:t.nombreMaterial,unidad:t.unidad,esperado:a,liberado:s,pendiente:c,estado:this.getEstadoLineaStock(a,s)}})}getEstadoLineaStock(i,t){return t>=i&&i>0?"COMPLETO":t>0?"PARCIAL":"PENDIENTE"}nuevoRemito(){this.idRegistro&&this.router.navigate(["/ingreso-materiales/registros",this.idRegistro,"remitos","nuevo"])}verRemito(i){this.idRegistro&&this.router.navigate(["/ingreso-materiales/registros",this.idRegistro,"remitos",i.idRemito])}estadoRemito(i){return i.estadoLiberacion||(i.liberado?"LIBERADO":"PENDIENTE")}pendienteLiberarDetalle(i){return Number(i.cantidadPendienteLiberar??Math.max(Number(i.cantidadEnRemitos??0)-Number(i.cantidadRecibida??0),0))}get estadoLiberacionRegistro(){return this.stockLiberado.length?this.stockLiberado.every(i=>i.estado==="COMPLETO")?"LIBERADO":this.stockLiberado.some(i=>i.liberado>0)?"PARCIAL":"PENDIENTE":"PENDIENTE"}get materialesLiberadosResumen(){return this.stockLiberado.filter(i=>i.estado==="COMPLETO").length}formatearFecha(i){return i?i.substring(0,10):"-"}volver(){this.router.navigate(["/ingreso-materiales/registros"])}static \u0275fac=function(t){return new(t||n)(A($t),A(Gt),A(Ee),A(Oe),A(be))};static \u0275cmp=O({type:n,selectors:[["app-registro-compra-detalle"]],decls:32,vars:7,consts:[[1,"module-page","registro-detalle-page"],[1,"page-header"],[1,"breadcrumb"],[1,"header-actions"],[1,"block"],[1,"block-header"],[1,"block-title"],["animationDuration","150ms",1,"industrial-tabs"],["mat-tab-label",""],[1,"tab-body"],["class","state-message",4,"ngIf"],["class","document-accordion","multi","",4,"ngIf"],[1,"tab-actions"],["type","button",1,"btn","btn-primary","btn-sm","primary-action",3,"click"],["class","table-wrap",4,"ngIf"],[1,"state-message"],["multi","",1,"document-accordion"],[1,"document-panel",3,"expanded"],[1,"document-panel-header"],[1,"readonly-grid","three"],[1,"readonly-field"],[1,"readonly-field","span-2"],[1,"chip","chip-no-dot","chip-blue"],[1,"chip","chip-no-dot","chip-teal"],[1,"table-wrap"],["mat-table","",1,"detalle-table","mat-elevation-z0",3,"dataSource"],["matColumnDef","material"],["mat-header-cell","",4,"matHeaderCellDef"],["mat-cell","",4,"matCellDef"],["matColumnDef","descripcion"],["matColumnDef","cantidad"],["mat-cell","","class","tech-value",4,"matCellDef"],["matColumnDef","unidad"],["matColumnDef","liberado"],["matColumnDef","enRemitos"],["matColumnDef","pendienteLiberar"],["matColumnDef","estadoLiberacion"],["mat-header-row","",4,"matHeaderRowDef"],["mat-row","","class","data-row",4,"matRowDef","matRowDefColumns"],["mat-header-cell",""],["mat-cell",""],["mat-cell","",1,"tech-value"],[1,"estado-badge",3,"ngClass"],["mat-header-row",""],["mat-row","",1,"data-row"],[1,"stock-table"],[1,"stock-col-material"],[1,"stock-col-numero"],[1,"stock-col-estado"],[4,"ngFor","ngForOf"],[1,"tech-value"],["mat-table","",1,"remitos-detalle-table","mat-elevation-z0",3,"dataSource"],["matColumnDef","numero"],["matColumnDef","fecha"],["matColumnDef","estado"],["matColumnDef","acciones"],["mat-header-cell","","class","acciones-header",4,"matHeaderCellDef"],["mat-cell","","class","acciones-cell",4,"matCellDef"],[1,"estado-badge"],["mat-header-cell","",1,"acciones-header"],["mat-cell","",1,"acciones-cell"],[1,"acciones-inline"],["mat-icon-button","","matTooltip","Ver remito",3,"click"]],template:function(t,e){t&1&&(o(0,"div",0)(1,"div",1)(2,"div")(3,"span",2),l(4),r(),o(5,"h1"),l(6,"Detalle de registro de compra"),r(),o(7,"p"),l(8,"Vista operativa de documento, remitos asociados y liberaciones de stock."),r()(),k(9,"div",3),r(),o(10,"section",4)(11,"div",5)(12,"h2",6),l(13,"Flujo del registro"),r()(),o(14,"mat-tab-group",7)(15,"mat-tab"),p(16,fn,3,0,"ng-template",8),o(17,"div",9),p(18,vn,2,0,"div",10)(19,Wn,73,21,"mat-accordion",11)(20,$n,2,0,"div",10),r()(),o(21,"mat-tab"),p(22,Gn,3,0,"ng-template",8),o(23,"div",9)(24,"div",12)(25,"button",13),T("click",function(){return e.nuevoRemito()}),o(26,"mat-icon"),l(27,"add"),r(),l(28," Nuevo remito "),r()(),p(29,qn,2,0,"div",10)(30,ia,16,3,"div",14)(31,oa,2,0,"div",10),r()()()()()),t&2&&(d(4),M("OBRA360 / Ingreso de Materiales / Registro ",e.idRegistro||"-"),d(14),m("ngIf",e.cargando),d(),m("ngIf",!e.cargando&&e.registro),d(),m("ngIf",!e.cargando&&!e.registro),d(9),m("ngIf",e.cargandoRemitos),d(),m("ngIf",!e.cargandoRemitos&&e.remitos.length),d(),m("ngIf",!e.cargandoRemitos&&!e.remitos.length))},dependencies:[Wt,jt,Qt,Vt,ne,te,oe,ie,pe,Te,_e,ue,Ce,ge,he,ye,fe,ve,xe,ke,ze,yt,xt,He,me,ce,De,Re,Me,Pe,we,Ie],styles:[".registro-detalle-page[_ngcontent-%COMP%]{max-width:none;width:100%}.registro-detalle-page[_ngcontent-%COMP%]   .primary-action[_ngcontent-%COMP%]{border-radius:8px;box-shadow:0 8px 18px color-mix(in srgb,var(--primary) 20%,transparent)}.header-actions[_ngcontent-%COMP%]{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.industrial-tabs[_ngcontent-%COMP%]{--mdc-tab-indicator-active-indicator-color: var(--primary);--mat-tab-header-active-label-text-color: var(--primary);--mat-tab-header-inactive-label-text-color: var(--text-secondary);--mat-tab-header-active-hover-label-text-color: var(--primary);--mat-tab-header-inactive-hover-label-text-color: var(--text);background:var(--surface-card)}.industrial-tabs[_ngcontent-%COMP%]   mat-icon[_ngcontent-%COMP%]{margin-right:6px;font-size:18px}.tab-body[_ngcontent-%COMP%]{padding:16px}.document-accordion[_ngcontent-%COMP%]{display:grid;gap:12px}.document-panel[_ngcontent-%COMP%]{background:var(--surface-card)!important;color:var(--text)!important;--mat-expansion-container-background-color: var(--surface-card);--mat-expansion-container-text-color: var(--text);--mat-expansion-header-text-color: var(--text);--mat-expansion-header-description-color: var(--text-secondary);border:1px solid var(--border);border-radius:8px!important;box-shadow:none!important;overflow:hidden!important}.document-panel-header[_ngcontent-%COMP%]{min-height:48px;height:48px;padding:0 16px}.document-panel.mat-expanded[_ngcontent-%COMP%]   .document-panel-header[_ngcontent-%COMP%]{border-bottom:1px solid var(--border)}.document-panel-header[_ngcontent-%COMP%]   .mat-expansion-panel-header-title[_ngcontent-%COMP%]{align-items:center;color:var(--text)!important}.document-panel-header[_ngcontent-%COMP%]   .mat-expansion-panel-header-description[_ngcontent-%COMP%]{align-items:center;justify-content:flex-end;margin-right:8px}.document-panel[_ngcontent-%COMP%]     .mat-expansion-panel-body{padding:14px}.document-panel[_ngcontent-%COMP%]     .mat-expansion-indicator:after{color:var(--text-secondary)}.table-wrapper[_ngcontent-%COMP%], .table-wrap[_ngcontent-%COMP%]{overflow-x:auto}.detalle-table[_ngcontent-%COMP%], .remitos-detalle-table[_ngcontent-%COMP%], .stock-table[_ngcontent-%COMP%]{table-layout:fixed;background:transparent!important}.detalle-table[_ngcontent-%COMP%], .remitos-detalle-table[_ngcontent-%COMP%]{--mat-table-background-color: transparent;--mat-table-header-headline-color: var(--text-muted);--mat-table-row-item-label-text-color: var(--text);--mat-table-row-item-outline-color: var(--border)}.detalle-table[_ngcontent-%COMP%]   .mat-mdc-header-row[_ngcontent-%COMP%], .remitos-detalle-table[_ngcontent-%COMP%]   .mat-mdc-header-row[_ngcontent-%COMP%], .stock-table[_ngcontent-%COMP%]   thead[_ngcontent-%COMP%]{background:var(--surface-card)!important}.detalle-table[_ngcontent-%COMP%]   .mat-mdc-header-cell[_ngcontent-%COMP%], .remitos-detalle-table[_ngcontent-%COMP%]   .mat-mdc-header-cell[_ngcontent-%COMP%], .stock-table[_ngcontent-%COMP%]   th[_ngcontent-%COMP%]{background:var(--surface-card)!important;color:var(--text-muted)!important;font-family:var(--font-tech);font-size:10px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap}.detalle-table[_ngcontent-%COMP%]   .mat-mdc-row[_ngcontent-%COMP%], .remitos-detalle-table[_ngcontent-%COMP%]   .mat-mdc-row[_ngcontent-%COMP%], .stock-table[_ngcontent-%COMP%]   tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]{background:transparent;transition:background .15s ease,filter .15s ease}.detalle-table[_ngcontent-%COMP%]   .mat-mdc-cell[_ngcontent-%COMP%], .remitos-detalle-table[_ngcontent-%COMP%]   .mat-mdc-cell[_ngcontent-%COMP%], .stock-table[_ngcontent-%COMP%]   td[_ngcontent-%COMP%]{background:transparent!important;border-bottom-color:var(--border)!important;color:var(--text)!important;font-size:12px;transition:background .15s ease,color .15s ease}.detalle-table[_ngcontent-%COMP%]   .mat-mdc-cell[_ngcontent-%COMP%]   strong[_ngcontent-%COMP%], .remitos-detalle-table[_ngcontent-%COMP%]   .mat-mdc-cell[_ngcontent-%COMP%]   strong[_ngcontent-%COMP%], .stock-table[_ngcontent-%COMP%]   td[_ngcontent-%COMP%]   strong[_ngcontent-%COMP%]{color:var(--primary);font-family:var(--font-tech)}.detalle-table[_ngcontent-%COMP%]   .mat-mdc-row[_ngcontent-%COMP%]:hover, .detalle-table[_ngcontent-%COMP%]   .mat-mdc-row[_ngcontent-%COMP%]:hover   .mat-mdc-cell[_ngcontent-%COMP%], .remitos-detalle-table[_ngcontent-%COMP%]   .mat-mdc-row[_ngcontent-%COMP%]:hover, .remitos-detalle-table[_ngcontent-%COMP%]   .mat-mdc-row[_ngcontent-%COMP%]:hover   .mat-mdc-cell[_ngcontent-%COMP%], .stock-table[_ngcontent-%COMP%]   tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:hover, .stock-table[_ngcontent-%COMP%]   tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:hover   td[_ngcontent-%COMP%]{background:color-mix(in srgb,var(--surface-hover) 72%,transparent)!important}.detalle-table[_ngcontent-%COMP%]{min-width:920px}.detalle-table[_ngcontent-%COMP%]   th[_ngcontent-%COMP%]:nth-child(1), .detalle-table[_ngcontent-%COMP%]   td[_ngcontent-%COMP%]:nth-child(1){width:34%}.detalle-table[_ngcontent-%COMP%]   th[_ngcontent-%COMP%]:nth-child(2), .detalle-table[_ngcontent-%COMP%]   td[_ngcontent-%COMP%]:nth-child(2){width:34%}.detalle-table[_ngcontent-%COMP%]   th[_ngcontent-%COMP%]:nth-child(3), .detalle-table[_ngcontent-%COMP%]   td[_ngcontent-%COMP%]:nth-child(3){width:16%}.detalle-table[_ngcontent-%COMP%]   th[_ngcontent-%COMP%]:nth-child(4), .detalle-table[_ngcontent-%COMP%]   td[_ngcontent-%COMP%]:nth-child(4){width:16%}.remitos-detalle-table[_ngcontent-%COMP%]{min-width:760px}.remitos-detalle-table[_ngcontent-%COMP%]   th[_ngcontent-%COMP%]:nth-child(1), .remitos-detalle-table[_ngcontent-%COMP%]   td[_ngcontent-%COMP%]:nth-child(1){width:28%}.remitos-detalle-table[_ngcontent-%COMP%]   th[_ngcontent-%COMP%]:nth-child(2), .remitos-detalle-table[_ngcontent-%COMP%]   td[_ngcontent-%COMP%]:nth-child(2){width:20%}.remitos-detalle-table[_ngcontent-%COMP%]   th[_ngcontent-%COMP%]:nth-child(3), .remitos-detalle-table[_ngcontent-%COMP%]   td[_ngcontent-%COMP%]:nth-child(3){width:24%}.remitos-detalle-table[_ngcontent-%COMP%]   th[_ngcontent-%COMP%]:nth-child(4), .remitos-detalle-table[_ngcontent-%COMP%]   td[_ngcontent-%COMP%]:nth-child(4){width:28%}.stock-table[_ngcontent-%COMP%]{min-width:920px;width:100%;border-collapse:collapse}.stock-col-material[_ngcontent-%COMP%]{width:36%}.stock-col-numero[_ngcontent-%COMP%], .stock-col-estado[_ngcontent-%COMP%]{width:16%}.stock-table[_ngcontent-%COMP%]   th[_ngcontent-%COMP%], .stock-table[_ngcontent-%COMP%]   td[_ngcontent-%COMP%]{box-sizing:border-box;height:38px;padding:8px 12px;vertical-align:middle}.stock-table[_ngcontent-%COMP%]   th[_ngcontent-%COMP%]:nth-child(2), .stock-table[_ngcontent-%COMP%]   th[_ngcontent-%COMP%]:nth-child(3), .stock-table[_ngcontent-%COMP%]   th[_ngcontent-%COMP%]:nth-child(4), .stock-table[_ngcontent-%COMP%]   td[_ngcontent-%COMP%]:nth-child(2), .stock-table[_ngcontent-%COMP%]   td[_ngcontent-%COMP%]:nth-child(3), .stock-table[_ngcontent-%COMP%]   td[_ngcontent-%COMP%]:nth-child(4){text-align:right}.stock-table[_ngcontent-%COMP%]   th[_ngcontent-%COMP%]:nth-child(5), .stock-table[_ngcontent-%COMP%]   td[_ngcontent-%COMP%]:nth-child(5){text-align:left}.tech-value[_ngcontent-%COMP%]{font-family:var(--font-tech)}.acciones-header[_ngcontent-%COMP%]{text-align:center}.acciones-cell[_ngcontent-%COMP%]{text-align:center;white-space:nowrap}.acciones-inline[_ngcontent-%COMP%]{display:flex;align-items:center;justify-content:center;gap:2px}.acciones-inline[_ngcontent-%COMP%]   .mat-mdc-icon-button[_ngcontent-%COMP%]{width:30px;height:30px;padding:3px}.acciones-inline[_ngcontent-%COMP%]   mat-icon[_ngcontent-%COMP%]{font-size:18px}.tab-actions[_ngcontent-%COMP%]{display:flex;justify-content:flex-end;margin-bottom:12px}.info-grid[_ngcontent-%COMP%], .readonly-grid[_ngcontent-%COMP%]{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:12px}.readonly-grid[_ngcontent-%COMP%]{grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:0}.readonly-grid.three[_ngcontent-%COMP%]{grid-template-columns:repeat(3,minmax(0,1fr))}.span-2[_ngcontent-%COMP%]{grid-column:span 2}.readonly-section[_ngcontent-%COMP%]{border-bottom:1px solid var(--border);padding-bottom:16px;margin-bottom:16px}.readonly-section[_ngcontent-%COMP%]:last-child{border-bottom:0;margin-bottom:0;padding-bottom:0}.readonly-field[_ngcontent-%COMP%]{min-height:56px;display:flex;flex-direction:column;justify-content:center;border:1px solid var(--border);border-radius:8px;background:var(--surface-card-2);padding:8px 12px}.readonly-field[_ngcontent-%COMP%]   span[_ngcontent-%COMP%]{color:var(--text-muted);font-family:var(--font-tech);font-size:9px;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px}.readonly-field[_ngcontent-%COMP%]   strong[_ngcontent-%COMP%]{color:var(--text);font-size:13px;font-weight:600}.readonly-detail-list[_ngcontent-%COMP%]{display:grid;gap:10px}.readonly-detail-row[_ngcontent-%COMP%]{display:grid;grid-template-columns:minmax(220px,1.5fr) minmax(180px,1.1fr) minmax(120px,.7fr) minmax(110px,.6fr);gap:10px}.estado-badge[_ngcontent-%COMP%]{justify-self:start}.estado-badge.pendiente[_ngcontent-%COMP%]{color:var(--yellow);background:color-mix(in srgb,var(--yellow) 12%,transparent);border-color:color-mix(in srgb,var(--yellow) 30%,transparent)}.estado-badge.parcial[_ngcontent-%COMP%]{color:var(--blue);background:color-mix(in srgb,var(--blue) 12%,transparent);border-color:color-mix(in srgb,var(--blue) 30%,transparent)}.estado-badge.completo[_ngcontent-%COMP%]{color:var(--green);background:color-mix(in srgb,var(--green) 12%,transparent);border-color:color-mix(in srgb,var(--green) 30%,transparent)}.info-card[_ngcontent-%COMP%]{background:var(--surface-card-2);border:1px solid var(--border);border-radius:8px;padding:14px}.info-card[_ngcontent-%COMP%]   span[_ngcontent-%COMP%]{display:block;color:var(--text-muted);font-family:var(--font-tech);font-size:9px;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px}.info-card[_ngcontent-%COMP%]   strong[_ngcontent-%COMP%]{color:var(--text);font-size:13px;font-weight:600}@media(max-width:860px){.info-grid[_ngcontent-%COMP%], .readonly-grid[_ngcontent-%COMP%], .readonly-grid.three[_ngcontent-%COMP%], .readonly-detail-row[_ngcontent-%COMP%]{grid-template-columns:1fr}.span-2[_ngcontent-%COMP%]{grid-column:auto}}"]})};export{je as RegistroCompraDetalle};
