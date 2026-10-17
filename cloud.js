/* Uses only the browser-safe publishable key. Access is enforced by database and Storage RLS. */
(() => {
 const config={url:'https://rdqbxqxggeerrcerapjr.supabase.co',key:'sb_publishable_avoQ07ncfRED4QYYEGOkuw_avP3HDvP'};
 const el=id=>document.getElementById(id);
 if(!window.supabase){el('cloudStatus').textContent='云端组件加载失败，本机账本仍可使用。';return;}
 const client=window.supabase.createClient(config.url,config.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 let user=null,operation=false;
 const bucket=client.storage.from('ledger-photos');
 const assertSession=()=>{if(!user)throw new Error('请先登录云端账号。');return user.id;};
 const friendly=error=>{const msg=error?.message||'连接失败';if(/invalid login credentials/i.test(msg))return '邮箱或密码不正确。';if(/email not confirmed/i.test(msg))return '请先在邮箱中点击确认链接。';if(/failed to fetch|network/i.test(msg))return '网络连接失败，请稍后重试。';if(/schema cache|does not exist/i.test(msg))return '云端数据表尚未配置完成。';return msg;};
 function unwrap(result){if(result.error)throw new Error(friendly(result.error));return result.data;}
 async function blobData(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});}
 window.cloudLedger={
  async list(){const uid=assertSession(),rows=[];for(let start=0;;start+=500){const data=unwrap(await client.from('ledger_records').select('id,payload,version').eq('owner_id',uid).eq('deleted',false).order('id').range(start,start+499));if(user?.id!==uid)throw new Error('登录状态已改变，请刷新。');rows.push(...data.map(r=>({...r.payload,id:r.id,_version:r.version})));if(data.length<500)break;}return rows;},
  async withPhotos(record){const uid=assertSession(),loaded=[];for(const p of record.photos){if(p.data){loaded.push({...p});continue;}if(!p.path?.startsWith(uid+'/'))throw new Error('照片访问权限不匹配。');const blob=unwrap(await bucket.download(p.path));loaded.push({name:p.name,path:p.path,data:await blobData(blob)});}return {...record,photos:loaded};},
  async save(record,expectedVersion,revive=false){const uid=assertSession(),stored=[];for(const p of record.photos){if(p.path?.startsWith(uid+'/')){stored.push({name:p.name,path:p.path});continue;}const blob=await(await fetch(p.data)).blob();const path=`${uid}/${crypto.randomUUID()}.${blob.type==='image/png'?'png':blob.type==='image/webp'?'webp':'jpg'}`;unwrap(await bucket.upload(path,blob,{contentType:blob.type,upsert:false}));stored.push({name:p.name,path});}
   if(user?.id!==uid)throw new Error('登录状态已改变，未保存账目。');
   const payload={...record,photos:stored};delete payload._version;
   if(expectedVersion==null){unwrap(await client.from('ledger_records').insert({owner_id:uid,id:record.id,payload}));}
   else{const updated=unwrap(await client.from('ledger_records').update({payload,deleted:false}).eq('owner_id',uid).eq('id',record.id).eq('version',expectedVersion).eq('deleted',revive).select('version'));if(!updated.length)throw new Error('另一台设备已修改此记录，本次没有覆盖。请关闭编辑、刷新账目后重试。');}
  },
  async remove(id,version){const uid=assertSession();const changed=unwrap(await client.from('ledger_records').update({deleted:true}).eq('owner_id',uid).eq('id',id).eq('version',version).eq('deleted',false).select('version'));if(!changed.length)throw new Error('记录已在其他设备修改，请刷新后重试。');},
  async importRecords(records){const uid=assertSession();let count=0;for(const r of records){const existing=unwrap(await client.from('ledger_records').select('id,deleted,version').eq('owner_id',uid).eq('id',r.id));if(existing.length&&!existing[0].deleted)continue;await this.save(r,existing[0]?.version??null,!!existing[0]?.deleted);count++;}return count;}
 };
 function updateUI(){el('accountEmail').textContent=user?.email||'';el('cloudActions').hidden=!user;el('cloudLogin').hidden=!!user;el('cloudStatus').textContent=user?'已登录，可使用云端账本。':'登录后可跨手机同步，未登录时仅使用本机账本。';el('storageNote').textContent=window.ledgerBridge.mode?'当前：云端账本。账目和照片按登录账号保存，其他设备登录同一账号后点击「刷新账目」。照片仍需手动核对金额。':'当前：本机账本。记录只在这个浏览器中保存；可登录后点击「导入本机账本到云端」。请定期完整备份。';}
 async function action(fn){if(operation||window.ledgerBridge.busy)return;operation=true;const buttons=[...el('cloudPanel').querySelectorAll('button'),...el('authForm').querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);try{await fn();}catch(error){el('cloudStatus').textContent=friendly(error);if(el('authDialog').open)el('authMessage').textContent=friendly(error);}finally{operation=false;buttons.forEach(b=>b.disabled=false);}}
 el('authForm').onsubmit=e=>{e.preventDefault();action(async()=>{unwrap(await client.auth.signInWithPassword({email:el('email').value.trim(),password:el('password').value}));el('password').value='';el('authDialog').close();});};
 el('registerAccount').onclick=()=>{if(!el('authForm').reportValidity())return;action(async()=>{const data=unwrap(await client.auth.signUp({email:el('email').value.trim(),password:el('password').value,options:{emailRedirectTo:'https://pengzipengabc.github.io/huankuan-mingxi-2026/'}}));el('password').value='';el('authMessage').textContent=data.session?'账号已创建，正在登录。':'请查看邮箱并点击确认链接，然后回到这里登录。';});};
 el('cloudLogin').onclick=()=>{el('authMessage').textContent='首次使用请注册账本账号，与 Supabase 控制台登录独立。';el('authDialog').showModal();};el('closeAuth').onclick=()=>{el('password').value='';el('authDialog').close();};
 el('useCloud').onclick=()=>action(async()=>{await window.ledgerBridge.setMode(true);updateUI();});
 el('useLocal').onclick=()=>action(async()=>{await window.ledgerBridge.setMode(false);updateUI();});
 el('refreshCloud').onclick=()=>action(async()=>{await window.ledgerBridge.refresh();el('cloudStatus').textContent='已刷新当前账本。';});
 el('importLocal').onclick=()=>action(async()=>{const rows=await window.ledgerBridge.localRecords();if(!confirm(`将本机 ${rows.length} 笔记录及照片上传到当前账号，同编号记录不覆盖。是否继续？`))return;el('cloudStatus').textContent='正在导入，请保持页面打开…';const count=await window.cloudLedger.importRecords(rows);await window.ledgerBridge.setMode(true);updateUI();el('cloudStatus').textContent=`已导入 ${count} 笔新记录；同编号记录已跳过。`;});
 el('signOut').onclick=()=>action(async()=>{unwrap(await client.auth.signOut({scope:'local'}));});
 let generation=0;
 client.auth.onAuthStateChange((event,session)=>{const gen=++generation;setTimeout(async()=>{if(gen!==generation)return;await window.ledgerReady;const previous=user?.id;user=session?.user||null;updateUI();if(!user&&window.ledgerBridge.mode){if(el('editor').open)el('editor').close();await window.ledgerBridge.setMode(false);updateUI();}else if(user&&previous!==user.id){try{await window.ledgerBridge.setMode(true);updateUI();}catch(err){el('cloudStatus').textContent=friendly(err);}}},0);});
 window.ledgerReady.then(updateUI);
})();
