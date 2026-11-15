import fs from 'node:fs/promises';
import path from 'node:path';
const { Presentation, PresentationFile } = await import('file:///C:/Users/MSII/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs');

const root = path.resolve('D:/moon/terramatch-main/pitch');
const buildDir = path.join(root, 'build');
const outputDir = path.join(root, 'output');
const draftPath = path.join(buildDir, 'acs-aerotech-draft.pptx');
const previewDir = path.join(buildDir, 'previews');
await fs.mkdir(previewDir, { recursive: true });
await fs.mkdir(outputDir, { recursive: true });

const W = 1280, H = 720;
const C = {
  bg: '#07151C', bg2: '#0B2027', panel: '#102A31', panel2: '#15343A',
  line: '#315259', white: '#F0F6F3', muted: '#A7BCB9', dim: '#77918F',
  mint: '#8FDEC0', lime: '#C6E59A', gold: '#F0C978', blue: '#82B6D5', red: '#E19A7D',
};
const FONT = 'Arial';
const pres = Presentation.create({ slideSize: { width: W, height: H } });

function shape(slide, x, y, w, h, fill='none', geom='rect', lineFill='none', lineWidth=0, name) {
  return slide.shapes.add({
    geometry: geom, name,
    position: { left:x, top:y, width:w, height:h }, fill,
    line: { style:'solid', fill:lineFill, width:lineWidth },
  });
}
function text(slide, str, x, y, w, h, size, color=C.white, opts={}) {
  const s = shape(slide,x,y,w,h,'none','textbox','none',0,opts.name);
  s.text = str;
  s.text.style = { fontFamily:FONT, fontSize:size, color, bold:!!opts.bold,
    alignment:opts.align || 'left', verticalAlignment:opts.valign || 'middle',
    wrap:true, ...(opts.italic?{italic:true}:{}) };
  return s;
}
function line(slide,x,y,w,color=C.line,thick=2){ shape(slide,x,y,w,thick,color); }
function base(slide, section, n) {
  slide.background.fill = C.bg;
  text(slide, 'ACS.AEROTECH', 66, 28, 240, 24, 14, C.mint, {bold:true});
  text(slide, section.toUpperCase(), 844, 30, 365, 22, 11, C.dim, {bold:true,align:'right'});
  line(slide,66,62,1148,C.line,1);
  text(slide, String(n).padStart(2,'0'), 1162, 675, 48, 20, 11, C.dim, {align:'right'});
}
function title(slide, str, subtitle) {
  text(slide,str,66,83,1140,58,39,C.white,{bold:true});
  if (subtitle) text(slide,subtitle,68,143,1090,34,17,C.muted);
}
function notes(slide, txt) { slide.speakerNotes.text = txt; }
function rule(slide,x,y,h,color=C.mint,w=4){ shape(slide,x,y,w,h,color); }

// 1 — Cover
{
  const s = pres.slides.add(); s.background.fill=C.bg;
  shape(s,0,0,735,H,C.bg);
  const imgPath = path.join('D:/moon/terramatch-main/frontend/public/media/lunar-disk.jpg');
  const imgBytes=await fs.readFile(imgPath);
  s.images.add({ blob:imgBytes.buffer.slice(imgBytes.byteOffset,imgBytes.byteOffset+imgBytes.byteLength), contentType:'image/jpeg', alt:'Ảnh Mặt Trăng, NASA Science', fit:'cover', position:{left:735,top:0,width:545,height:720} });
  shape(s,708,0,28,H,C.bg);
  text(s,'NASA SPACE APPS CHALLENGE · 2026',66,75,575,26,14,C.mint,{bold:true});
  text(s,'ACS.AEROTECH',66,158,585,80,48,C.white,{bold:true});
  text(s,'Tìm analog Trái Đất\ncho thử nghiệm LTV',66,258,590,150,39,C.white,{bold:true});
  text(s,'Một bộ khám phá địa điểm theo địa hình, địa chất và nhiệm vụ vận hành xe Mặt Trăng tại South Pole–Aitken Basin.',68,438,520,100,19,C.muted);
  line(s,68,568,498,C.line,2);
  text(s,'BẢN TRÌNH BÀY DỰ ÁN · 3–5 PHÚT',68,592,490,26,13,C.dim,{bold:true});
  text(s,'ACS.AEROTECH  /  2026',68,650,420,22,12,C.mint,{bold:true});
  notes(s,'Mở đầu: ACS.AEROTECH là prototype giúp nhóm khảo sát và so sánh các vùng analog trên Trái Đất cho yêu cầu thử nghiệm LTV ở South Pole–Aitken Basin. Challenge chính thức: https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/ . Ảnh Mặt Trăng: NASA Science, Daily Moon Guide (ảnh được dùng trong giao diện dự án): https://science.nasa.gov/moon/daily-moon-guide/ .');
}

// 2 — Problem
{
  const s=pres.slides.add(); base(s,'Thách thức',2); title(s,'Bài toán analog trên Trái Đất','Từ môi trường Mặt Trăng đến địa điểm có thể thử nghiệm trên thực địa');
  const rows=[
    ['01','Thử nghiệm trước khi bay','Analog missions trên Trái Đất giúp kiểm tra công nghệ, quy trình và cách vận hành trong môi trường tương tự.'],
    ['02','Địa hình quyết định cách chạy thử','Độ dốc, độ nhám, vật liệu bề mặt và ánh sáng ảnh hưởng trực tiếp đến an toàn và hiệu năng xe.'],
    ['03','Một địa điểm không tối ưu cho mọi nhiệm vụ','Lái có phi hành gia, trinh sát tự hành và thử tải bánh xe cần các ưu tiên khác nhau.'],
  ];
  rows.forEach((r,i)=>{
    const y=222+i*124;
    text(s,r[0],70,y,60,42,19,C.mint,{bold:true});
    rule(s,145,y+3,75,i===0?C.mint:C.line,3);
    text(s,r[1],172,y-1,380,34,22,C.white,{bold:true});
    text(s,r[2],560,y-1,625,72,17,C.muted);
    if(i<2) line(s,172,y+92,1010,C.line,1);
  });
  shape(s,66,611,1148,43,C.bg2);
  text(s,'Mục tiêu challenge: tìm và mô tả các vùng analog mới bằng dữ liệu mở của Trái Đất, Mặt Trăng và Sao Hỏa.',82,616,1112,30,16,C.lime,{bold:true});
  notes(s,'NASA mô tả analog missions là các nhiệm vụ thử nghiệm trên Trái Đất để chuẩn bị hệ thống, quy trình và kịch bản trước khi đưa phi hành gia vào không gian. Nguồn: https://www.nasa.gov/analog-missions/ . Challenge yêu cầu sử dụng dữ liệu mở để tìm và mô tả analog mới: https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/ .');
}

// 3 — Mission modes
{
  const s=pres.slides.add(); base(s,'Thiết kế nhiệm vụ',3); title(s,'Ba chế độ LTV, ba bộ ưu tiên','Cùng một vùng mục tiêu; trọng số thay đổi theo mục đích thử nghiệm');
  const cols=[
    {x:68,n:'01',name:'Crewed EVA Traverse',sub:'Phi hành gia điều khiển',accent:C.mint,top:'Độ dốc · Địa chất · Độ nhám',weights:'30%  ·  25%  ·  25%',desc:'Ưu tiên tuyến đi an toàn, bề mặt dễ điều khiển và nền đá gần với mục tiêu.'},
    {x:464,n:'02',name:'Autonomous Scout',sub:'Trinh sát tự hành',accent:C.blue,top:'Albedo · Chân trời · Độ dốc',weights:'25%  ·  20%  ·  20%',desc:'Tăng vai trò điều kiện chiếu sáng và khả năng quan sát để robot tự hành.'},
    {x:860,n:'03',name:'Wheel Torture Test',sub:'Thử tải bánh & hệ treo',accent:C.gold,top:'Độ nhám · Địa chất · Độ dốc',weights:'35%  ·  30%  ·  20%',desc:'Nhấn mạnh bề mặt gồ ghề và vật liệu để đánh giá bánh xe, hệ treo.'},
  ];
  cols.forEach((c,i)=>{
    line(s,c.x,221,350,c.accent,3);
    text(s,c.n,c.x,242,56,34,16,c.accent,{bold:true});
    text(s,c.name,c.x,284,350,38,23,C.white,{bold:true});
    text(s,c.sub,c.x,325,350,27,15,C.dim);
    text(s,c.top,c.x,389,350,30,15,C.muted,{bold:true});
    text(s,c.weights,c.x,424,350,40,25,c.accent,{bold:true});
    line(s,c.x,486,350,C.line,1);
    text(s,c.desc,c.x,509,344,88,16,C.muted);
  });
  shape(s,68,628,1120,1,C.line);
  text(s,'Các trọng số còn lại dành cho sốc nhiệt, phản chiếu bề mặt và che khuất chân trời.',68,641,1060,26,14,C.dim);
  notes(s,'Ba chế độ và trọng số hiển thị lấy từ tài liệu thiết kế kỹ thuật của nhóm. Mỗi cấu hình vẫn có đủ sáu biến đầu vào: slope, roughness/TRI, geology, albedo, thermal shock, horizon occlusion. Chỉ liệt kê ba trọng số ưu tiên lớn nhất để slide dễ trình bày.');
}

// 4 — Scoring
{
  const s=pres.slides.add(); base(s,'Phương pháp',4); title(s,'G-GD biến đặc tính địa hình thành thứ hạng','Bốn bước có thể giải thích và kiểm tra');
  const steps=[
    {x:68,n:'1',head:'Lọc',body:'Loại ứng viên không đạt điều kiện môi trường.',tag:'NDVI · nước · đô thị',color:C.red},
    {x:354,n:'2',head:'Chuẩn hóa',body:'Đổi từng phép đo thành điểm phù hợp Gaussian.',tag:'6 tiêu chí',color:C.blue},
    {x:640,n:'3',head:'Gán trọng số',body:'Kết hợp điểm theo chế độ LTV đã chọn.',tag:'Crewed / Scout / Wheel',color:C.mint},
    {x:926,n:'4',head:'Phạt rủi ro',body:'Giảm điểm nếu tiêu chí trọng yếu yếu hoặc dốc quá lớn.',tag:'bottleneck · >20°',color:C.gold},
  ];
  steps.forEach((p,i)=>{
    shape(s,p.x,236,254,225,C.bg2,'rect',C.line,1);
    text(s,p.n,p.x+18,254,38,36,18,p.color,{bold:true});
    text(s,p.head,p.x+18,305,220,34,23,C.white,{bold:true});
    text(s,p.body,p.x+18,350,218,60,16,C.muted);
    line(s,p.x+18,421,218,p.color,2);
    text(s,p.tag,p.x+18,430,218,24,12,p.color,{bold:true});
    if(i<3){ text(s,'→',p.x+260,319,26,40,27,C.dim,{bold:true,align:'center'}); }
  });
  text(s,'score = weighted fit × weakest critical score^0.25 × rollover penalty',68,500,1120,44,22,C.white,{bold:true,align:'center'});
  text(s,'Đầu ra: điểm tổng, phân rã từng tiêu chí và danh sách vùng cần xem xét tiếp.',68,563,1120,34,17,C.muted,{align:'center'});
  shape(s,68,620,1120,35,C.panel);
  text(s,'Hiện bản mẫu chỉ có NDVI để lọc; LandCover cho nước/đô thị chưa được tích hợp.',84,623,1080,28,14,C.gold,{bold:true,align:'center'});
  notes(s,'Mô tả đúng thuật toán trong frontend/src/spa/scoring.js: Gaussian per-field, weighted total, yếu tố critical bottleneck mũ 0.25, rollover penalty 0.65 nếu slope >20 độ. Trong phiên bản hiện tại ứng viên có cờ isWater/isUrban nhưng nguồn dữ liệu LandCover chưa tích hợp nên không thể xác minh các cờ này trên dữ liệu thực; ghi rõ trên slide. NDVI có trong bộ dữ liệu mẫu.');
}

// 5 — Prototype
{
  const s=pres.slides.add(); base(s,'Bản demo',5); title(s,'Bản demo: khám phá, chọn và kiểm tra','Giao diện SPA Basin analog explorer chạy local');
  // Editable explorer schematic inspired by the live product, not a screenshot.
  shape(s,68,211,692,405,C.bg2,'rect',C.line,1);
  shape(s,68,211,692,42,C.panel);
  text(s,'SPA / EARTH ANALOGS',86,219,340,26,12,C.mint,{bold:true});
  text(s,'H3 resolution 4',555,219,184,26,12,C.dim,{bold:true,align:'right'});
  // Stylized, editable H3-like cells as a schematic, not a geographic map.
  const cells=[
    [126,312,'#163B3F'],[205,278,'#245A54'],[286,311,'#30786B'],[367,278,'#23675F'],[448,311,'#174E4C'],[529,278,'#367E68'],[610,311,'#1C5652'],
    [165,387,'#1C514E'],[246,355,'#39836D'],[327,390,'#245A54'],[408,354,'#4B9876'],[489,391,'#215954'],[570,354,'#37826C'],
  ];
  cells.forEach((c,i)=>{
    const hex=shape(s,c[0],c[1],72,62,c[2],'hexagon',i===3?C.lime:C.line,i===3?3:1);
    if(i===3) text(s,'●',c[0]+22,c[1]+12,28,30,21,C.lime,{align:'center'});
  });
  text(s,'Candidate sites',99,494,180,22,12,C.dim,{bold:true});
  const cand=[['Askja','99%'],['Haughton','97%'],['Lunar Crater','97%'],['Black Point','97%']];
  cand.forEach((r,i)=>{ const x=99+i*150; text(s,String(i+1),x,526,16,20,11,C.dim,{bold:true}); text(s,r[0],x+20,523,110,23,13,C.white,{bold:true}); text(s,r[1],x+20,549,100,23,16,i===0?C.mint:C.blue,{bold:true}); });
  // Right-side capability list
  text(s,'BẢN DEMO ĐANG LÀM ĐƯỢC',806,216,398,28,13,C.mint,{bold:true});
  const feats=[
    ['01','H3 grid + 6 vùng mẫu','Chọn ô ứng viên và xem thông tin địa điểm.'],
    ['02','Ba cấu hình LTV','Thứ hạng đổi theo mục đích chạy thử.'],
    ['03','Giải thích điểm G-GD','Hiển thị thành phần và tiêu chí khớp.'],
    ['04','Mặt cắt 10 km','11 điểm cao độ lấy trực tiếp qua Open-Meteo.'],
  ];
  feats.forEach((f,i)=>{
    const y=270+i*79;
    text(s,f[0],808,y,42,30,14,C.dim,{bold:true});
    text(s,f[1],855,y,335,28,18,C.white,{bold:true});
    text(s,f[2],855,y+30,340,38,14,C.muted);
    if(i<3) line(s,855,y+66,336,C.line,1);
  });
  text(s,'Minh họa giao diện; hình lưới bên trái không phải bản đồ đo đạc.',806,604,390,28,12,C.dim,{italic:true});
  notes(s,'Các mô tả khả năng được đối chiếu trực tiếp từ demo local. G-GD và sáu ứng viên mẫu đến từ tài liệu kỹ thuật của nhóm; bản đồ app dùng lưới ứng viên H3 resolution 4. Mặt cắt lấy 11 elevation points dọc 10 km bằng Copernicus DEM qua Open-Meteo Elevation API (nguồn/ghi nhận trong giao diện: https://open-meteo.com/en/docs/elevation-api). Các ô lưới vẽ trong slide này chỉ là sơ đồ giao diện, không phải vị trí địa lý thật.');
}

// 6 — Results
{
  const s=pres.slides.add(); base(s,'Kết quả demo',6); title(s,'Thứ hạng mẫu thay đổi theo cách dùng xe','Kết quả chạy từ các chỉ số minh họa trong tài liệu kỹ thuật');
  const x0=88, y0=226;
  text(s,'CHẾ ĐỘ',x0,y0,340,25,12,C.dim,{bold:true});
  text(s,'ỨNG VIÊN DẪN ĐẦU',x0+400,y0,390,25,12,C.dim,{bold:true});
  text(s,'ĐIỂM MẪU',x0+850,y0,220,25,12,C.dim,{bold:true,align:'right'});
  const results=[
    ['Crewed EVA Traverse','Askja & Holuhraun · Iceland','99%',C.mint],
    ['Autonomous Scout','Black Point Basin · Arizona','99%',C.blue],
    ['Wheel Torture Test','Askja & Holuhraun · Iceland','100%',C.gold],
  ];
  results.forEach((r,i)=>{
    const y=280+i*93;
    line(s,x0,y-10,1080,C.line,1);
    rule(s,x0,y+5,51,r[3],4);
    text(s,r[0],x0+19,y,340,43,20,C.white,{bold:true});
    text(s,r[1],x0+400,y,395,43,19,C.white);
    text(s,r[2],x0+850,y,220,43,28,r[3],{bold:true,align:'right'});
  });
  line(s,x0,560,1080,C.line,1);
  text(s,'Cách diễn giải',x0,588,200,24,13,C.mint,{bold:true});
  text(s,'Thứ hạng là gợi ý chọn địa điểm để khảo sát sâu hơn; không phải chứng nhận địa điểm phù hợp hay phép đo thực địa.',x0+180,582,880,53,16,C.muted);
  notes(s,'Điểm được tính từ frontend/src/spa/scoring.js và bộ candidate values trong frontend/src/spa/data.js. Hiện demo mặc định: Crewed EVA Traverse đứng đầu Askja 99%; Autonomous Scout đứng đầu Black Point 99%; Wheel Torture Test đứng đầu Askja 100%. Đây là output của dữ liệu minh họa nhóm cung cấp, chưa được xác nhận bằng phép đo hiện trường. Điểm không biểu thị xác suất thành công hay mức độ an toàn được chứng nhận.');
}

// 7 — Roadmap and ask
{
  const s=pres.slides.add(); base(s,'Bước tiếp theo',7); title(s,'Từ prototype đến công cụ nghiên cứu','Ba ưu tiên trước khi dùng thứ hạng để chọn điểm thử nghiệm thật');
  const roadmap=[
    ['01','Thay dữ liệu mẫu','Tích hợp và ghi nguồn/độ phân giải cho địa hình, vật liệu, albedo, nhiệt, LandCover.'],
    ['02','Kiểm chứng tiêu chí','Đối chiếu ngưỡng G-GD với địa điểm analog đã khảo sát và ý kiến chuyên gia LTV.'],
    ['03','Mở rộng tìm kiếm','Quét ô lưới lớn hơn, tính cửa sổ mùa vụ theo từng vùng và kiểm tra tuyến di chuyển.'],
  ];
  roadmap.forEach((r,i)=>{
    const y=222+i*96;
    text(s,r[0],70,y,54,33,16,C.mint,{bold:true});
    text(s,r[1],143,y,290,34,21,C.white,{bold:true});
    text(s,r[2],442,y-1,720,56,16,C.muted);
    if(i<2) line(s,143,y+68,1017,C.line,1);
  });
  shape(s,68,532,1120,103,C.panel);
  text(s,'THÔNG ĐIỆP KẾT',92,549,160,24,12,C.lime,{bold:true});
  text(s,'ACS.AEROTECH giúp thu hẹp danh sách analog và giải thích vì sao một nơi phù hợp với một bài thử LTV cụ thể.',92,579,1040,38,20,C.white,{bold:true});
  text(s,'Bước tiếp theo của nhóm: xác thực dữ liệu và tiêu chí cùng chuyên gia địa chất, robot và vận hành.',92,641,1020,24,14,C.dim);
  notes(s,'Lộ trình dựa trên các phần còn thiếu đã thể hiện trong prototype và tài liệu thiết kế. NASA POWER, SoilGrids, Macrostrat và LandCover không được tuyên bố là đã tích hợp trong bản demo hiện tại. Kết thúc bằng lời mời phản biện về tiêu chí analog, nguồn dữ liệu và phương pháp validation.');
}

for (let i=0;i<pres.slides.items.length;i++) {
  const slide=pres.slides.items[i];
  const png=await pres.export({slide,format:'png',scale:1});
  await fs.writeFile(path.join(previewDir,`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await png.arrayBuffer()));
}
const montage=await pres.export({format:'webp',montage:true,scale:0.55});
await fs.writeFile(path.join(previewDir,'montage.webp'),new Uint8Array(await montage.arrayBuffer()));
const pptx=await PresentationFile.exportPptx(pres);
await pptx.save(draftPath);
console.log(JSON.stringify({draftPath,slides:pres.slides.items.length,previewDir}));
