/**
 * Intercepts normal clicks on the footer's Manage Subscription link and
 * navigates to the destination resolved from `/api/me`. The link's static
 * sign-in URL remains a fallback when this client script does not run.
 */
import { resolveManageSubscriptionUrl } from "@/lib/account/manageSubscription";

document.addEventListener(
  "click",
  async (event) => {
    const target = event.target;
    const link =
      target instanceof Element
        ? target.closest("a[data-manage-subscription]")
        : null;
    if (
      !(link instanceof HTMLAnchorElement) ||
      event.defaultPrevented ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();
    if (link.dataset.manageSubscriptionBusy === "true") return;
    link.dataset.manageSubscriptionBusy = "true";
    link.setAttribute("aria-busy", "true");

    const destination = await resolveManageSubscriptionUrl();
    if (destination) {
      window.location.assign(destination);
      return;
    }

    delete link.dataset.manageSubscriptionBusy;
    link.removeAttribute("aria-busy");
  },
  true,
);
