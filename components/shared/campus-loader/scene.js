// Kaplan City Campus @ Wilkie Edge, as an isometric pixel scene: the loading picture (./CampusLoader.tsx).
// Ported from the team's artifact "Wilkie Edge 像素微缩" (claude.ai/artifact/QTqVHr1CkWCjCUbY8e1wvL); the
// drawing is unchanged. What changed for a loader: the scene is a function that draws into a given
// canvas (not the whole window) and can be paused and torn down; its caption, phase chips and pause
// button are gone (the site's own pause holds it); it starts at once, without the 8 s warm-up run; it
// draws at most `fps` frames a second on a transparent ground, at whole-pixel scales where it fits.
// Plain JavaScript as the artifact was; its types are in ./scene.d.ts.

export function mountCampus(main, opts) {
/* ===== 比例：1 世界单位 = 1 米。2:1 二等角投影：x→(2,1)px，y→(-2,1)px，z→2.45px/m（与地面同比例） ===== */
const W=720,H=440,OX=280,OY=167,KZ=2.45;
function mk(){const c=document.createElement('canvas');c.width=W;c.height=H;return c;}
const off=mk(),g=off.getContext('2d'),bgC=mk(),deC=mk(),shC=mk();
const mg=main.getContext('2d');
let ctx=g;
const R=Math.round,FL=Math.floor,clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t;
const P=(x,y,z)=>[OX+(x-y)*2,OY+(x+y)-(z||0)*KZ];
let seed=20261022;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const hsh=(a,b)=>{let h=Math.imul(a|0,374761393)+Math.imul(b|0,668265263)|0;h=Math.imul(h^h>>>13,1274126177);return((h^h>>>16)>>>0)/4294967296;};
const shc={};
function sh(c,k){if(k===undefined||k===1)return c;const key=c+k;if(shc[key])return shc[key];
  const n=parseInt(c.slice(1),16),f=s=>clamp(R(s*k),0,255);
  return shc[key]=`rgb(${f(n>>16)},${f(n>>8&255)},${f(n&255)})`;}
/* 凸多边形逐列光栅化：每列一个整像素竖条，保证统一像素颗粒、无抗锯齿 */
function poly(p,c){let a=1e9,b=-1e9;for(const q of p){if(q[0]<a)a=q[0];if(q[0]>b)b=q[0];}
  a=R(a);b=R(b);ctx.fillStyle=c;const n=p.length;
  for(let x=a;x<b;x++){const cx=x+.5;let lo=1e9,hi=-1e9;
    for(let i=0;i<n;i++){const A=p[i],B=p[(i+1)%n];
      if((cx>=A[0]&&cx<B[0])||(cx>=B[0]&&cx<A[0])){const y=A[1]+(cx-A[0])/(B[0]-A[0])*(B[1]-A[1]);if(y<lo)lo=y;if(y>hi)hi=y;}}
    if(lo<=hi){const ya=R(lo);ctx.fillRect(x,ya,1,Math.max(1,R(hi)-ya));}}}
const fy=(Y,x0,x1,z0,z1,c)=>poly([P(x0,Y,z0),P(x1,Y,z0),P(x1,Y,z1),P(x0,Y,z1)],c);
const fx=(X,y0,y1,z0,z1,c)=>poly([P(X,y0,z0),P(X,y1,z0),P(X,y1,z1),P(X,y0,z1)],c);
const tq=(x0,y0,x1,y1,z,c)=>poly([P(x0,y0,z),P(x1,y0,z),P(x1,y1,z),P(x0,y1,z)],c);
/* 受光：顶面 1，左面(+y) 0.86，右面(+x) 0.66，光从左后上方来，影子投向 +x */
const LY=.86,LX=.66;
const lit=(ax,c,k)=>sh(c,(ax==='y'?LY:LX)*(k||1));
const face=(ax,pl,a0,a1,z0,z1,c)=>ax==='y'?fy(pl,a0,a1,z0,z1,lit('y',c)):fx(pl,a0,a1,z0,z1,lit('x',c));
function box(x,y,z,w,d,h,c,ky,kx,kt){if(h>0){fy(y+d,x,x+w,z,z+h,sh(c,ky||LY));fx(x+w,y,y+d,z,z+h,sh(c,kx||LX));}tq(x,y,x+w,y+d,z+h,sh(c,kt||1));}
function vl(x,y,z0,z1,c){const a=P(x,y,z0),b=P(x,y,z1);ctx.fillStyle=c;const t=R(b[1]);ctx.fillRect(R(a[0]),t,1,Math.max(1,R(a[1])-t));}
function dot(x,y,z,c){const p=P(x,y,z);ctx.fillStyle=c;ctx.fillRect(R(p[0]),R(p[1]),1,1);}
function ln(a,b,c){let x0=R(a[0]),y0=R(a[1]);const x1=R(b[0]),y1=R(b[1]),dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let e=dx+dy;ctx.fillStyle=c;
  for(let i=0;i<999;i++){ctx.fillRect(x0,y0,1,1);if(x0===x1&&y0===y1)break;const e2=2*e;if(e2>=dy){e+=dy;x0+=sx;}if(e2<=dx){e+=dx;y0+=sy;}}}
/* 3×5 像素字体（只含用到的字形） */
const F={T:'111010010010010',A:'010101111101101',B:'110101110101110',D:'110101101101110',E:'111100110100111',G:'011100101101011',I:'111010010010111',
  K:'101101110101101',L:'100100100100111',N:'101111111101101',P:'110101110100100',S:'011100010001110',V:'101101101101010',W:'101101101111101',
  1:'010110010010111',2:'110001010100111',8:'010101010101010',9:'010101011001110'};
const tw=s=>s.length*4-1;
/* 在屏幕上写字；sl=1 贴在左面（随 +x 下斜），sl=-1 贴在右面（随 -y 上斜） */
function txt(s,sx,sy,sl,c){ctx.fillStyle=c;let cx=0;for(const ch of s){const gl=F[ch];
  if(gl)for(let i=0;i<15;i++)if(gl[i]==='1'){const col=cx+i%3;ctx.fillRect(sx+col,sy+FL(i/3)+sl*FL(col/2),1,1);}cx+=4;}}
function glyphAt(s,c,r){if(c<0||r<0||r>4)return false;const k=FL(c/4),i=c%4;if(i===3||k>=s.length)return false;const gl=F[s[k]];return !!gl&&gl[r*3+i]==='1';}
/* ===== 深度排序：包围盒分离轴拓扑排序（只比较屏幕上重叠的物件） ===== */
function behind(a,b){if(a.x1<=b.x0||a.y1<=b.y0||a.z1<=b.z0)return 1;if(b.x1<=a.x0||b.y1<=a.y0||b.z1<=a.z0)return -1;return 0;}
function order(L){const n=L.length;
  for(const t of L){t.sa=(t.x0-t.y1)*2;t.sb=(t.x1-t.y0)*2;t.ta=t.x0+t.y0-t.z1*KZ;t.tb=t.x1+t.y1-t.z0*KZ;t.k=(t.x0+t.x1+t.y0+t.y1)/2+(t.z0+t.z1)*.05;}
  L.sort((a,b)=>a.k-b.k);const pre=L.map(()=>[]);
  for(let i=0;i<n;i++){const a=L[i];for(let j=i+1;j<n;j++){const b=L[j];
    if(a.sb<=b.sa||b.sb<=a.sa||a.tb<=b.ta||b.tb<=a.ta)continue;
    if(behind(a,b)===-1)pre[i].push(j);else pre[j].push(i);}}
  const out=[],st=new Uint8Array(n);
  const visit=i=>{if(st[i])return;st[i]=1;for(const k of pre[i])visit(k);out.push(L[i]);};
  for(let i=0;i<n;i++)visit(i);return out;}
let items=[];
const add=(x0,y0,z0,x1,y1,z1,fn,clip)=>items.push({x0,y0,z0,x1,y1,z1,fn,clip});
/* ===== 场地（米）：Wilkie Rd→Middle Rd 沿 x 双向 4 车道；Selegie Rd 沿 y 单行 4 车道（最右为巴士道）；Short St 沿 y 窄马路，南端斜向接入十字路口，正好夹在车塔与 David Elias Building 之间===== */
const X0=-14,X1=158,Y0=-14,Y1=74,RA0=50.5,RA1=64.5,RB0=80,RB1=96.5,SS0=114,SS1=120;
const C={slab:'#dedbd3',plaza:'#e6e3dc',fore:'#d6d2c9',road:'#a8acaf',grass:'#a8c572',curb:'#cfccc5',white:'#f6f6f2',yel:'#e2bc3a',
  tile:'#cfd0cb',roof:'#c6c8c4',curt:'#4e5a63',glass:'#a9c1cc',leaf:'#5f9a47',leaf2:'#79b257',trunk:'#7b5b3e',navy:'#1f2a5c'};
const SSD=[[114,33],[120,35.5],[105,50.5],[96.5,50.5]];   // Short St 斜接段（两条边分别在 x+y=147 与 x+y=155.5 上）
const SLAB=[P(X0,Y0),P(X1,Y0),P(X1,Y1),P(X0,Y1)];
function clipSlab(c){c.beginPath();c.moveTo(SLAB[0][0],SLAB[0][1]);for(let i=1;i<4;i++)c.lineTo(SLAB[i][0],SLAB[i][1]);c.closePath();c.clip();}
function dashX(y,x0,x1,on,gap,w,c){for(let x=x0;x<x1;x+=on+gap)tq(x,y-w/2,Math.min(x+on,x1),y+w/2,0,c);}
function dashY(x,y0,y1,on,gap,w,c){for(let y=y0;y<y1;y+=on+gap)tq(x-w/2,y,x+w/2,Math.min(y+on,y1),0,c);}
/* 任意凸多边形棱柱：只画朝向镜头的侧面，明暗按法线在左面(0.86)与右面(0.66)之间插值 */
function prism(pts,z0,z1,c,kt){let ar=0;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];ar+=a[0]*b[1]-b[0]*a[1];}
  if(ar<0)pts=pts.slice().reverse();const n=pts.length;
  for(let i=0;i<n;i++){const a=pts[i],b=pts[(i+1)%n],ex=b[0]-a[0],ey=b[1]-a[1],L=Math.hypot(ex,ey),nx=ey/L,ny=-ex/L;
    if(nx+ny>.01)poly([P(a[0],a[1],z0),P(b[0],b[1],z0),P(b[0],b[1],z1),P(a[0],a[1],z1)],sh(c,.76+.1*(ny-nx)));}
  poly(pts.map(p=>P(p[0],p[1],z1)),sh(c,kt||1));}
/* 通用立面：沿屏幕从左到右走一段墙，u 为沿墙米数（可用于斜切面） */
function FC(x0,y0,x1,y1){const L=Math.hypot(x1-x0,y1-y0),dx=(x1-x0)/L,dy=(y1-y0)/L;return {x0,y0,dx,dy,L,k:.76+.1*(dx+dy)};}
const fpt=(f,u,z)=>P(f.x0+f.dx*u,f.y0+f.dy*u,z);
function fq(f,u0,u1,z0,z1,c,k){poly([fpt(f,u0,z0),fpt(f,u1,z0),fpt(f,u1,z1),fpt(f,u0,z1)],sh(c,f.k*(k||1)));}
function fv(f,u,z0,z1,c){const a=fpt(f,u,z0),b=fpt(f,u,z1);ctx.fillStyle=sh(c,f.k);const t=R(b[1]);ctx.fillRect(R(a[0]),t,1,Math.max(1,R(a[1])-t));}
function farch(f,u0,u1,z0,zs,c){const r=(u1-u0)/2,uc=u0+r,p=[fpt(f,u0,z0)];
  for(let a=180;a>=0;a-=22.5)p.push(fpt(f,uc+r*Math.cos(a/57.3),zs+r*Math.sin(a/57.3)));p.push(fpt(f,u1,z0));poly(p,sh(c,f.k));}
function drawGround(){
  box(X0,Y0,-3,X1-X0,Y1-Y0,3,C.slab,.9,.76);
  tq(70,-14,80,50,0,C.plaza);tq(-14,42,80,48,0,C.plaza);tq(97,Y0,X1,46,0,C.fore);tq(99.5,30,113.5,46,0,C.plaza);
  for(let x=71;x<80;x+=2)for(let y=-13;y<48;y+=2)dot(x,y,0,'#dad6ce');
  tq(X0,RA0,X1,RA1,0,C.road);tq(RB0,Y0,RB1,Y1,0,C.road);tq(SS0,Y0,SS1,35.5,0,C.road);poly(SSD.map(([x,y])=>P(x,y)),C.road);
  tq(X0,RA0-.5,RB0,RA0,0,C.curb);tq(105,RA0-.5,X1,RA0,0,C.curb);tq(X0,RA1,RB0,RA1+.5,0,C.curb);tq(RB1,RA1,X1,RA1+.5,0,C.curb);
  tq(RB0-.5,Y0,RB0,RA0,0,C.curb);tq(RB1,Y0,RB1+.5,RA0-.6,0,C.curb);tq(RB0-.5,RA1,RB0,Y1,0,C.curb);tq(RB1,RA1,RB1+.5,Y1,0,C.curb);
  tq(SS0-.5,Y0,SS0,33,0,C.curb);tq(SS1,Y0,SS1+.5,35.5,0,C.curb);
  poly([P(114,33),P(96.5,50.5),P(96.15,50.15),P(113.65,32.65)],C.curb);poly([P(120,35.5),P(120.35,35.85),P(105.7,50.5),P(105,50.5)],C.curb);
  tq(X0,48,70,RA0-.5,0,C.grass);tq(152,10,X1,46,0,C.grass);
  tq(X0,69.5,RB0-.5,Y1,0,C.grass);tq(RB1+.5,69.5,X1,Y1,0,C.grass);
  tq(X0,57,74,58,0,C.grass);tq(104.6,57,X1,58,0,C.grass);
  for(const y of [53.8,61.2]){dashX(y,X0,73.5,3,3,.3,C.white);dashX(y,105,X1,3,3,.3,C.white);}
  for(const y of [51.1,63.9]){tq(X0,y-.15,73.6,y+.15,0,C.yel);tq(105,y-.15,X1,y+.15,0,C.yel);}
  for(const x of [84,88]){dashY(x,Y0,44.6,3,3,.3,C.white);dashY(x,69.6,Y1,3,3,.3,C.white);}
  for(const x of [80.6,92.4,95.9]){tq(x-.15,Y0,x+.15,44.6,0,C.yel);tq(x-.15,69.6,x+.15,Y1,0,C.yel);}
  dashY(117,Y0,31,3,3,.3,C.white);tq(114.45,Y0,114.75,33.3,0,C.yel);tq(119.25,Y0,119.55,35.4,0,C.yel);
  for(let a=148;a<155;a+=1.2)poly([P(a-46.4,46.4),P(a+.6-46.4,46.4),P(a+.6-50.2,50.2),P(a-50.2,50.2)],C.white);   // 斜接段口的斑马线
  tq(73.4,RA0,73.9,57,0,C.white);tq(105,58,105.5,RA1,0,C.white);tq(RB0,44.7,RB1,45.2,0,C.white);
  for(const y of [46.1,49.6,65.2,68.8])dashX(y,RB0,RB1,.8,.6,.35,C.white);
  for(const x of [74.8,78.4,100.6,104.2])dashY(x,RA0,RA1,.8,.6,.35,C.white);
  box(120.5,47.2,0,.9,.9,.8,'#e2b52a');for(let z=.1;z<.8;z+=.3)fy(48.1,120.5,121.4,z,z+.15,lit('y','#26282a'));   // 照片中的黄黑警示桩
}
/* 建筑落影：先在单独图层画不透明剪影，再统一以低透明度合成，叠加处不发黑 */
const SDX=.45,SDY=.12;
function shBox(x,y,w,d,h){const dx=h*SDX,dy=h*SDY;poly([P(x,y),P(x+w,y),P(x+w+dx,y+dy),P(x+w+dx,y+d+dy),P(x+dx,y+d+dy),P(x,y+d)],'#000');}
function drawShadows(){const b=ctx;ctx=shC.getContext('2d');
  shBox(0,6,5,36,50);shBox(5,0,35,42,26);shBox(5,6,35,30,50);shBox(40,10,7,32,58);shBox(47,30,5,12,58);
  shBox(47,0,23,10,24);shBox(47,0,13,10,46);shBox(47,10,23,32,34);shBox(47,10,21,14,48);
  shBox(100,18,12,12,54);shBox(122,18,28,28,14.3);
  ctx=b;ctx.save();clipSlab(ctx);ctx.globalAlpha=.13;ctx.drawImage(shC,0,0);ctx.restore();}
/* ===== Wilkie Edge：西端玻璃楼梯塔、双层通高店面裙楼、深色住宅体量（弧形屋架+两处空中露台）、Γ 形高瓷砖片墙、
   Selegie 侧阶梯式磨砂玻璃幕墙与退台绿化、与主体一体的转角弧形玻璃幕墙（底部招牌带、LED 屏、KAPLAN 招牌） ===== */
const fk=(ax,pl,a0,a1,z0,z1,c,k)=>ax==='y'?fy(pl,a0,a1,z0,z1,lit('y',c,k)):fx(pl,a0,a1,z0,z1,lit('x',c,k));
const fvl=(ax,pl,a,z0,z1,c)=>ax==='y'?vl(a,pl,z0,z1,lit('y',c)):vl(pl,a,z0,z1,lit('x',c));
function shop2(ax,pl,a0,a1,h,signs,ivy){face(ax,pl,a0,a1,0,h,'#5f666b');let i=0;
  for(let a=a0;a<a1-1;a+=5,i++){const g0=a+.8,g1=Math.min(a+5,a1)-.1;
    face(ax,pl,g0,g1,.2,h-.3,'#dde5e8');face(ax,pl,g0,g1,.2,2.8,'#c3ced2');
    for(const z of [2.8,h*.6])face(ax,pl,g0,g1,z,z+.25,'#7d878d');
    for(let u=g0+1.4;u<g1-.3;u+=1.4)fvl(ax,pl,u,.2,h-.3,'#98a3a9');
    const s=signs&&signs[i];if(s)face(ax,pl,g0+.5,g1-.5,3.1,3.9,s);
    if(ivy&&ivy.includes(i)){face(ax,pl,a,a+.8,0,h,'#4c7c39');for(let z=.5;z<h;z+=1.1)fvl(ax,pl,a+(z*7%8)/10,z,z+.4,'#6da552');}}}
function bigWin(ax,pl,a,z,w,h){face(ax,pl,a-.25,a+w+.25,z-.25,z+h+.25,'#ecebe6');face(ax,pl,a,a+w,z,z+h,'#36424b');
  face(ax,pl,a,a+w,z+h-.45,z+h,'#74888f');for(let u=a+w/3;u<a+w-.2;u+=w/3)fvl(ax,pl,u,z,z+h,'#c9d1d4');}
function tileLines(ax,pl,a0,a1,z0,z1){for(let z=z0+3.75;z<z1;z+=3.75)face(ax,pl,a0,a1,z,z+.2,'#bdbeb9');}
function strips(ax,pl,a0,a1,z0,z1,fh,sk){
  for(let f=0,z=z0;z<z1-.5;f++,z+=fh){const zt=Math.min(z+fh,z1);
    face(ax,pl,a0,a1,z,z+1,'#c4c8c7');face(ax,pl,a0,a1,z+1,zt,'#37424a');
    for(let a=a0,i=0;a<a1-.5;a+=2,i++){fvl(ax,pl,a,z+1,zt,'#6f7e88');const r=hsh(sk*53+f,i);
      if(r<.2)face(ax,pl,a+.4,a+1.6,z+1.4,zt-.3,r<.06?'#e8d5a3':'#8ea2ad');}}}
function frit(ax,pl,a0,a1,z0,z1){fk(ax,pl,a0,a1,z0,z1,C.glass,1.18);
  for(let a=a0,i=0;a<a1-.1;a+=1.5,i++){if(i%5<2)fk(ax,pl,a,Math.min(a+1.5,a1),z0,z1,'#c9dae1',1.18);fvl(ax,pl,a,z0,z1,'#eef3f5');}
  for(let z=z0;z<z1;z+=1.9)fk(ax,pl,a0,a1,z,z+.25,'#e6eef1',1.15);}
function punchSq(ax,pl,a0,a1,z0,z1,sk){for(let f=0,z=z0;z+3.7<=z1+.05;f++,z+=3.7)for(let i=0,a=a0+.7;a+1.8<=a1;i++,a+=2.6)
  if(hsh(sk+f,i)<.8){face(ax,pl,a,a+1.8,z+1,z+2.9,'#3e4a52');face(ax,pl,a,a+1.8,z+2.5,z+2.9,'#7c909b');}}
function recess(ax,pl,a0,a1,z0,z1,lights){face(ax,pl,a0,a1,z0,z1,'#ecdcbb');face(ax,pl,a0,a0+.6,z0,z1,'#c6b28c');face(ax,pl,a0,a1,z1-.5,z1,'#b9a582');
  fvl(ax,pl,a0+(a1-a0)*.35,z0,z1-.5,'#5e5a52');if(lights)for(let a=a0+1;a<a1-.4;a+=1.3)for(let z=z0+1.3;z<z1-.8;z+=1.6)fdot(ax,pl,a,z,'#fff4d2');}
const fdot=(ax,pl,a,z,c)=>ax==='y'?dot(a,pl,z,lit('y',c)):dot(pl,a,z,lit('x',c));
function vault(ax,a0,a1,F,zF,B,zT,c){const rh=Math.min(8,Math.abs(F-B)),sg=F>B?-1:1,pt=(a,b,z)=>ax==='y'?P(a,b,z):P(b,a,z);
  const prof=[];for(let d=0;d<=90;d+=15){const r=d/57.3;prof.push([F+sg*rh*(1-Math.cos(r)),zF+(zT-zF)*Math.sin(r)]);}prof.push([B,zT],[B,zF]);
  for(let a=a0;a<=a1+.01;a+=3)for(let i=1;i<prof.length;i++)ln(pt(a,prof[i-1][0],prof[i-1][1]),pt(a,prof[i][0],prof[i][1]),c);
  for(const i of [0,3,6])ln(pt(a0,prof[i][0],prof[i][1]),pt(a1,prof[i][0],prof[i][1]),c);
  for(const k of [.35,.7]){const b=lerp(prof[6][0],B,k);ln(pt(a0,b,zT),pt(a1,b,zT),c);}}
function treeDraw(x,y,z,s,dx){box(x-.25,y-.25,z,.5,.5,3.2*s,C.trunk);
  box(x-2.6*s+dx*.3,y-2.6*s,z+2.8*s,5.2*s,5.2*s,2.6*s,C.leaf,.84,.62,1.05);
  box(x-1.9*s+dx*.7,y-1.9*s,z+5.2*s,3.8*s,3.8*s,2*s,C.leaf,.92,.68,1.15);
  box(x-1.1*s+dx,y-1.1*s,z+7*s,2.2*s,2.2*s,1.2*s,C.leaf2,.95,.72,1.15);}
function planters(x0,y0,x1,y1,z){box(x0,y0,z,x1-x0,y1-y0,.7,'#b8bab5');for(let x=x0+.6;x<x1-.6;x+=1.4)box(x,y0+.2,z+.7,1,y1-y0-.4,.6,C.leaf,.9,.66,1.15);}
function drawWE(){
  // 西端楼梯塔：浅色框架玻璃，夜景照片中可见折线楼梯与灯点
  box(0,6,0,5,36,49,'#d3d5d1');fy(42,.6,4.4,8.5,47,lit('y','#93aab5'));
  for(let z=8.8;z<45;z+=3.8){ln(P(.8,42,z),P(4.2,42,z+1.9),lit('y','#eef0ee'));ln(P(4.2,42,z+1.9),P(.8,42,z+3.8),lit('y','#eef0ee'));dot(.9,42,z+.4,'#ffe3a0');dot(4.1,42,z+2.3,'#ffe3a0');}
  box(.5,6.5,49,4,35,1,'#d3d5d1');shop2('y',42,0,5,8);
  // 左裙楼 0–26 m：双层通高店面（含常春藤柱），上部瓷砖墙 + 三排横向大窗
  box(5,0,0,35,42,26,C.tile);tq(5,0,40,42,26,C.roof);
  shop2('y',42,5,40,8,[null,'#c8372d',null,'#f3f1ea','#e9a23b',null,'#2d2f33'],[0,1,3]);
  face('y',42,5,40,8,8.6,'#a9aaa6');tileLines('y',42,5,40,8.6,26);
  for(const [z,us] of [[10.8,[6.5,12.5,30.5,35]],[15.3,[6.5,18.5,24.5,30.5]],[19.8,[6.5,12.5,18.5,24.5,30.5,35]]])for(const u of us)bigWin('y',42,u,z,4.2,2.4);
  box(5,39,26,35,3,.8,'#b4b6b2');
  // 深色住宅体量 26–50 m：横向带窗、红色竖鳍、两处暖色空中露台、弧形屋架
  box(5,6,26,35,30,24,C.curt);strips('y',36,5,40,26,50,4,2);
  fy(36,10,11,26,50,lit('y','#b8463c'));fy(36,19,20,26,50,lit('y','#b8463c'));
  recess('y',36,22,29,26,31.6,false);recess('y',36,31,38.6,40,46,true);
  tq(5,6,40,36,50,'#a5aeb3');vault('y',6,39,36,50,10,55,'#7a868d');
  for(const x of [9,15.5,34])treeDraw(x,40.2,26.8,.7,0);
  // Γ 形高片墙 0–58 m：瓷砖，顶部方洞，顶端向圆鼓方向悬挑
  box(40,10,0,7,32,58,C.tile);tq(40,10,47,42,58,C.roof);tileLines('y',42,40,47,8,58);
  face('y',42,40.4,46.6,.2,8,'#2f3d47');face('y',42,42.2,44.8,.2,6.4,'#7f939d');
  bigWin('y',42,41.4,15.3,4.2,2.4);bigWin('y',42,41.4,30,4.2,2.4);
  face('y',42,41.8,45.2,49.5,53.3,'#454d53');face('y',42,41.8,42.4,49.5,53.3,'#2c3236');face('y',42,41.8,45.2,49.5,50.1,'#d9dbd8');
  strips('x',47,25,41.5,32,52,3.75,8);
  // 右段（一段大凹廊 + 竖鳍）；阶梯玻璃 34 m → 27 m → 24 m，转角以半径 12 m 的弧形玻璃面与两侧立面连成一体
  box(47,0,0,23,10,24,C.tile);tq(47,0,70,10,24,C.roof);shop2('x',70,0,10,6,['#3c5c8a',null]);punchSq('x',70,0,10,6,24,11);
  box(47,0,24,13,10,22,C.tile);tq(47,0,60,10,46,C.roof);punchSq('x',60,0,10,24,42,13);face('x',60,0,10,42,46,'#39444c');
  for(let y=.6;y<10;y+=2)fvl('x',60,y,42,46,'#6f7e88');
  planters(61,.6,69.4,9.4,24);treeDraw(64,3.2,24.7,.72,0);treeDraw(67.5,7.6,24.7,.62,0);
  box(47,10,0,23,6,27,C.tile);tq(47,10,70,16,27,C.roof);shop2('x',70,10,16,6,['#c98a3d']);frit('x',70,10,16,6,27);planters(63,10.6,69.4,15.4,27);
  const RC=[[47,16],[70,16]];for(let a=0;a<=90;a+=10)RC.push([DCX+DR*Math.cos(a/57.2958),DCY+DR*Math.sin(a/57.2958)]);RC.push([47,42]);prism(RC,0,DH,C.tile);poly(RC.map(p=>P(p[0],p[1],DH)),C.roof);
  shop2('x',70,16,30,6,[null,'#1e6b4c',null]);frit('x',70,16,30,6,34);
  shop2('y',42,47,58,8,['#a8352c',null]);face('y',42,47,58,8,8.6,'#a9aaa6');
  face('y',42,48.2,54.6,11,27,'#2e363c');for(let u=48.8;u<54.4;u+=.8)fvl('y',42,u,11,27,'#5b666d');face('y',42,48.2,54.6,26.4,27,'#d3d5d2');
  for(let z=11;z<27;z+=3.75)face('y',42,48.2,54.6,z,z+.25,'#d3d5d2');
  box(66,16.5,34,3.6,12,.6,'#a4a6a2');for(let y=17;y<28.5;y+=1.5)vl(69.6,y,34.6,37,'#8b969c');ln(P(69.6,16.5,37),P(69.6,28.5,37),'#8b969c');
  // 右上深色体量 34–48 m + 弧形屋架
  box(47,10,34,21,14,14,C.curt);strips('x',68,10,24,34,48,3.5,5);strips('y',24,47,68,34,48,3.5,6);
  tq(47,10,68,24,48,'#a5aeb3');vault('x',11,23,68,48,48,53,'#7a868d');
  box(47,30,52,5,12,6,C.tile);
  // 首层 KAPLAN 蓝色招牌（照片 1：圆鼓左侧入口）
  face('y',42,43,55.6,5.4,7.9,'#21409a');const kp=P(43.8,42,7.4);txt('KAPLAN',R(kp[0]),R(kp[1]),1,'#f3f6ff');
  drawDrum();}
/* 转角弧形玻璃面：不是独立圆柱，而是右段主体的圆角（圆心 (58,30)、半径 12 m、高 34 m），只画 θ=0°–90° 这段弧；θ 为世界方位角，45° 正对镜头 */
const DCX=58,DCY=30,DR=12,DH=34,SCR0=16,SCR1=76,SZ0=15.2,SZ1=24.2;
function drumCols(r,cb){const s=P(DCX,DCY,0),A=r*2.828,B=r*1.414;
  for(let x=R(s[0]-A);x<R(s[0]+A);x++){const u=(x+.5-s[0])/A;if(u<=-1||u>=1)continue;const ph=Math.acos(u);cb(x,u,ph*57.2958-45,s[1]+B*Math.sin(ph));}}
const dShade=th=>{const t=th/57.2958;return .62+.36*Math.max(0,(-.3*Math.cos(t)+Math.sin(t))/1.044);};
function zs(x,yb,z0,z1,c){const a=R(yb-z1*KZ);ctx.fillStyle=c;ctx.fillRect(x,a,1,Math.max(1,R(yb-z0*KZ)-a));}
let ledX0=0,ledW=0,signX0=0,signX1=0,canX0=1e9,canX1=-1e9;
drumCols(DR,(x,u,th)=>{if(th<0||th>90)return;if(th<=SCR1&&th>=SCR0){if(!ledW)ledX0=x;ledW=x-ledX0+1;}if(th<=72&&th>=20){if(!signX0)signX0=x;signX1=x;}if(x<canX0)canX0=x;if(x>canX1)canX1=x;});
function drawDrum(){
  const sx0=signX0+FL((signX1-signX0+1-tw('KAPLAN'))/2),cx0=FL((canX0+canX1+1-tw('WILKIE EDGE'))/2);
  drumCols(DR,(x,u,th,yb)=>{if(th<0||th>90)return;const k=dShade(th);
    // 底部：深色玻璃门厅 + 浅色立柱，上方贴弧面的白色招牌带 WILKIE（绿）EDGE（橙）
    zs(x,yb,0,6.3,sh('#34434d',k*1.05));if(x%3===0)zs(x,yb,.4,1.3,sh('#dcbf86',k));
    if(Math.abs(th-8)<3||Math.abs(th-45)<3||Math.abs(th-82)<3)zs(x,yb,0,6.3,sh('#c3c9cc',k));
    zs(x,yb,6.3,8.9,sh('#f0f1ee',Math.min(1,k*1.08)));
    const c=x-cx0;for(let r=0;r<5;r++)if(glyphAt('WILKIE EDGE',c,r)){ctx.fillStyle=FL(c/4)>=7?'#ef9a2a':'#3c9d46';ctx.fillRect(x,R(yb-8.55*KZ)+r,1,1);}
    zs(x,yb,8.9,27,sh(C.glass,k*1.08));if(th>50&&th<60)zs(x,yb,8.9,27,sh('#d3e2e8',k*1.08));
    for(let z=8.9;z<27;z+=1.9)zs(x,yb,z,z+.25,sh('#e4ecef',k*1.08));if(x%3===0)zs(x,yb,8.9,27,sh('#e2eaee',k*1.08));
    if(th>=SCR0-2.5&&th<=SCR1+2.5)zs(x,yb,SZ0-.45,SZ1+.45,sh('#202429',k));
    zs(x,yb,27,DH,sh(C.tile,k));zs(x,yb,DH-.45,DH,sh('#ecede9',k));
    if(x>=signX0&&x<=signX1){zs(x,yb,28.2,32.6,sh(C.navy,.8+.2*k));const sc=x-sx0;
      for(let r=0;r<5;r++)if(glyphAt('KAPLAN',sc,r)){ctx.fillStyle='#f4f6fb';ctx.fillRect(x,R(yb-31.8*KZ)+r,1,1);}}});}
/* ===== David Elias Building（1928）：3 层，西南转角切角，正门与山花正对 Selegie / Middle Rd 十字路口；
   南立面（Middle Rd）为半圆拱廊 + 橙色木百叶，西立面沿 Short St，东侧为平直侧墙；深挑檐托架，红瓦低坡四坡顶（照片 8） ===== */
const DEW='#a7abad',DTR='#c3c6c5',DDP='#474e52',SHU='#c8772f',SHD='#93531d';
const deIn=d=>[[122+d,18+d],[150-d,18+d],[150-d,46-d],[128+.414*d,46-d],[122+d,40-.414*d]];
const DEP=deIn(0);
function deWin(f,u,zb,open){fq(f,u-.15,u+1.05,zb-.15,zb+2.75,DTR);
  if(open){fq(f,u,u+.9,zb,zb+2.6,'#3a4246');fq(f,u-.55,u-.1,zb+.1,zb+2.5,SHU);fq(f,u+1,u+1.45,zb+.1,zb+2.5,SHU);}
  else{fq(f,u,u+.9,zb,zb+2.6,SHU);for(let z=zb+.4;z<zb+2.5;z+=.55)fq(f,u,u+.9,z,z+.2,SHD);fv(f,u+.45,zb,zb+2.6,'#7a4116');}
  fq(f,u-.1,u+1,zb-.95,zb-.15,DTR);for(let b=u+.1;b<u+1;b+=.3)fv(f,b,zb-.85,zb-.25,'#8c9192');}
function deFace(f,n,side){const bw=f.L/n;
  for(let i=0;i<n;i++){const u0=i*bw+.55,u1=(i+1)*bw-.55;
    if(side){fq(f,u0,u1,.15,4.2,'#7f878b');for(let z=.5;z<4.1;z+=.45)fq(f,u0,u1,z,z+.15,'#6a7276');}
    else{farch(f,u0,u1,0,3.1,DDP);fq(f,u0+.3,u1-.3,.15,2.5,'#7c8a90');fq(f,i*bw-.1,i*bw+.1,4.5,5.1,'#1f2225');}}
  fq(f,0,f.L,5.2,5.7,DTR);fq(f,0,f.L,9.4,9.7,DTR);
  for(let i=0;i<=n;i++){const u=Math.min(Math.max(i*bw,.35),f.L-.35);fq(f,u-.35,u+.35,5.7,12.9,DTR,.97);for(let z=6.2;z<12.8;z+=.7)fq(f,u-.35,u+.35,z,z+.12,'#959a9b');}
  for(let i=0;i<n;i++){const c=i*bw+bw/2;for(const zb of [6.6,10.2])for(const d of [-1.15,.25])deWin(f,c+d,zb,hsh(i*7+zb*3,d*9+f.L)<.22);}
  fq(f,0,f.L,12.9,13.6,DEW,.72);for(let u=.9;u<f.L;u+=1.8)fv(f,u,12.9,13.6,'#d0d3d2');}
/* 切角上的薄构件（阳台、山花）：沿切角方向 u0–u1，向路口外挑 o0–o1 米 */
const CHA=[122,40],CD=[.7071,.7071],CN=[-.7071,.7071];
const chq=(u0,u1,o0,o1)=>[[u0,o0],[u1,o0],[u1,o1],[u0,o1]].map(([u,o])=>[CHA[0]+CD[0]*u+CN[0]*o,CHA[1]+CD[1]*u+CN[1]*o]);
function drawDE(){const FY=FC(128,46,150,46),FX=FC(150,46,150,18);
  prism(DEP,0,13.6,DEW);deFace(FY,5);deFace(FX,7,true);
  // 切角正门：两层阳台与山花朝向路口（与本视角视线平行，只露出侧影）
  for(const zb of [6,9.9]){prism(chq(1.2,7.3,0,1.1),zb-.35,zb,DTR);prism(chq(1.2,7.3,.9,1.1),zb,zb+1.1,'#b9bcbb');}
  prism([[120.6,16.6],[151.4,16.6],[151.4,47.4],[127.42,47.4],[120.6,40.58]],13.6,14.3,'#c4c7c6');
  prism(deIn(1),14.3,14.9,'#b9583a');prism(deIn(4),14.9,15.6,'#c4643f');prism(deIn(7),15.6,16.3,'#cf7048');prism(deIn(10),16.3,17,'#d97b52');
  prism(chq(.9,7.6,-.2,.5),14.3,19.4,DTR);prism(chq(3.4,5.1,-.2,.5),19.4,19.9,DTR);
  // 南立面靠近切角的转角柱与灯
  fq(FY,0,.9,0,13.6,DTR,.95);dot(129.2,46,4.8,'#fff0b8');}
/* ===== Ten Square（1 Short St）：15 层车塔展厅。首层矩形玻璃展厅 + 白色 TEN 横带与百叶；塔身白色铝板、四角切角，
   正面和侧面各一条通高玻璃：正面是展示车位（每层一辆），侧面是升降井；中下部环绕广告屏 ===== */
const LFZ=L=>7.4+(L-1)*3.05,NL=14,TOPZ=LFZ(NL+1),LXC=110.2,LY0=21.85,HY0=31.4,BYC=28.2,BX0=103.8,SX0=106.6,SY0=25.9,BB0=14.2,BB1=27.8;
const CARC=['#f1f1ec','#d8dadc','#2a2d31','#c0312a','#2f58a8','#e8b730','#6b7378','#f07a1e','#1f8a5a','#9aa3a8','#b5162b','#fafafa'];
const pick=()=>CARC[FL(rnd()*CARC.length)];
const occ=[null];for(let L=1;L<=NL;L++)occ.push(rnd()<.8?pick():null);occ[5]=null;occ[11]=null;
const OCT=d=>[[100+d,20],[102,18+d],[110,18+d],[112-d,20],[112-d,28],[110,30-d],[102,30-d],[100+d,28]];
const TF=FC(102,30,110,30),TCH=FC(110,30,112,28),TS=FC(112,28,112,20),GF=FC(100,30,112,30),GS=FC(112,30,112,18);
const PARK=[[118.5,-10,'#d8dadc'],[118.5,-3.6,'#2a2d31'],[118.5,2.8,'#f1f1ec'],[115.5,8,'#2f58a8']];
function carY(xc,y0,z,col){box(xc-.85,y0+.35,z,1.7,3.6,.3,'#24272a');box(xc-.9,y0,z+.3,1.8,4.3,.7,col);box(xc-.78,y0+1.15,z+1,1.56,2.1,.45,col);
  fx(xc+.78,y0+1.3,y0+3.1,z+1.05,z+1.38,lit('x','#4b5d69'));fy(y0+3.25,xc-.7,xc+.7,z+1.05,z+1.38,lit('y','#4b5d69'));}
function carX(x0,yc,z,col){box(x0+.35,yc-.85,z,3.6,1.7,.3,'#24272a');box(x0,yc-.9,z+.3,4.3,1.8,.7,col);box(x0+1.15,yc-.78,z+1,2.1,1.56,.45,col);
  fy(yc+.78,x0+1.3,x0+3.1,z+1.05,z+1.38,lit('y','#4b5d69'));fx(x0+3.25,yc-.7,yc+.7,z+1.05,z+1.38,lit('x','#4b5d69'));}
const fqa=(f,u0,u1,z0,z1,c)=>poly([fpt(f,u0,z0),fpt(f,u1,z0),fpt(f,u1,z1),fpt(f,u0,z1)],c);
/* 升降循环（每段 12 s，存车/取车交替，取出的车停在门前交车位，下一轮再存回塔里）：预备 → 发力 → 收势 → 回位 */
const lift={type:'retrieve',L:1,t:99,z:0,ph:3,car:{o:'y',y0:HY0,z:0},col:'#c0312a'};
const ss=t=>t*t*(3-2*t);
function riseZ(a,b,t){const s=t<.5?2*t*t:1-2*(1-t)*(1-t);let z=a+(b-a)*s;if(t>.78)z+=Math.sign(b-a)*.3*Math.sin(Math.PI*(t-.78)/.22);return z;}
function nextJob(){const store=lift.type==='retrieve',c=[];for(let L=1;L<=NL;L++)if(store?!occ[L]:occ[L])c.push(L);
  if(!c.length)return;lift.type=store?'store':'retrieve';lift.L=c[FL(Math.random()*c.length)];lift.t=0;}
function stepLift(dt){lift.t+=dt;if(lift.t>=12)nextJob();const t=lift.t,zt=LFZ(lift.L);let c=lift.car;
  if(lift.type==='store'){
    if(t<2.4){lift.ph=0;lift.z=t>2?-.15*Math.sin(Math.PI*(t-2)/.4):0;c.o='y';c.y0=lerp(HY0,LY0,1-Math.pow(1-Math.min(1,t/2),2));c.z=t>2?lift.z:0;}
    else if(t<6.4){const s=(t-2.4)/4;lift.ph=s<.5?1:2;lift.z=riseZ(0,zt,s);c.o='y';c.y0=LY0;c.z=lift.z;}
    else if(t<8.4){lift.ph=2;lift.z=zt;c.z=zt;if(t<7.2){c.o='y';c.y0=lerp(LY0,SY0,ss((t-6.4)/.8));}else{c.o='x';c.x0=lerp(SX0,BX0,ss((t-7.2)/1.2));}}
    else{if(c){occ[lift.L]=lift.col;lift.car=null;}lift.ph=3;lift.z=t<11.6?riseZ(zt,0,(t-8.4)/3.2):0;}
  }else{
    if(t<1.2){lift.ph=0;lift.z=-.12*Math.sin(Math.PI*t/1.2);}
    else if(t<5.2){const s=(t-1.2)/4;lift.ph=s<.5?1:2;lift.z=riseZ(0,zt,s);}
    else if(t<7.2){lift.ph=2;lift.z=zt;if(!c){lift.col=occ[lift.L];occ[lift.L]=null;c=lift.car={o:'x',x0:BX0,y0:LY0,z:zt};}c.z=zt;
      if(t<6.4){c.o='x';c.x0=lerp(BX0,SX0,ss((t-5.2)/1.2));}else{c.o='y';c.y0=lerp(SY0,LY0,ss((t-6.4)/.8));}}
    else if(t<10.4){lift.ph=3;lift.z=riseZ(zt,0,(t-7.2)/3.2);c.o='y';c.y0=LY0;c.z=lift.z;}
    else{lift.ph=3;lift.z=0;c.o='y';c.z=0;c.y0=lerp(LY0,HY0,ss(Math.min(1,(t-10.4)/1.6)));}}}
const carOut=c=>!!c&&c.o==='y'&&c.z<1&&c.y0>25.7;
const drawLiftCar=c=>c.o==='y'?carY(LXC,c.y0,c.z,lift.col):carX(c.x0,BYC,c.z,lift.col);
function poster(c,r,w,h){if(c===0||r===0||c===w-1||r===h-1)return '#3a0a0a';
  if(r>h*.74){const a=FL(h*.8);if((r===a||r===a+1)&&c>3&&c<w-4)return '#f6efe6';if(r===FL(h*.9)&&c>7&&c<w-8)return '#d98c7a';return '#170707';}
  const cx=w/2,cy=h*.36,d=(c-cx)*(c-cx)+(r-cy)*(r-cy);
  if((c===FL(cx)-6&&r>h*.56)||(c===FL(cx)-4&&r>h*.6)||(c===FL(cx)+6&&r>h*.58))return '#170707';
  if(r===FL(h*.2)&&Math.abs(c-cx+1)<5)return '#2a0a0a';
  if(d<30)return d<12?'#fde7a0':'#f6c34a';return r<h*.25?'#e2462a':r<h*.5?'#cf2f22':'#a81f1c';}
function drawTower(){const c=lift.car,inC=c&&!carOut(c);
  // 首层玻璃展厅
  fq(GF,0,12,0,4.6,'#d6dde0');fq(GS,0,12,0,4.6,'#ccd4d7');carX(101,26.4,0,'#c0312a');
  if(lift.z<5)box(108.8,21.6,lift.z-.3,2.8,4.8,.3,'#c9ced1');if(inC&&c.z<5)drawLiftCar(c);
  fqa(GF,0,12,0,4.6,'rgba(225,238,243,.2)');fqa(GS,0,12,0,4.6,'rgba(225,238,243,.16)');
  for(let u=0;u<=12;u+=2){fv(GF,u,0,4.6,'#a8b4ba');fv(GS,u,0,4.6,'#a8b4ba');}
  fq(GF,0,12,4.6,6.6,'#f1f2f0');fq(GS,0,12,4.6,6.6,'#f1f2f0');const tp=fpt(GF,1.4,6.4);txt('TEN',R(tp[0]),R(tp[1]),1,'#c8202a');
  tq(100,18,112,30,6.6,'#e3e6e7');
  // 塔身：玻璃条后的室内、楼板、升降井、展示车、玻璃反光、白色铝板
  fq(TF,1.2,6.8,7.4,TOPZ,'#38434b');fq(TS,1.2,6.8,7.4,TOPZ,'#323c43');
  for(let L=1;L<=NL+1;L++){const z=LFZ(L);fq(TF,1.2,6.8,z-.3,z,'#87929a');fq(TS,1.2,6.8,z-.3,z,'#7d8890');}
  vl(LXC,22.8,Math.max(lift.z,7),TOPZ,'#9aa3a8');vl(LXC,25.2,Math.max(lift.z,7),TOPZ,'#9aa3a8');
  if(lift.z>=5)box(108.8,21.6,lift.z-.3,2.8,4.8,.3,'#c9ced1');
  for(let L=1;L<=NL;L++)if(occ[L])carX(BX0,BYC,LFZ(L),occ[L]);
  if(inC&&c.z>=5)drawLiftCar(c);
  fqa(TF,1.2,6.8,7.4,TOPZ,'rgba(222,236,242,.14)');fqa(TS,1.2,6.8,7.4,TOPZ,'rgba(222,236,242,.1)');fv(TF,4,7.4,TOPZ,'#b9c5cb');fv(TS,4,7.4,TOPZ,'#b9c5cb');
  for(const [f,a,b] of [[TF,0,1.2],[TF,6.8,8],[TS,0,1.2],[TS,6.8,8],[TCH,0,TCH.L]]){fq(f,a,b,6.6,TOPZ,'#e9ecee');
    for(let L=1;L<=NL+1;L+=2)fq(f,a,b,LFZ(L)-.15,LFZ(L),'#cfd5d8');}
  fv(TF,.6,6.6,TOPZ,'#cdd3d6');fv(TS,7.4,6.6,TOPZ,'#cdd3d6');vl(110,30,6.6,TOPZ,'#f7f9fa');vl(112,28,6.6,TOPZ,'#d5dbde');
  for(const f of [TF,TCH,TS]){fq(f,0,f.L,6.6,7.4,'#a0a8ad');fv(f,f.L/2,6.6,7.4,'#7d868b');}
  // 环绕广告屏：正面 + 切角 + 侧面前 3 m
  const bx0=R(P(102,30,0)[0]),bx1=R(P(112,25,0)[0]),bw=bx1-bx0,bh=R((BB1-BB0)*KZ);
  for(let x=bx0;x<bx1;x++){const d=(x+.5-OX)/2;let wx,wy,k;
    if(d<=80){wy=30;wx=d+30;k=.97;}else if(d<=84){wx=(d+140)/2;wy=140-wx;k=.88;}else{wx=112;wy=112-d;k=.8;}
    const top=R(OY+wx+wy-BB1*KZ);for(let r=0;r<bh;r++){ctx.fillStyle=sh(poster(x-bx0,r,bw,bh),k);ctx.fillRect(x,top+r,1,1);}}
  // 顶冠：两级内收
  prism(OCT(.4),TOPZ,TOPZ+1.4,'#eef0f1');prism(OCT(1.1),TOPZ+1.4,TOPZ+3.4,'#dfe4e6');
  fq(FC(102,28.9,110,28.9),.6,7.4,TOPZ+1.8,TOPZ+3,'#8fa3ad');fq(FC(110.9,28,110.9,20),0,8,TOPZ+1.8,TOPZ+3,'#8fa3ad');}
/* ===== 圆鼓 LED 幕墙：约 4 层高、占左前 90° 弧，三组画面循环，左向右擦除切换 ===== */
function slide(n,c,r,t){const Wl=ledW;
  if(n===0){const cl=((t*1.5)%(Wl+12))-6;if((c-cl)*(c-cl)/10+(r-5)*(r-5)/1.5<1)return '#ffffff';
    if(r>21+1.2*Math.sin(c*.5))return r>25?'#2d5f2e':'#3f7d3c';
    if(c>=7&&c<=12&&r>=17)return '#efe9de';if((c===8&&r>=12)||(c===11&&r>=14))return r<17&&(c===8?r>12:r>14)||r>=17?'#efe9de':'#3c4b8c';
    const ridge=12+2.5*Math.sin(c*.42+1)+1.6*Math.sin(c*1.3);if(r>ridge)return r<ridge+1.3&&c%6<3?'#eef0f8':'#6a70ad';
    return r<6?'#86a8e2':r<11?'#b3b5e6':'#efc3cc';}
  if(n===1){const tx=FL((Wl-23)/2);if(glyphAt('KAPLAN',c-tx,r-9))return '#ffffff';if(r===16&&c>=tx&&c<tx+23)return '#e7b84a';
    if(r===21)for(let i=0;i<3;i++)if(c===tx+7+i*4)return FL(t*3)%3===i?'#ffffff':'#5a68b0';
    return ((c+r*.6-t*14)%34+34)%34<2.5?'#34489f':'#1c2b68';}
  const dx=c-Wl/2,dy=r-17;if(r>19&&hsh(c*7+r,FL(t*7))>.9)return '#ffd66b';
  if(dx*dx/90+dy*dy/9<1)return dx*dx/40+dy*dy/4<1?'#f1574d':'#c32a2f';
  if(r<14&&Math.abs(dx+Math.sin(t*1.3)*6)<r*.3)return '#8a1f24';return r>19?'#3a0709':'#5c0b10';}
function led(t){const per=7,n=FL(t/per)%3,tt=t%per,prev=(n+2)%3,wipe=tt<.6?tt/.6*ledW:1e9;
  drumCols(DR,(x,u,th,yb)=>{const c=x-ledX0;if(c<0||c>=ledW)return;const k=R((.84+.16*dShade(th))*40)/40,top=R(yb-SZ1*KZ),bot=R(yb-SZ0*KZ);
    for(let y=top;y<bot;y++){ctx.fillStyle=sh(slide(c<wipe?n:prev,c,y-top,t),k);ctx.fillRect(x,y,1,1);}});}
/* ===== 信号灯：30 s 周期。A=Wilkie/Short 方向，B=Selegie 方向；行人过街跟随对向红灯 ===== */
const SIG=30;let sp=3;
const sigA=()=>sp<12?'g':sp<14.5?'a':'r',sigB=()=>sp>=15.5&&sp<27?'g':sp>=27&&sp<29.5?'a':'r';
const canWalk=tag=>tag==='S'?sp>=.5&&sp<7.5:sp>=16&&sp<22.5,pedSig=tag=>(tag==='S'?sp>=.5&&sp<11:sp>=16&&sp<26)?'g':'r';
/* ===== 车流：左侧通行。跟驰 + 停止线 + 礼让行人；刹车时点头、尾灯变亮（预备/收势），起步加速（发力） ===== */
const lanes=[{ax:'x',d:1,c:52.2,g:'A',stop:73.3},{ax:'x',d:1,c:55.4,g:'A',stop:73.3},{ax:'x',d:-1,c:59.6,g:'A',stop:-105.6},{ax:'x',d:-1,c:62.8,g:'A',stop:-105.6},
  {ax:'y',d:1,c:82.1,g:'B',stop:44.6},{ax:'y',d:1,c:86.1,g:'B',stop:44.6},{ax:'y',d:1,c:90.1,g:'B',stop:44.6},{ax:'y',d:1,c:94.3,g:'B',stop:44.6,bus:true}];
for(const l of lanes){l.zones=l.ax==='x'?[[74.4,78.8],[100.2,104.6]]:[[45.6,50],[64.8,69.4]];l.zs=l.zones.map(([a,b])=>l.d>0?[a,b]:[-b,-a]);
  const lo=l.ax==='x'?X0:Y0,hi=l.ax==='x'?X1:Y1;l.s0=l.d>0?lo-1:-hi-1;l.s1=l.d>0?hi:-lo;l.cars=[];l.next=0;}
const VD={car:[4.5,1.8,1.5],taxi:[4.6,1.8,1.5],van:[5,1.9,1.95],bus:[12,2.55,3.2],truck:[5.6,2,2.3]};
const PAL=['#f1f1ec','#d6d9db','#2a2d31','#1b1d20','#9aa3a8','#c0312a','#2f4f8f','#ece6d6','#6b7378'];
function mkVeh(l,s){const r=Math.random(),t=l.bus?(r<.45?'bus':r<.75?'taxi':'car'):(r<.05?'bus':r<.13?'truck':r<.25?'van':r<.42?'taxi':'car'),D=VD[t];
  const col=t==='bus'?'#57ad4b':t==='taxi'?(Math.random()<.8?'#2f6fd0':'#e6b82e'):t==='truck'?'#f2f2ee':PAL[FL(Math.random()*PAL.length)];
  return {t,L:D[0],w:D[1],h:D[2],col,s,v:0,vm:(t==='bus'?9.5:12)+Math.random()*3,go:false,dec:false,pitch:0,brk:false};}
for(const l of lanes){let s=l.s1-2;while(s>l.s0+6){const v=mkVeh(l,s);v.v=v.vm*.7;l.cars.push(v);s-=v.L+8+Math.random()*22;}}
function zoneBusy(l,z){for(const p of peds){if(l.ax==='x'?(p.x>=z[0]&&p.x<=z[1]&&Math.abs(p.y-l.c)<2.4):(p.y>=z[0]&&p.y<=z[1]&&Math.abs(p.x-l.c)<2.4))return true;}return false;}
function stepCars(dt){for(const l of lanes){const st=l.g==='A'?sigA():sigB(),busy=l.zones.map(z=>zoneBusy(l,z));
  for(let i=0;i<l.cars.length;i++){const c=l.cars[i],a=l.cars[i-1];let lim=a?a.s-a.L-2:1e9;
    if(st==='g'){c.go=false;c.dec=false;}
    else if(c.s<=l.stop){if(st==='a'&&!c.dec){c.dec=true;c.go=l.stop-c.s<c.v*c.v/9;}if(!c.go)lim=Math.min(lim,l.stop);}
    for(let k=0;k<2;k++)if(busy[k]&&c.s<l.zs[k][0]-.2)lim=Math.min(lim,l.zs[k][0]-.5);
    const want=Math.min(c.vm,Math.sqrt(Math.max(0,8*(lim-c.s)))),dv=clamp(want-c.v,-7*dt,2.6*dt);
    c.v=Math.max(0,c.v+dv);c.s+=c.v*dt;const acc=dv/Math.max(dt,1e-3);c.brk=acc<-1;c.pitch+=(clamp(acc/5,-1,1)-c.pitch)*Math.min(1,dt*5);}
  if(l.cars.length&&l.cars[0].s-l.cars[0].L>l.s1)l.cars.shift();
  l.next-=dt;const last=l.cars[l.cars.length-1];
  if(l.next<=0&&(!last||last.s-last.L>l.s0+3)){const v=mkVeh(l,l.s0);v.v=last?Math.min(v.vm,last.v+2):v.vm*.9;l.cars.push(v);l.next=(l.bus?3:1.8)+Math.random()*(l.bus?7:5);}}}
function vehBox(l,c){if(l.ax==='x'){const x0=l.d>0?c.s-c.L:-c.s;return [x0,l.c-c.w/2,x0+c.L,l.c+c.w/2];}return [l.c-c.w/2,c.s-c.L,l.c+c.w/2,c.s];}
function drawVeh(l,c,b){const [x0,y0,x1,y1]=b,ax=l.ax,d=l.d,w=x1-x0,dp=y1-y0;
  const seg=(f0,f1)=>ax==='x'?(d>0?[x0+c.L*f0,x0+c.L*f1]:[x1-c.L*f1,x1-c.L*f0]):[y0+c.L*f0,y0+c.L*f1];
  const sub=(f0,f1,ins)=>{const [a,e]=seg(f0,f1);return ax==='x'?[a,y0+ins,e-a,dp-2*ins]:[x0+ins,a,w-2*ins,e-a];};
  tq(x0+.2,y0+.2,x1+.7,y1+.35,0,'rgba(40,50,60,.2)');box(x0+.15,y0+.15,0,w-.3,dp-.3,.35,'#25282b');
  const front=d>0,gl='#3a4a55';
  if(c.t==='bus'){box(x0,y0,.35,w,dp,2.85,c.col);if(ax==='x')fy(y1,x0+.6,x1-.6,1.7,2.8,lit('y',gl));else fx(x1,y0+.6,y1-.6,1.7,2.8,lit('x',gl));
    tq(x0+.2,y0+.2,x1-.2,y1-.2,3.2,'#eef1ec');if(front){if(ax==='x')fx(x1,y0+.2,y1-.2,1.4,2.9,lit('x',gl));else fy(y1,x0+.2,x1-.2,1.4,2.9,lit('y',gl));}}
  else if(c.t==='truck'){let s=sub(.69,1,0);box(s[0],s[1],.35,s[2],s[3],1.75,'#f2f2ee');s=sub(0,.66,.05);box(s[0],s[1],.35,s[2],s[3],1.95,'#a3abb0');
    for(let f=.08;f<.66;f+=.1){const q=seg(f,f);if(ax==='x')vl(q[0],y1-.05,.6,2.2,lit('y','#6f777c'));else vl(x1-.05,q[0],.6,2.2,lit('x','#6f777c'));}}
  else{const sq=c.brk?-.08:0;box(x0,y0,.35+sq,w,dp,.75,c.col);
    const sft=-c.pitch*.05,fr=c.t==='van'?[.1+sft,.88+sft]:[.24+sft,.72+sft],ch=c.t==='van'?.85:.45,zc=1.1+sq,s=sub(fr[0],fr[1],.12);
    box(s[0],s[1],zc,s[2],s[3],ch,c.col);fy(s[1]+s[3],s[0]+.1,s[0]+s[2]-.1,zc+.06,zc+ch-.1,lit('y','#475966'));fx(s[0]+s[2],s[1]+.1,s[1]+s[3]-.1,zc+.06,zc+ch-.1,lit('x','#475966'));
    if(c.t==='taxi')box(s[0]+s[2]/2-.25,s[1]+s[3]/2-.25,zc+ch,.5,.5,.25,'#f6f2df');}
  const hl='#fff3c4',tl=c.brk?'#ff3b30':'#b03a32';
  if(ax==='x'){dot(x1,y0+.35,.8,front?hl:tl);dot(x1,y1-.35,.8,front?hl:tl);}else{dot(x0+.35,y1,.8,hl);dot(x1-.35,y1,.8,hl);}}
/* ===== 行人：沿人行道行走，路缘等灯（收势→回位），绿灯后反应片刻（预备）再加速（发力） ===== */
const RT=[[[-14,46.9],[79,46.9,'S'],[97.2,47.3],[97.4,48.6],[X1,48.6]],[[X1,49.3],[98,49.3],[96.9,48,'S'],[79.2,48],[78.6,47.6],[-14,47.6]],
  [[76.2,-14],[76.2,50.1,'W'],[76.2,65.3],[76.4,66.5],[-14,66.5]],[[-14,67.6],[77.4,67.6],[77.4,65.1,'W'],[77.4,50.2],[77.4,-14]],
  [[-14,66.9],[79.2,66.9,'S'],[96.8,66.9],[X1,66.9]],[[X1,68],[96.8,68,'S'],[79.2,68],[-14,68]],
  [[97.8,-14],[97.8,49.6],[101.6,49.9,'W'],[101.6,65.2],[101.8,66.4],[X1,66.4]],[[X1,67.4],[102.8,67.4],[102.8,65.1,'W'],[102.8,49.9],[98.8,49.6],[98.8,-14]],
  [[76.9,-14],[76.9,46.4],[-14,46.4]],[[-14,47.2],[75.6,47.2],[75.6,-14]]];
const SHIRT=['#e8564c','#3a78d0','#f3f1ea','#2d3036','#f2c440','#58b06a','#8e5bb5','#ff8c42','#24408f','#cfd8dc'];
const peds=[];
function respawn(p,mid){const rt=RT[FL(Math.random()*RT.length)];p.rt=rt;p.i=1;p.x=rt[0][0];p.y=rt[0][1];
  if(mid){let i=1+FL(Math.random()*(rt.length-1));if(rt[i-1][2])i=Math.min(i+1,rt.length-1);const f=Math.random(),a=rt[i-1],b=rt[i];p.i=i;p.x=lerp(a[0],b[0],f);p.y=lerp(a[1],b[1],f);}}
for(let i=0;i<34;i++){const p={vm:1.15+Math.random()*.45,o:(Math.random()-.5)*.9,sh:SHIRT[FL(Math.random()*SHIRT.length)],pn:Math.random()<.5?'#2f3540':'#6b7a8c',
  sk:Math.random()<.65?'#e8bb92':'#9a6643',hr:Math.random()<.8?'#2a2420':'#8a6a4a',bag:Math.random()<.4,v:0,ph:Math.random()*6,wait:0,react:0,dx:1,dy:0};p.v=p.vm;respawn(p,true);peds.push(p);}
function stepPeds(dt){for(const p of peds){const tg=p.rt[p.i],dx=tg[0]-p.x,dy=tg[1]-p.y,dist=Math.hypot(dx,dy),tag=tg[2],hold=!!tag&&!canWalk(tag);
  let want=hold?Math.min(p.vm,dist*1.5):p.vm;if(p.react>0){p.react-=dt;want=0;}
  p.v=Math.max(0,p.v+clamp(want-p.v,-2.4*dt,1.1*dt));
  if(dist>1e-3){const m=Math.min(dist,p.v*dt);p.x+=dx/dist*m;p.y+=dy/dist*m;p.dx=dx/dist;p.dy=dy/dist;}
  if(dist<.06){if(hold)p.wait+=dt;else{if(p.wait>0){p.react=.25+Math.random()*.5;p.wait=0;}p.i++;if(p.i>=p.rt.length)respawn(p,false);}}
  if(p.v>.15)p.ph+=dt*p.v*5.2;}}
function drawPed(x,y,p,arm){const s=P(x,y,0),X=R(s[0]),Y=R(s[1]),mv=p.v>.15,f=mv?(Math.sin(p.ph)>0?1:-1):0,lean=!mv&&p.wait>0&&Math.sin(p.wait*2.4)>.6?1:0,rt=(p.dx-p.dy)>=0;
  ctx.fillStyle='rgba(40,50,60,.2)';ctx.fillRect(X-1,Y,3,1);ctx.fillStyle=p.pn;
  ctx.fillRect(X-1,Y-2,1,f<0?1:2);ctx.fillRect(X,Y-2,1,f>0?1:2);
  ctx.fillStyle=p.sh;ctx.fillRect(X-1+lean,Y-4,2,2);if(p.bag){ctx.fillStyle='#3b3f45';ctx.fillRect(rt?X-2+lean:X+1+lean,Y-4,1,2);}
  ctx.fillStyle=p.sk;ctx.fillRect(X-1+lean,Y-5,2,1);ctx.fillStyle=p.hr;ctx.fillRect((rt?X-1:X)+lean,Y-5,1,1);
  if(arm){ctx.fillStyle=p.sk;ctx.fillRect(X+1,Y-4-arm,1,1);}}
/* 门口聊天的学生：挥手 = 预备(手下沉) → 发力(举起) → 收势(摆动) → 回位(放下)，4 s 一轮 */
const students=[[44.4,43.6],[45.8,44.1],[47.3,43.5]].map(([x,y],i)=>({x,y,v:0,ph:0,wait:0,dx:i===1?-1:1,dy:0,pn:'#2f3540',sh:['#f3f1ea','#24408f','#e8564c'][i],sk:'#e8bb92',hr:'#2a2420',bag:i!==1}));
/* ===== 道具：行道树（仅照片中有的位置）、路灯、信号灯、绿色护栏、单车、消防栓 ===== */
function railItem(x0,y0,x1,y1){add(Math.min(x0,x1)-.1,Math.min(y0,y1)-.15,0,Math.max(x0,x1)+.1,Math.max(y0,y1)+.15,1.1,()=>{const n=Math.hypot(x1-x0,y1-y0);
  for(let t=0;t<=n;t+=2)vl(lerp(x0,x1,t/n),lerp(y0,y1,t/n),0,1.1,'#3a8f47');ln(P(x0,y0,1.1),P(x1,y1,1.1),'#4fae5c');ln(P(x0,y0,.55),P(x1,y1,.55),'#3a8f47');});}
function lampItem(x,y,arms){add(x-.2,y-.2,0,x+.2,y+.2,10,()=>vl(x,y,0,10,'#8a9297'));
  for(const [ax,ay] of arms)add(Math.min(x,x+ax*3)-.2,Math.min(y,y+ay*3)-.2,9.7,Math.max(x,x+ax*3)+.2,Math.max(y,y+ay*3)+.2,10.6,()=>{const e=P(x+ax*3,y+ay*3,10.3);ln(P(x,y,10),e,'#8a9297');ctx.fillStyle='#6f777c';ctx.fillRect(R(e[0])-1,R(e[1]),3,1);ctx.fillStyle='#fff2c2';ctx.fillRect(R(e[0]),R(e[1])+1,1,1);});}
function sigItem(x,y,grp,ped){add(x-.4,y-.4,0,x+.4,y+.4,5.2,()=>{vl(x,y,0,3.3,'#5a5f63');box(x-.35,y-.35,3.3,.7,.7,1.9,'#2b2f33');const s=grp==='A'?sigA():sigB();
  dot(x,y+.35,4.8,s==='r'?'#ff3b30':'#4a1d1b');dot(x,y+.35,4.3,s==='a'?'#ffb21e':'#4a3a14');dot(x,y+.35,3.8,s==='g'?'#3ddc6a':'#143d22');
  box(x+.2,y-.2,2.2,.4,.4,.6,'#2b2f33');dot(x+.6,y,2.5,pedSig(ped)==='g'?'#3ddc6a':'#ff3b30');});}
function buildItems(){
  for(const x of [3,13,23,33,43,53]){const y=49.2,dx=Math.sin(T*1.1+x*.4)*.35;
    add(x-.3,y-.3,0,x+.3,y+.3,3.2,()=>box(x-.25,y-.25,0,.5,.5,3.2,C.trunk),false);
    add(x-2.6,y-2.6,2.8,x+2.6,y+2.6,8.4,()=>{box(x-2.6+dx*.3,y-2.6,2.8,5.2,5.2,2.6,C.leaf,.84,.62,1.05);box(x-1.9+dx*.7,y-1.9,5.2,3.8,3.8,2,C.leaf,.92,.68,1.15);box(x-1.1+dx,y-1.1,7,2.2,2.2,1.2,C.leaf2,.95,.72,1.15);});}
  for(const [a,b] of [[X0,21.4],[22.6,51.4],[52.6,73.2],[105.8,X1]])railItem(a,57.5,b,57.5);railItem(79.2,31,79.2,44.2);
  lampItem(22,57.5,[[0,-1],[0,1]]);lampItem(52,57.5,[[0,-1],[0,1]]);lampItem(79.4,8,[[1,0]]);lampItem(79.4,30,[[1,0]]);lampItem(40,65.2,[[0,-1]]);lampItem(120,65.2,[[0,-1]]);
  sigItem(79.4,49.9,'A','S');sigItem(96.9,49.9,'B','W');sigItem(79.4,65,'B','W');sigItem(96.9,65,'A','S');
  for(const y of [38.6,40.6])add(77.9,y-.2,0,78.9,y+.2,1,()=>{const s=P(78.4,y,0),X=R(s[0]),Y=R(s[1]);ctx.fillStyle='#2b2e31';ctx.fillRect(X-3,Y-2,2,2);ctx.fillRect(X+1,Y-2,2,2);ctx.fillStyle=y<40?'#d9b23a':'#c8352f';ctx.fillRect(X-2,Y-3,4,1);ctx.fillRect(X,Y-4,1,1);});
  add(78.6,35.4,0,79,35.8,.9,()=>{box(78.6,35.4,0,.4,.4,.75,'#c8352f');dot(78.8,35.6,.95,'#e9e2d8');});
  add(120.6,16.6,0,151.4,47.4,19.9,()=>ctx.drawImage(deC,0,0));add(100,18,0,112,30,TOPZ+3.4,drawTower);
  add(99.6,30.6,0,103.8,32.4,.9,()=>box(99.6,30.6,0,4.2,1.8,.9,C.leaf,.9,.66,1.12));add(99.8,39.6,0,103.6,41,.9,()=>box(99.8,39.6,0,3.8,1.4,.9,C.leaf,.9,.66,1.12));
  for(const [x,y,col] of PARK)add(x-.9,y,0,x+.9,y+4.3,1.5,()=>carY(x,y,0,col),true);
  if(carOut(lift.car)){const c=lift.car;add(LXC-.9,c.y0,0,LXC+.9,c.y0+4.3,1.5,()=>carY(LXC,c.y0,0,lift.col));}
  for(const l of lanes)for(const c of l.cars){const b=vehBox(l,c);add(b[0],b[1],0,b[2],b[3],c.h,()=>drawVeh(l,c,b),true);}
  for(const p of peds){const x=p.x-p.dy*p.o,y=p.y+p.dx*p.o;add(x-.3,y-.3,0,x+.3,y+.3,1.8,()=>drawPed(x,y,p,0),true);}
  const wc=T%4,arm=wc<.8?0:wc<1.4?1:wc<2.8?(FL(wc*6)%2?1:2):wc<3.3?1:0;
  students.forEach((s,i)=>add(s.x-.3,s.y-.3,0,s.x+.3,s.y+.3,1.8,()=>drawPed(s.x,s.y,s,i===2?arm:0)));}
/* ===== 合成与循环 ===== */
let T=0,run=!opts.paused,last=performance.now(),acc=0,raf=0;
const frame=1/(opts.fps||20);
function render(){ctx=g;g.clearRect(0,0,W,H);g.drawImage(bgC,0,0);led(T);items=[];buildItems();
  for(const it of order(items)){if(it.clip){g.save();clipSlab(g);it.fn();g.restore();}else it.fn();}
  present();}
// Transparent ground (the page shows through); whole-pixel scales where the box allows.
function present(){const cw=main.width,ch=main.height;let s=Math.min(cw/W,ch/H);s=s>=1?FL(s):s;
  mg.imageSmoothingEnabled=false;mg.clearRect(0,0,cw,ch);const w=R(W*s),h=R(H*s);mg.drawImage(off,(cw-w)>>1,(ch-h)>>1,w,h);}
function resize(){const d=Math.min(3,window.devicePixelRatio||1);main.width=Math.max(1,R(main.clientWidth*d));main.height=Math.max(1,R(main.clientHeight*d));present();}
function step(dt){T+=dt;sp=(sp+dt)%SIG;stepCars(dt);stepPeds(dt);stepLift(dt);}
ctx=bgC.getContext('2d');drawGround();drawShadows();drawWE();ctx=deC.getContext('2d');drawDE();
const ro=new ResizeObserver(resize);ro.observe(main);resize();render();
// The simulation keeps the artifact's steps (at most 50 ms each); only the drawing is held to `fps`.
function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(run){acc+=dt;if(acc>=frame){while(acc>0){const d=Math.min(.05,acc);step(d);acc-=d;}acc=0;render();}}raf=requestAnimationFrame(loop);}
raf=requestAnimationFrame(loop);
return {
  setPaused(p){run=!p;last=performance.now();acc=0;},
  destroy(){cancelAnimationFrame(raf);ro.disconnect();},
};
}
