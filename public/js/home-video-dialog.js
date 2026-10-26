import { openVideoDialog } from "/js/video-dialog.js";

function setupVideoDialogs() {
  document
    .querySelectorAll(
      '[data-home-video-dialog], [data-video-dialog], .faq-home a[href*="youtube.com/"], [data-video-dialog-scope] a[href*="youtube.com/"]',
    )
    .forEach((trigger) => {
      if (!(trigger instanceof HTMLElement)) return;
      if (trigger.dataset.videoDialogBound === "true") return;
      trigger.dataset.videoDialogBound = "true";
      trigger.addEventListener("click", (event) => {
        const videoUrl =
          trigger instanceof HTMLAnchorElement
            ? trigger.href
            : trigger.dataset.videoUrl;
        if (!videoUrl) return;
        event.preventDefault();
        openVideoDialog(videoUrl);
      });
    });
}

setupVideoDialogs();
document.addEventListener("astro:page-load", setupVideoDialogs);
