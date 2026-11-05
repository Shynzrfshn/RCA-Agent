/* RCA Agent service worker: push notifications + action buttons. */
const SCOPE = self.registration.scope; // e.g. https://user.github.io/RCA-Agent/

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "RCA Agent", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "RCA Agent", {
      body: data.body || "",
      icon: SCOPE + "icon.svg",
      badge: SCOPE + "icon.svg",
      tag: data.tag,
      renotify: Boolean(data.tag),
      requireInteraction: Boolean(data.actions && data.actions.length),
      lang: "fa",
      dir: "rtl",
      actions: data.actions || [],
      data: {
        url: data.url || "dashboard/",
        actionUrl: data.actionUrl,
        actionToken: data.actionToken,
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const n = event.notification;
  const { url, actionUrl, actionToken } = n.data || {};
  n.close();

  if (event.action && actionUrl && actionToken) {
    event.waitUntil(
      fetch(actionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: actionToken, action: event.action }),
      }).catch(() => undefined),
    );
    return;
  }

  const target = new URL(String(url).replace(/^\//, ""), SCOPE).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(SCOPE) && "focus" in w) {
          w.navigate(target);
          return w.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
