document.getElementById("year").textContent=new Date().getFullYear();
const $=id=>document.getElementById(id),setupPanel=$("setupPanel"),loginPanel=$("loginPanel"),dashboardPanel=$("dashboardPanel"),message=$("adminMessage");
let events=[],selectedEvent=null;
function say(value,isError=false){message.textContent=value;message.classList.toggle("is-error",isError);}
async function api(path,options={}){
  const response=await fetch(path,{credentials:"same-origin",...options,headers:{"content-type":"application/json",...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));if(!response.ok||!data.success)throw new Error(data.error||"Request failed.");return data;
}
async function initialize(){
  try{const data=await api("/api/admin/me",{method:"GET"});showDashboard(data.admin);}
  catch{
    try{const data=await api("/api/admin/bootstrap-status",{method:"GET"});setupPanel.hidden=!data.needsBootstrap;loginPanel.hidden=data.needsBootstrap;}
    catch(err){setupPanel.hidden=true;loginPanel.hidden=false;say(err.message,true);}
  }
}
function showDashboard(admin){setupPanel.hidden=true;loginPanel.hidden=true;dashboardPanel.hidden=false;$("welcomeName").textContent="Welcome, "+admin.name;loadEvents();}
async function loadEvents(){
  try{
    const data=await api("/api/admin/events",{method:"GET"});events=data.events||[];const list=$("eventList"),select=$("uploadEvent");list.replaceChildren();select.replaceChildren();
    events.filter(event=>event.status==="active").forEach(event=>{
      const option=document.createElement("option");option.value=event.id;option.textContent=event.event_name+" ("+event.event_code+")";select.append(option);
      const card=document.createElement("article");card.className="event-row";const details=document.createElement("div"),title=document.createElement("strong"),sub=document.createElement("small");
      title.textContent=event.event_name;sub.textContent=event.event_type+" • "+event.event_code+" • "+(event.photo_count||0)+" uploads";details.append(title,sub);
      const open=document.createElement("button");open.type="button";open.textContent="Manage";open.addEventListener("click",()=>selectEvent(event.id));card.append(details,open);list.append(card);
    });
    if(!events.length)list.textContent="No events yet. Create your first event above.";
    if(select.value)await loadAlbums(Number(select.value));
  }catch(err){say(err.message,true);}
}
async function loadAlbums(eventId){
  const select=$("uploadAlbum");select.replaceChildren();const first=document.createElement("option");first.value="";first.textContent="No album";select.append(first);
  try{const data=await api("/api/admin/albums?eventId="+eventId,{method:"GET"});(data.albums||[]).forEach(album=>{const option=document.createElement("option");option.value=album.id;option.textContent=album.album_name;select.append(option);});}
  catch(err){say(err.message,true);}
}
async function selectEvent(id){
  selectedEvent=events.find(event=>Number(event.id)===Number(id));if(!selectedEvent)return;
  $("eventTools").hidden=false;$("selectedEventName").textContent=selectedEvent.event_name;$("selectedEventCode").textContent="Event code: "+selectedEvent.event_code;
  $("editEventName").value=selectedEvent.event_name||"";$("editEventDate").value=selectedEvent.event_date||"";$("editEventVenue").value=selectedEvent.venue||"";
  const url=new URL(location.origin+"/");url.searchParams.set("event",selectedEvent.event_code);$("guestLink").href=url.href;
  $("qrCode").replaceChildren();
  if(window.QRCode)new QRCode($("qrCode"),{text:url.href,width:220,height:220,correctLevel:QRCode.CorrectLevel.H});
  else $("qrCode").textContent="QR library did not load. Check internet access and refresh.";
  await loadMedia(selectedEvent.id);await loadAlbums(selectedEvent.id);$("uploadEvent").value=String(selectedEvent.id);
}
async function loadMedia(eventId){
  try{
    const data=await api("/api/admin/media?eventId="+eventId,{method:"GET"}),wrap=$("mediaList");wrap.replaceChildren();
    (data.photos||[]).forEach(photo=>{
      const item=document.createElement("div");item.className="media-item";
      if(photo.resource_type==="video"){const video=document.createElement("video");video.src=photo.secure_url;video.controls=true;video.preload="metadata";item.append(video);}
      else{const image=document.createElement("img");image.src=photo.secure_url;image.alt=photo.file_name||"Uploaded photograph";image.loading="lazy";item.append(image);}
      const name=document.createElement("small");name.textContent=photo.file_name||"Media";item.append(name);wrap.append(item);
    });
    if(!data.photos?.length)wrap.textContent="No media uploaded for this event yet.";
  }catch(err){say(err.message,true);}
}
async function uploadOne(file,eventId,albumId,progress){
  const resourceType=file.type.startsWith("video/")?"video":"image";
  const signed=await api("/api/admin/uploads/sign",{method:"POST",body:JSON.stringify({eventId,resourceType,fileName:file.name,contentType:file.type,fileSize:file.size})});
  const formData=new FormData();formData.append("file",file);formData.append("api_key",signed.apiKey);formData.append("timestamp",String(signed.timestamp));
  formData.append("folder",signed.folder);if(signed.uploadPreset)formData.append("upload_preset",signed.uploadPreset);formData.append("signature",signed.signature);
  const uploaded=await new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open("POST",signed.uploadUrl);xhr.timeout=180000;
    xhr.upload.onprogress=event=>{if(event.lengthComputable)progress(Math.round(event.loaded/event.total*100));};
    xhr.onload=()=>{
      let result={};try{result=JSON.parse(xhr.responseText);}catch{}
      if(xhr.status>=200&&xhr.status<300&&result.public_id&&result.secure_url)resolve(result);
      else {
        const headerError=xhr.getResponseHeader("X-Cld-Error");
        const detail=result.error?.message||headerError||("Cloudinary returned HTTP "+xhr.status+".");
        reject(new Error(detail));
      }
    };
    xhr.onerror=()=>reject(new Error("Network/CORS error connecting to Cloudinary. Check browser internet connection and Cloudinary upload endpoint."));
    xhr.ontimeout=()=>reject(new Error("Upload timed out after 3 minutes. Try one smaller JPG file."));
    xhr.onabort=()=>reject(new Error("Upload was cancelled."));
    xhr.send(formData);
  });
  progress(100);
  await api("/api/admin/media",{method:"POST",body:JSON.stringify({eventId,albumId:albumId||null,publicId:uploaded.public_id,secureUrl:uploaded.secure_url,fileName:file.name,contentType:file.type,fileSize:file.size,resourceType:uploaded.resource_type||resourceType,width:uploaded.width,height:uploaded.height,format:uploaded.format,duration:uploaded.duration})});
}
$("bootstrapForm").addEventListener("submit",async event=>{
  event.preventDefault();say("Creating the first admin account…");
  try{const data=await api("/api/admin/bootstrap",{method:"POST",body:JSON.stringify({bootstrapKey:$("bootstrapKey").value,name:$("adminName").value,email:$("adminEmail").value,password:$("adminPassword").value})});say(data.message);setupPanel.hidden=true;loginPanel.hidden=false;}
  catch(err){say(err.message,true);}
});
$("loginForm").addEventListener("submit",async event=>{
  event.preventDefault();say("Signing in…");
  try{const data=await api("/api/admin/login",{method:"POST",body:JSON.stringify({email:$("loginEmail").value,password:$("loginPassword").value})});showDashboard(data.admin);say("Signed in successfully.");}
  catch(err){say(err.message,true);}
});
$("logoutButton").addEventListener("click",async()=>{
  try{await api("/api/admin/logout",{method:"POST",body:"{}"});}catch{}
  dashboardPanel.hidden=true;loginPanel.hidden=false;say("You are signed out.");
});
$("eventCreateForm").addEventListener("submit",async event=>{
  event.preventDefault();
  try{
    const data=await api("/api/admin/events",{method:"POST",body:JSON.stringify({eventName:$("newEventName").value,eventType:$("newEventType").value,eventDate:$("newEventDate").value,venue:$("newEventVenue").value})});
    say("Event created. Code: "+data.event.eventCode);event.target.reset();await loadEvents();const created=events.find(item=>item.event_code===data.event.eventCode);if(created)await selectEvent(created.id);
  }catch(err){say(err.message,true);}
});
$("eventEditForm").addEventListener("submit",async event=>{
  event.preventDefault();if(!selectedEvent)return say("Choose an event first.",true);
  try{
    await api("/api/admin/events/"+selectedEvent.id,{method:"PATCH",body:JSON.stringify({eventName:$("editEventName").value,eventDate:$("editEventDate").value,venue:$("editEventVenue").value})});
    say("Event details updated.");await loadEvents();await selectEvent(selectedEvent.id);
  }catch(err){say(err.message,true);}
});
$("uploadEvent").addEventListener("change",event=>loadAlbums(Number(event.target.value)));
$("uploadForm").addEventListener("submit",async event=>{
  event.preventDefault();const files=Array.from($("mediaFiles").files||[]),eventId=Number($("uploadEvent").value),albumId=$("uploadAlbum").value?Number($("uploadAlbum").value):null;
  if(!files.length||!eventId)return say("Choose an event and at least one file.",true);
  const progress=$("uploadProgress");progress.value=0;let complete=0,failed=0;
  for(const file of files){
    try{
      say("Preparing secure upload for "+file.name+"…");
      await uploadOne(file,eventId,albumId,percent=>{
        progress.value=Math.round((complete+percent/100)/files.length*100);
        say("Uploading "+file.name+"… "+percent+"%");
      });
      complete++;
      progress.value=Math.round(complete/files.length*100);
      say("Saved "+file.name+" to the event gallery.");
    }catch(err){
      failed++;
      say(file.name+": "+err.message,true);
    }
  }
  if(failed===0)say("Upload finished: "+complete+" of "+files.length+" file(s) saved.");
  else say("Upload finished with "+complete+" saved and "+failed+" failed. Read the error above.",true);
  await loadMedia(eventId);await loadEvents();$("mediaFiles").value="";
});
$("albumForm").addEventListener("submit",async event=>{
  event.preventDefault();if(!selectedEvent)return say("Choose an event first.",true);
  try{const data=await api("/api/admin/albums",{method:"POST",body:JSON.stringify({eventId:selectedEvent.id,albumName:$("albumName").value})});$("albumName").value="";await loadAlbums(selectedEvent.id);say("Album "+data.album.album_name+" created.");}
  catch(err){say(err.message,true);}
});
$("archiveEvent").addEventListener("click",async()=>{
  if(!selectedEvent||!confirm("Archive this event? Its media will be preserved, but guests can no longer open the gallery."))return;
  try{await api("/api/admin/events/"+selectedEvent.id,{method:"DELETE"});$("eventTools").hidden=true;selectedEvent=null;say("Event archived. Existing media was preserved.");await loadEvents();}
  catch(err){say(err.message,true);}
});
$("downloadQr").addEventListener("click",()=>{
  const canvas=$("qrCode").querySelector("canvas"),image=$("qrCode").querySelector("img"),url=canvas?canvas.toDataURL("image/png"):image?.src;
  if(!url)return say("QR code is not ready.",true);
  const link=document.createElement("a");link.href=url;link.download=(selectedEvent?.event_code||"event")+"-QR.png";link.click();
});
$("printQr").addEventListener("click",()=>{
  const canvas=$("qrCode").querySelector("canvas"),image=$("qrCode").querySelector("img"),src=canvas?canvas.toDataURL("image/png"):image?.src;
  if(!src||!selectedEvent)return say("QR code is not ready.",true);
  const win=window.open("","_blank","width=600,height=750");
  if(!win)return say("Allow pop-ups to print the QR card.",true);
  const title=selectedEvent.event_name.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const code=selectedEvent.event_code;
  win.document.write("<!doctype html><html><head><title>Event QR</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:48px;color:#172033}h1{font-family:Georgia,serif;font-weight:400}img{width:300px;height:300px;object-fit:contain;margin:30px auto}p{color:#687386;letter-spacing:2px}@media print{button{display:none}}</style></head><body><p>RAMESH PHOTOGRAPHY</p><h1>"+title+"</h1><img src='"+src+"' alt='Event QR code'><h2>"+code+"</h2><p>SCAN TO VIEW & DOWNLOAD PHOTOS</p><button onclick='window.print()'>Print</button></body></html>");
  win.document.close();
});
initialize();
