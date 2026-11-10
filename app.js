document.getElementById("year").textContent = new Date().getFullYear();

const form = document.getElementById("eventForm");
const hero = document.querySelector(".hero");
const galleryView = document.getElementById("galleryView");
const message = document.getElementById("message");
const galleryMessage = document.getElementById("galleryMessage");
const photoGrid = document.getElementById("photoGrid");
const photoDialog = document.getElementById("photoDialog");
const loadMoreButton = document.getElementById("loadMorePhotos");
let currentPhotos = [];
let currentAlbums = [];
let currentAlbumId = "";
let currentEventCode = "";
let nextCursor = null;
let galleryLoading = false;

function safeText(value) { return String(value == null ? "" : value); }
function setMessage(node, value, isError = false) {
  node.textContent = value;
  node.classList.toggle("is-error", isError);
}
function thumbnailUrl(url) {
  return url.replace("/upload/", "/upload/f_auto,q_auto,w_700,c_limit/");
}
function downloadUrl(url) {
  return safeText(url).replace("/upload/", "/upload/fl_attachment/");
}
function mediaElement(photo, large = false) {
  const url = safeText(photo.secure_url);
  const type = photo.resource_type === "video" ? "video" : "image";
  if (!/^https:\/\/res\.cloudinary\.com\//.test(url)) return null;
  if (type === "video") {
    const video = document.createElement("video");
    video.src = url;
    video.controls = large;
    video.preload = "metadata";
    video.playsInline = true;
    if (!large) video.muted = true;
    return video;
  }
  const img = document.createElement("img");
  img.src = large ? url : thumbnailUrl(url);
  img.alt = safeText(photo.file_name || "Ramesh Photography event photograph");
  img.loading = "lazy";
  img.decoding = "async";
  return img;
}
function openPhoto(photo) {
  const target = document.getElementById("dialogMedia");
  target.replaceChildren();
  const media = mediaElement(photo, true);
  if (!media) return;
  if (media.tagName === "IMG") media.classList.add("dialog-image");
  target.append(media);
  const link = document.getElementById("downloadPhoto");
  link.href = downloadUrl(photo.secure_url);
  link.download = photo.file_name || "ramesh-photography";
  photoDialog.showModal();
}
function appendPhotos(photos) {
  photos.forEach(photo => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "photo-card";
    const media = mediaElement(photo);
    if (!media) return;
    card.append(media);
    const caption = document.createElement("span");
    caption.textContent = photo.file_name || "Event photograph";
    card.append(caption);
    card.addEventListener("click", () => openPhoto(photo));
    photoGrid.append(card);
  });
}
function renderFilters() {
  const wrap = document.getElementById("albumFilters");
  wrap.replaceChildren();
  const items = [{ id: "", name: "All Photos" }, ...currentAlbums.map(album => ({ id: String(album.id), name: album.album_name }))];
  items.forEach(album => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-pill" + (currentAlbumId === album.id ? " active" : "");
    button.textContent = album.name;
    button.addEventListener("click", () => {
      if (galleryLoading || currentAlbumId === album.id) return;
      currentAlbumId = album.id;
      renderFilters();
      loadGallery(currentEventCode, { reset: true, albumId: currentAlbumId });
    });
    wrap.append(button);
  });
}
async function loadGallery(code, options = {}) {
  const reset = options.reset !== false;
  const albumId = options.albumId === undefined ? currentAlbumId : options.albumId;
  if (galleryLoading) return;
  galleryLoading = true;
  loadMoreButton.disabled = true;
  if (reset) {
    currentEventCode = code;
    currentAlbumId = albumId || "";
    currentPhotos = [];
    nextCursor = null;
    photoGrid.replaceChildren();
    galleryView.hidden = true;
    hero.hidden = false;
    setMessage(message, "Loading your gallery…");
    setMessage(galleryMessage, "");
  } else {
    setMessage(galleryMessage, "Loading more photos…");
  }
  try {
    const params = new URLSearchParams({ code, limit: "60" });
    if (albumId) params.set("albumId", albumId);
    if (!reset && nextCursor) params.set("cursor", String(nextCursor));
    const response = await fetch("/api/gallery?" + params.toString(), { headers: { Accept: "application/json" } });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || "Gallery could not be opened.");
    if (reset) {
      currentAlbums = data.albums || [];
      document.getElementById("eventTitle").textContent = data.event.event_name;
      document.getElementById("eventDetails").textContent = [data.event.event_date, data.event.venue].filter(Boolean).join(" • ");
      renderFilters();
      galleryView.hidden = false;
      hero.hidden = true;
      const url = new URL(location.href);
      url.searchParams.set("event", code);
      history.replaceState({}, "", url);
      setMessage(message, "");
    }
    const photos = data.photos || [];
    currentPhotos = reset ? photos : currentPhotos.concat(photos);
    appendPhotos(photos);
    nextCursor = data.nextCursor;
    loadMoreButton.hidden = !nextCursor;
    if (!currentPhotos.length) setMessage(galleryMessage, "No photographs have been uploaded to this event or album yet.");
    else setMessage(galleryMessage, "Showing " + currentPhotos.length + " photo(s).");
  } catch (err) {
    if (reset) {
      setMessage(message, err.message || "Unable to load gallery.", true);
      hero.hidden = false;
      galleryView.hidden = true;
    } else {
      setMessage(galleryMessage, err.message || "Unable to load more photos.", true);
    }
  } finally {
    galleryLoading = false;
    loadMoreButton.disabled = false;
  }
}
if (form) {
  form.addEventListener("submit", event => {
    event.preventDefault();
    const code = document.getElementById("eventCode").value.trim().toUpperCase();
    if (code) loadGallery(code, { reset: true, albumId: "" });
  });
}
document.getElementById("changeEvent").addEventListener("click", () => {
  galleryView.hidden = true;
  hero.hidden = false;
  history.replaceState({}, "", location.pathname);
});
loadMoreButton.addEventListener("click", () => {
  if (nextCursor) loadGallery(currentEventCode, { reset: false, albumId: currentAlbumId });
});
document.getElementById("closePhoto").addEventListener("click", () => photoDialog.close());
photoDialog.addEventListener("click", event => {
  if (event.target === photoDialog) photoDialog.close();
});
document.getElementById("downloadAll").addEventListener("click", async () => {
  const photos = currentPhotos.filter(photo => (photo.resource_type === "image" || photo.resource_type === "video") && photo.secure_url);
  if (!photos.length) return setMessage(galleryMessage, "No loaded photos to download.");
  setMessage(galleryMessage, "Preparing " + photos.length + " loaded photo download(s)…");
  for (const photo of photos) {
    const link = document.createElement("a");
    link.href = downloadUrl(photo.secure_url);
    link.download = photo.file_name || "photo";
    link.target = "_blank";
    link.rel = "noopener";
    document.body.append(link);
    link.click();
    link.remove();
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  setMessage(galleryMessage, "Download requests sent. Your browser may ask you to allow multiple downloads.");
});
const initialCode = new URLSearchParams(location.search).get("event");
if (initialCode) loadGallery(initialCode.toUpperCase(), { reset: true, albumId: "" });
