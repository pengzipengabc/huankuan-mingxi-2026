"use strict";
const $ = id => document.getElementById(id);
const currency = n => new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY'}).format(n);
const cents = n => Math.round(Number(n)*100);
const credited = r => Math.round(cents(r.raw)*Math.round(r.factor*1000)/1000);
const escapeHTML = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let database, entries=[], photos=[], ascending=false, busy=false;
const today = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
function requestResult(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function transactionDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('操作已取消'));});}
async function openDatabase(){
 const req=indexedDB.open('huankuan-ledger',1);
 req.onupgradeneeded=()=>{req.result.createObjectStore('records',{keyPath:'id'});req.result.createObjectStore('meta');};
 database=await requestResult(req);
 database.onversionchange=()=>{database.close();$('status').textContent='账本已在其他页面更新，请刷新。';};
 const tx=database.transaction(['records','meta'],'readwrite'),done=transactionDone(tx);
 const check=tx.objectStore('meta').get('seeded');
 check.onsuccess=()=>{if(!check.result){records.forEach(r=>tx.objectStore('records').put({id:`seed-${r.id}`,kind:'repayment',date:r.date,raw:r.raw,factor:r.factor,method:r.method,party:'',note:r.note,photos:[],updatedAt:new Date().toISOString()}));tx.objectStore('meta').put(true,'seeded');}};
 await done;await refresh();
 $('status').textContent='账本已打开 · 保存后自动保留，请定期完整备份。';
 navigator.storage?.persist?.().catch(()=>{});
}
async function refresh(){entries=await requestResult(database.transaction('records').objectStore('records').getAll());renderEntries();}
async function storeRecord(r){const tx=database.transaction('records','readwrite'),done=transactionDone(tx);tx.objectStore('records').put(r);await done;}
function renderEntries(){
 const pay=entries.filter(r=>r.kind==='repayment'),delivery=entries.filter(r=>r.kind==='delivery');
 const paid=pay.reduce((s,r)=>s+credited(r),0),sent=delivery.reduce((s,r)=>s+credited(r),0);
 $('paid').textContent=currency(paid/100);$('rawPaid').textContent=`${pay.length} 笔 · 原始金额 ${currency(pay.reduce((s,r)=>s+cents(r.raw),0)/100)}`;
 $('delivered').textContent=currency(sent/100);$('deliveryCount').textContent=`${delivery.length} 笔送货记录`;$('balance').textContent=currency((sent-paid)/100);
 const query=$('query').value.trim().toLowerCase(),kind=$('kindFilter').value;
 const visible=entries.filter(r=>(kind==='all'||r.kind===kind)&&`${r.date} ${r.party} ${r.note} ${r.method}`.toLowerCase().includes(query)).sort((a,b)=>(ascending?1:-1)*a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 $('count').textContent=`显示 ${visible.length} 笔 · 送货与还款分别记账`;
 $('entries').innerHTML=visible.length?visible.map(r=>`<article class="entry"><div class="entry-top"><div><strong>${escapeHTML(r.date)}</strong> <span class="method-badge">${r.kind==='repayment'?'还款':'送货'}</span><p>${escapeHTML(r.party||'未填写往来单位')}</p></div><strong>${currency(credited(r)/100)}</strong></div><small>原金额 ${currency(r.raw)} × ${r.factor.toFixed(3)} · ${escapeHTML(r.method)}</small>${r.note?`<p>${escapeHTML(r.note)}</p>`:''}<div class="entry-bottom"><small>${r.photos.length} 张单据照片</small><div class="entry-actions">${r.photos.length?`<button type="button" data-photos="${escapeHTML(r.id)}">查看照片</button>`:''}<button type="button" data-edit="${escapeHTML(r.id)}">编辑</button></div></div></article>`).join(''):'<p class="empty-state">没有匹配的记录，点击「记一笔」开始。</p>';
}
function calculate(){const amount=Number($('amount').value),factor=Number($('factor').value);$('calculation').textContent=`计入金额：${currency(Math.round(cents(amount)*Math.round(factor*1000)/1000)/100)}（逐笔四舍五入到分）`;}
function openEditor(r){
 if(!database)return;
 $('recordForm').reset();$('recordId').value=r?.id||'';$('formTitle').textContent=r?'编辑记录':'新增记录';$('date').value=r?`${r.date.slice(0,4)}-${r.date.slice(4,6)}-${r.date.slice(6,8)}`:today();
 $('kind').value=r?.kind||'repayment';$('party').value=r?.party||'';$('amount').value=r?.raw||'';$('factor').value=r?.factor??1;$('method').value=r?.method||'微信';$('note').value=r?.note||'';photos=r?.photos.map(p=>({...p}))||[];
 $('factor').disabled=$('kind').value==='delivery';$('deleteRecord').hidden=!r;$('formError').textContent='';renderPhotos();calculate();$('editor').showModal();
}
function renderPhotos(){ $('photoList').innerHTML=photos.map((p,i)=>`<div class="photo-item"><button type="button" data-view-photo="${i}" aria-label="放大第 ${i+1} 张照片"><img src="${p.data}" alt="单据 ${i+1}"></button><button type="button" data-remove-photo="${i}">移除</button></div>`).join(''); }
function showPhoto(data){$('fullPhoto').src=data;$('photoViewer').showModal();}
async function compressPhoto(file){
 if(file.size>15*1024*1024)throw new Error('照片超过 15 MB，请选择较小的照片。');
 const url=URL.createObjectURL(file);
 try{const img=new Image();img.src=url;await img.decode();const scale=Math.min(1,1800/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return {name:file.name.slice(0,200),data:canvas.toDataURL('image/jpeg',.82)};}catch{throw new Error('无法读取照片，请选择 JPG 或 PNG 格式后重试。');}finally{URL.revokeObjectURL(url);}
}
function setBusy(value){busy=value;$('save').disabled=value;$('close').disabled=value;$('deleteRecord').disabled=value;$('photos').disabled=value;}
function fail(error){$('formError').textContent=error?.name==='QuotaExceededError'?'手机存储空间不足，本次未保存。请先导出备份并释放空间。':error.message||'保存失败，请重试。';}
function validDate(d){if(!/^\d{8}$/.test(d))return false;const iso=`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`,dt=new Date(iso+'T12:00:00Z');return !isNaN(dt)&&dt.toISOString().slice(0,10)===iso;}
function validateRecord(r){
 if(!r||typeof r.id!=='string'||r.id.length>100||!['repayment','delivery'].includes(r.kind)||!validDate(r.date)||!Number.isFinite(r.raw)||r.raw<=0||r.raw>999999999||!Number.isFinite(r.factor)||r.factor<=0||r.factor>1||!['微信','公账','现金','支付宝','未注明'].includes(r.method)||typeof r.party!=='string'||r.party.length>100||typeof r.note!=='string'||r.note.length>2000||!Array.isArray(r.photos)||r.photos.length>8)throw new Error('记录格式或金额不正确。');
 if(r.kind==='delivery'&&r.factor!==1)throw new Error('送货记录系数须为 1。');
 r.photos.forEach(p=>{if(!p||typeof p.name!=='string'||typeof p.data!=='string'||p.data.length>8000000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.data))throw new Error('备份中的照片格式不正确。');});
 return {id:r.id,kind:r.kind,date:r.date,raw:cents(r.raw)/100,factor:Math.round(r.factor*1000)/1000,method:r.method,party:r.party,note:r.note,photos:r.photos.map(p=>({name:p.name.slice(0,200),data:p.data})),updatedAt:new Date().toISOString()};
}
$('recordForm').addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;setBusy(true);$('formError').textContent='';
 try{const r=validateRecord({id:$('recordId').value||crypto.randomUUID(),kind:$('kind').value,date:$('date').value.replaceAll('-',''),raw:Number($('amount').value),factor:$('kind').value==='delivery'?1:Number($('factor').value),method:$('method').value,party:$('party').value.trim(),note:$('note').value.trim(),photos});
 if(!entries.some(x=>x.id===r.id)&&entries.some(x=>x.date===r.date&&x.kind===r.kind&&x.raw===r.raw&&x.party===r.party)&&!confirm('已有同日期、同金额、同单位的记录，确定再记一笔？'))return;
 await storeRecord(r);await refresh();$('editor').close();$('status').textContent='已保存到当前浏览器。建议现在导出完整备份。';}catch(err){fail(err);}finally{setBusy(false);}
});
$('photos').addEventListener('change',async e=>{if(busy)return;setBusy(true);$('formError').textContent='';try{const files=[...e.target.files];if(photos.length+files.length>8)throw new Error('每笔最多保存 8 张照片。');const added=[];for(const file of files)added.push(await compressPhoto(file));photos.push(...added);renderPhotos();}catch(err){fail(err);}finally{e.target.value='';setBusy(false);}});
$('photoList').addEventListener('click',e=>{if(busy)return;const v=e.target.closest('[data-view-photo]'),r=e.target.closest('[data-remove-photo]');if(v)showPhoto(photos[Number(v.dataset.viewPhoto)].data);if(r){photos.splice(Number(r.dataset.removePhoto),1);renderPhotos();}});
$('entries').addEventListener('click',e=>{const b=e.target.closest('[data-edit],[data-photos]');if(!b)return;const r=entries.find(x=>x.id===(b.dataset.edit||b.dataset.photos));openEditor(r);if(b.dataset.photos)$('photoList').scrollIntoView({block:'nearest'});});
$('newRecord').onclick=()=>openEditor();$('close').onclick=()=>{if(!busy&&confirm('关闭后未保存的修改会丢失，确定关闭？'))$('editor').close();};$('editor').addEventListener('cancel',e=>{e.preventDefault();$('close').click();});$('closePhoto').onclick=()=>$('photoViewer').close();
$('amount').oninput=calculate;$('factor').oninput=calculate;
$('method').onchange=()=>{if($('kind').value==='repayment'){$('factor').value=$('method').value==='公账'?.915:1;calculate();}};
$('kind').onchange=()=>{$('factor').disabled=$('kind').value==='delivery';if($('kind').value==='delivery')$('factor').value=1;calculate();};
$('deleteRecord').onclick=async()=>{if(busy||!confirm('确定删除这笔记录及其照片？请先确保已有完整备份。'))return;setBusy(true);try{const tx=database.transaction('records','readwrite'),done=transactionDone(tx);tx.objectStore('records').delete($('recordId').value);await done;await refresh();$('editor').close();$('status').textContent='已删除记录。';}catch(err){fail(err);}finally{setBusy(false);}};
$('query').oninput=renderEntries;$('kindFilter').onchange=renderEntries;$('sort').onclick=()=>{ascending=!ascending;$('sort').textContent=ascending?'日期正序 ↑':'日期倒序 ↓';renderEntries();};
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
$('backup').onclick=async()=>{if(!database)return;await refresh();download(new Blob([JSON.stringify({format:'huankuan-ledger',version:1,exportedAt:new Date().toISOString(),records:entries})],{type:'application/json'}),`货款账本完整备份-${today()}.json`);$('status').textContent='已生成完整备份，请在 Safari 下载项中确认并保存至「文件」。';};
$('exportCSV').onclick=()=>{if(!database)return;const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';const rows=[['日期','类型','往来单位','原始金额','系数','计入金额','方式','备注','照片数'],...entries.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(r=>[r.date,r.kind==='repayment'?'还款':'送货',r.party,r.raw.toFixed(2),r.factor.toFixed(3),(credited(r)/100).toFixed(2),r.method,r.note,r.photos.length])];download(new Blob(['\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),`货款账本-${today()}.csv`);};
$('restore').onchange=async e=>{const file=e.target.files[0];if(!file||!database)return;try{if(file.size>150*1024*1024)throw new Error('备份超过 150 MB，无法导入。');const data=JSON.parse(await file.text());if(data.format!=='huankuan-ledger'||data.version!==1||!Array.isArray(data.records)||data.records.length>10000)throw new Error('不是本账本支持的备份文件。');const rows=data.records.map(validateRecord);if(new Set(rows.map(r=>r.id)).size!==rows.length)throw new Error('备份中存在重复记录编号。');if(!confirm(`将合并 ${rows.length} 笔记录，同编号记录会被备份覆盖。其他现有记录保留，是否继续？`))return;const tx=database.transaction('records','readwrite'),done=transactionDone(tx);rows.forEach(r=>tx.objectStore('records').put(r));await done;await refresh();$('status').textContent=`已恢复 ${rows.length} 笔记录及照片。`;}catch(err){$('status').textContent=`恢复失败，现有账本未改变：${err.message}`;}finally{e.target.value='';}};
openDatabase().catch(err=>{$('status').textContent=`无法打开本地存储，请使用普通 Safari 标签页，并允许保存网站数据。${err.message}`;$('newRecord').disabled=true;});
