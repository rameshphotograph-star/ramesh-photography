document.getElementById("year").textContent = new Date().getFullYear();
const form=document.getElementById("eventForm"),hero=document.querySelector(".hero"),galleryView=document.getElementById("galleryView");
const message=document.getElementById("message"),galleryMessage=document.getElementById("galleryMessage"),photoGrid=document.getElementById("photoGrid");
const photoDialog=document.getElementById("photoDialog");
let currentPhotos=[],currentAlbum="all";
function safeText(value){return String(value==null?"":value);}
function setMessage(node,value,isError=false){node.textContent=value;node.classList.toggle("is-error",isError);}
function mediaElement(photo,large=false){
  const url=safeText(photo.secure_url),type=photo.resource_type==="video"?"video":"image";
  if(!/^https:\/\/res\.cloudinary\.com\//.test(url))return null;
  if(type==="video"){const video=document.createElement("video");video.src=url;video.controls=large;video.preload="metadata";video.playsInline=true;if(!large)video.muted=true;return video;}
  const img=document.createElement("img");img.src=url;img.alt=safeText(photo.file_name||"Ramesh Photography event photograph");img.loading="lazy";img.decoding="async";return img;
}
function openPhoto(photo){
  const target=document.getElementById("dialogMedia");target.replaceChildren();const media=mediaElement(photo,true);if(!media)return;
  if(media.tagName==="IMG")media.classList.add("dialog-image");target.append(media);
  const link=document.getElementById("downloadPhoto");link.href=photo.secure_url;link.download=photo.file_name||"ramesh-photography";photoDialog.showModal();
}
function renderFilters(){
  const wrap=document.getElementById("albumFilters");wrap.replaceChildren();
  const albums=["all",...new Set(currentPhotos.map(photo=>photo.album_name).filter(Boolean))];
  albums.forEach(album=>{const button=document.createElement("button");button.type="button";button.className="filter-pill"+(currentAlbum===album?" active":"");button.textContent=album==="all"?"All Photos":album;button.addEventListener("click",()=>{currentAlbum=album;renderFilters();renderPhotos();});wrap.append(button);});
}
function renderPhotos(){
  photoGrid.replaceChildren();const visible=currentAlbum==="all"?currentPhotos:currentPhotos.filter(photo=>photo.album_name===currentAlbum);
  if(!visible.length){setMessage(galleryMessage,"No photographs have been uploaded to this album yet.");return;}
  setMessage(galleryMessage,"");
  visible.forEach(photo=>{const card=document.createElement("button");card.type="button";card.className="photo-card";const media=mediaElement(photo);if(!media)return;card.append(media);const caption=document.createElement("span");caption.textContent=photo.file_name||"Event photograph";card.append(caption);card.addEventListener("click",()=>openPhoto(photo));photoGrid.append(card);});
}
async function loadGallery(code){
  setMessage(message,"Loading your gallery…");
  try{
    const response=await fetch("/api/gallery?code="+encodeURIComponent(code),{headers:{Accept:"application/json"}});
    const data=await response.json();if(!response.ok||!data.success)throw new Error(data.error||"Gallery could not be opened.");
    currentPhotos=data.photos||[];currentAlbum="all";
    document.getElementById("eventTitle").textContent=data.event.event_name;
    document.getElementById("eventDetails").textContent=[data.event.event_date,data.event.venue].filter(Boolean).join(" • ");
    renderFilters();renderPhotos();hero.hidden=true;galleryView.hidden=false;
    const url=new URL(location.href);url.searchParams.set("event",code);history.replaceState({},"",url);setMessage(message,"");
  }catch(err){setMessage(message,err.message||"Unable to load gallery.",true);hero.hidden=false;galleryView.hidden=true;}
}
if(form)form.addEventListener("submit",event=>{event.preventDefault();const code=document.getElementById("eventCode").value.trim().toUpperCase();if(code)loadGallery(code);});
document.getElementById("changeEvent").addEventListener("click",()=>{galleryView.hidden=true;hero.hidden=false;history.replaceState({},"",location.pathname);});
document.getElementById("closePhoto").addEventListener("click",()=>photoDialog.close());
photoDialog.addEventListener("click",event=>{if(event.target===photoDialog)photoDialog.close();});
document.getElementById("downloadAll").addEventListener("click",async()=>{
  const photos=currentAlbum==="all"?currentPhotos:currentPhotos.filter(photo=>photo.album_name===currentAlbum);
  if(!photos.length)return setMessage(galleryMessage,"No photos to download.");
  setMessage(galleryMessage,"Preparing downloads…");
  for(const photo of photos){if(photo.resource_type!=="image"||!photo.secure_url)continue;const link=document.createElement("a");link.href=photo.secure_url;link.download=photo.file_name||"photo";link.target="_blank";link.rel="noopener";document.body.append(link);link.click();link.remove();await new Promise(resolve=>setTimeout(resolve,250));}
  setMessage(galleryMessage,"Download requests sent. Your browser may ask you to allow multiple downloads.");
});
const initialCode=new URLSearchParams(location.search).get("event");if(initialCode)loadGallery(initialCode.toUpperCase());
