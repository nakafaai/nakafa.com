// The service worker of Nakafa's web push (ADR 0027). A push carries the id of
// one inbox row, a general title and sentence, and the inbox to open; it names
// no one. A press on the notification opens the inbox.
self.addEventListener("push", (event) => {
  const notice = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(notice.title || "Nakafa", {
      body: notice.body,
      data: { url: notice.url },
      icon: "/logo.png",
      tag: notice.id,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (url) {
    event.waitUntil(self.clients.openWindow(url));
  }
});
