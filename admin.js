document.getElementById("year").textContent=new Date().getFullYear();
const $=id=>document.getElementById(id),setupPanel=$("setupPanel"),loginPanel=$("loginPanel"),dashboardPanel=$("dashboardPanel"),message=$("adminMessage");
let events=[],selectedEvent=null;
function say(value,isError=false){message.textContent=value;message.classList.toggle("is-error",isError);}
async function api(path,options={}){
  const response=await fetch(path,{credentials:"same-origin",...options,headers:{"content-type":"application/json",...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));if(!response.ok||!data.success)throw new Error(data.error||"Request failed.");return data;
}
async function initialize(){
  const query=new URLSearchParams(location.search);
  const oauthConnected=query.get("github")==="connected";
  const oauthError=query.get("oauth_error");
  if(oauthConnected||oauthError)history.replaceState({}, "", location.pathname);
  try{
    const data=await api("/api/admin/me",{method:"GET"});
    showDashboard(data.admin);
    if(oauthConnected)say("Signed in with your approved GitHub account.");
  }catch{
    try{
      const data=await api("/api/admin/bootstrap-status",{method:"GET"});
      const oauthEnabled=Boolean(data.githubOAuthConfigured);
      const oauthMisconfigured=Boolean(data.githubOAuthMisconfigured);
      setupPanel.hidden=oauthEnabled||oauthMisconfigured||!data.needsBootstrap;
      loginPanel.hidden=oauthEnabled||oauthMisconfigured?false:data.needsBootstrap;
      $("githubLoginButton").hidden=!oauthEnabled;
      $("githubLoginHint").hidden=!oauthEnabled;
      $("loginForm").hidden=oauthEnabled||oauthMisconfigured;
      if(oauthEnabled)say("Use your approved GitHub account to access the admin workspace.");
      if(oauthMisconfigured)say("GitHub sign-in setup is incomplete. Ask the site owner to finish all three Cloudflare OAuth settings.",true);
      if(oauthError)say(oauthError,true);
    }catch(err){setupPanel.hidden=true;loginPanel.hidden=false;say(err.message,true);}
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
$("mediaFiles").addEventListener("change",event=>{
  const files=Array.from(event.target.files||[]);
  if(files.length)say("Selected "+files.length+" file(s): "+files.map(file=>file.name).join(", "));
  else say("No files selected.");
});
$("uploadForm").addEventListener("submit",async event=>{
  event.preventDefault();const files=Array.from($("mediaFiles").files||[]),eventId=Number($("uploadEvent").value),albumId=$("uploadAlbum").value?Number($("uploadAlbum").value):null;
  if(!files.length||!eventId)return say("Choose an event and at least one file.",true);
  const progress=$("uploadProgress");progress.value=0;let complete=0,failed=0,lastError="";
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
      lastError=file.name+": "+err.message;
      say(lastError,true);
    }
  }
  if(failed===0)say("Upload finished: "+complete+" of "+files.length+" file(s) saved.");
  else say("Upload finished with "+complete+" saved and "+failed+" failed. "+lastError,true);
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
function makeCreativeDraft({task,language,tone,brief,context}){
  const details=context? "\n\nConfirmed details: "+context : "";
  const brand="Ramesh Photography";
  const english={
    instagram_caption: "INSTAGRAM CAPTION\n\n"+(tone==="Luxury and premium"?"Elegance in every frame. Emotions in every detail.":tone==="Friendly and warm"?"Every smile, every tradition, every heartfelt moment — captured with care.":"For moments that deserve to be remembered beautifully, choose "+brand+".")+"\n\n"+brand+" — preserving your wedding story with cinematic frames and genuine candid moments.\nFor bookings and enquiries, send us a DM.\n\n#RameshPhotography #SouthIndianWedding #WeddingPhotography #CandidWeddingPhotography #WeddingStories",
    story_campaign: "INSTAGRAM STORY CAMPAIGN\n\nFrame 1 — HOOK\nVisual: A strong candid wedding moment.\nText: Your once-in-a-lifetime moments deserve to be remembered.\n\nFrame 2 — EXPERIENCE\nVisual: A sequence of details, emotions and celebrations.\nText: Real emotions. Beautiful details. Timeless memories.\n\nFrame 3 — BRAND\nVisual: A clean portfolio highlight.\nText: "+brand+"\n\nFrame 4 — CALL TO ACTION\nVisual: A simple booking card.\nText: Now accepting enquiries. DM us to check your date.",
    booking_reply: "CLIENT ENQUIRY REPLY\n\nHello! Thank you for considering "+brand+" for your special occasion. We would be happy to understand your requirements. Please share your event date, venue, event functions and the photography/video services you are looking for. We can then discuss the suitable package and availability. Looking forward to hearing from you.",
    quotation_copy: "PHOTOGRAPHY QUOTATION\n\nPrepared by: "+brand+"\n\nEvent / requirements:\n"+brief+"\n\nConfirmed details:\n"+(context||"To be confirmed with the client.")+"\n\nFinal pricing, deliverables, coverage hours, delivery timeline and booking advance should be confirmed in writing before acceptance. No unconfirmed service or price is included in this draft.",
    marketing_plan: "7-DAY MARKETING PLAN — "+brand+"\n\nDay 1: Publish a strong wedding portfolio image with a short story behind the moment.\nDay 2: Share a 3–5 frame Story showing candid moments and details.\nDay 3: Post a short behind-the-scenes Reel from a real event.\nDay 4: Share a client FAQ about coverage, deliverables or booking.\nDay 5: Publish a carousel featuring one event from preparation to celebration.\nDay 6: Post a clear booking-enquiry Story with a DM call-to-action.\nDay 7: Review reach, saves, shares and genuine enquiries; repeat the best-performing format."
  };
  const telugu={
    instagram_caption: "ఇన్‌స్టాగ్రామ్ క్యాప్షన్\n\n"+brand+" — మీ పెళ్లి వేడుకలోని ప్రతి భావాన్ని, ప్రతి అందమైన క్షణాన్ని సినిమాటిక్‌గా భద్రపరుస్తాం.\nమీ జీవితంలోని ప్రత్యేక జ్ఞాపకాల కోసం మమ్మల్ని సంప్రదించండి. బుకింగ్ వివరాలకు DM చేయండి.\n\n#RameshPhotography #WeddingPhotography #SouthIndianWedding #CandidPhotography",
    story_campaign: "ఇన్‌స్టాగ్రామ్ స్టోరీ క్యాంపెయిన్\n\nఫ్రేమ్ 1 — ఆకట్టుకునే క్షణం\nవిజువల్: అందమైన క్యాండిడ్ వెడ్డింగ్ ఫోటో.\nటెక్స్ట్: మీ జీవితంలోని ప్రత్యేక క్షణాలు ఎప్పటికీ గుర్తుండాలి.\n\nఫ్రేమ్ 2 — మా పని\nవిజువల్: వేడుకలోని భావోద్వేగాలు, వివరాలు.\nటెక్స్ట్: నిజమైన భావాలు. అందమైన జ్ఞాపకాలు.\n\nఫ్రేమ్ 3 — బ్రాండ్\nవిజువల్: బెస్ట్ పోర్ట్‌ఫోలియో.\nటెక్స్ట్: "+brand+"\n\nఫ్రేమ్ 4 — బుకింగ్\nటెక్స్ట్: బుకింగ్ వివరాల కోసం DM చేయండి.",
    booking_reply: "క్లయింట్ ఎంక్వైరీకి సమాధానం\n\nనమస్కారం! మీ ప్రత్యేక వేడుక కోసం "+brand+" ను సంప్రదించినందుకు ధన్యవాదాలు. మీ ఈవెంట్ తేదీ, వేదిక, ఎన్ని ఫంక్షన్లు ఉన్నాయి, ఫోటోగ్రఫీ లేదా వీడియోలో ఏ సేవలు కావాలో తెలియజేయండి. వాటి ఆధారంగా ప్యాకేజీ మరియు అందుబాటును చర్చిద్దాం. ధన్యవాదాలు!",
    quotation_copy: "ఫోటోగ్రఫీ కొటేషన్\n\nసంస్థ: "+brand+"\n\nఈవెంట్ / అవసరాలు:\n"+brief+"\n\nధృవీకరించిన వివరాలు:\n"+(context||"క్లయింట్‌తో నిర్ధారించాలి.")+"\n\nధరలు, డెలివరబుల్స్, కవరేజ్ సమయం, ఫోటోలు/వీడియో డెలివరీ గడువు, అడ్వాన్స్ వివరాలను క్లయింట్‌తో రాతపూర్వకంగా నిర్ధారించిన తర్వాతే ఫైనల్ చేయాలి.",
    marketing_plan: "7 రోజుల మార్కెటింగ్ ప్లాన్ — "+brand+"\n\n1వ రోజు: బెస్ట్ వెడ్డింగ్ ఫోటోతో చిన్న కథను పోస్ట్ చేయండి.\n2వ రోజు: క్యాండిడ్ మూమెంట్స్‌తో 3–5 స్టోరీ ఫ్రేమ్స్ పెట్టండి.\n3వ రోజు: నిజమైన ఈవెంట్ బిహైండ్-ది-సీన్స్ Reel షేర్ చేయండి.\n4వ రోజు: కవరేజ్ లేదా డెలివరీ గురించి ఒక FAQ పోస్ట్ చేయండి.\n5వ రోజు: ఒక ఈవెంట్‌ను చూపించే ఫోటో క్యారసెల్ పోస్ట్ చేయండి.\n6వ రోజు: బుకింగ్ ఎంక్వైరీ కోసం స్పష్టమైన DM స్టోరీ పెట్టండి.\n7వ రోజు: రీచ్, సేవ్స్, షేర్స్, నిజమైన ఎంక్వైరీలను పరిశీలించి మంచి ఫలితమిచ్చిన కంటెంట్‌ను మళ్లీ చేయండి."
  };
  const en=english[task],te=telugu[task];
  let result=language==="Telugu"?te:language==="English + Telugu"?en+"\n\n——————————\n\n"+te:en;
  if(details)result+="\n\n"+(language==="Telugu"?"అదనపు ధృవీకరించిన వివరాలు: ":"Additional confirmed details: ")+context;
  result+="\n\n"+(language==="Telugu"?"గమనిక: ప్రచురించే ముందు తేదీలు, ధరలు, సేవలు మరియు అందుబాటును నిర్ధారించండి.":"Note: Verify dates, prices, services and availability before publishing.");
  return result;
}
$("claudeForm").addEventListener("submit",event=>{
  event.preventDefault();
  const output=$("claudeOutput"),copy=$("claudeCopy");
  const brief=$("claudeBrief").value.trim();
  if(!brief){say("Please enter your brief.",true);return;}
  const data={task:$("claudeTask").value,language:$("claudeLanguage").value,tone:$("claudeTone").value,brief,context:$("claudeContext").value.trim()};
  output.textContent=makeCreativeDraft(data);
  copy.disabled=false;
  say("Draft created using free built-in templates. Review all details before publishing.");
});
$("claudeCopy").addEventListener("click",async()=>{
  const value=$("claudeOutput").textContent||"";
  if(!value||value==="Your generated content will appear here.")return;
  try{await navigator.clipboard.writeText(value);say("Generated content copied.");}
  catch{say("Copy was blocked by the browser. Select the text and copy it manually.",true);}
});

initialize();
