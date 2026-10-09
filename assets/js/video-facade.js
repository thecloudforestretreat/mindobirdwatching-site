document.addEventListener("click", function (event) {
  var link = event.target.closest("a.videoFacade");
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  var id = link.getAttribute("data-video-id") || "4C06aiONXxw";
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
  var player = document.createElement("iframe");
  player.className = "videoFrame";
  player.title = link.getAttribute("data-video-title");
  player.src = "https://www.youtube.com/embed/" + id + "?rel=0&autoplay=1";
  player.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  player.allowFullscreen = true;
  player.referrerPolicy = "strict-origin-when-cross-origin";
  link.replaceWith(player);
  player.focus();
});
