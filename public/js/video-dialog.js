// 首页视频播放弹层：复制自 auth/public/dashboard/video-dialog.js。
function toEmbedUrl(url) {
  if (url.includes("/embed/")) return url;
  const id = (url.match(/[?&]v=([^&#]+)/) || [])[1];
  if (id) return `https://www.youtube.com/embed/${id}`;
  return url;
}

export function openVideoDialog(url) {
  const embed = toEmbedUrl(url);
  const separator = embed.includes("?") ? "&" : "?";
  const src = `${embed}${separator}autoplay=1`;
  const closeIconUrl = ["", "images", "icons", "close.svg"].join("/");

  const overlay = document.createElement("div");
  overlay.className = "home-video-overlay show video-overlay";
  overlay.innerHTML = `
    <div class="video-dialog">
      <button class="video-dialog-close" type="button" data-action="close">
        <img src="${closeIconUrl}" alt="Close">
      </button>
      <div class="video-frame">
        <iframe
          src="${src}"
          title="Video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay
    .querySelector('[data-action="close"]')
    .addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
}
