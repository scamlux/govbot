/*!
 * GovBot embeddable widget (D2).
 *
 * Usage on any site:
 *   <script src="https://<govbot-site>/widget.js" data-lang="uz" async></script>
 *
 * Adds a floating "GovBot" button; clicking it opens the guest chat (/embed) in an
 * iframe served from the GovBot origin. The host page never talks to the GovBot API.
 * Requires GUEST_CHAT_ENABLED on the backend; otherwise the panel links to the full site.
 */
(function () {
  if (window.__govbotWidget) return;
  window.__govbotWidget = true;

  var script = document.currentScript;
  var origin = script ? new URL(script.src).origin : "";
  var lang = (script && script.getAttribute("data-lang")) || "uz";
  var label = { uz: "GovBot yordamchisi", ru: "Помощник GovBot", en: "GovBot assistant" }[lang] || "GovBot";
  var closeLabel = { uz: "Yopish", ru: "Закрыть", en: "Close" }[lang] || "Close";

  var button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", label);
  button.textContent = "💬 GovBot";
  button.style.cssText =
    "position:fixed;right:20px;bottom:20px;z-index:2147483646;border:0;border-radius:999px;" +
    "padding:12px 18px;font:600 15px/1 system-ui,sans-serif;color:#fff;background:#0c6c8a;" +
    "box-shadow:0 8px 24px rgba(0,0,0,.2);cursor:pointer;min-height:44px";

  var panel = document.createElement("div");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", label);
  panel.hidden = true;
  panel.style.cssText =
    "position:fixed;right:20px;bottom:80px;z-index:2147483647;width:min(400px,calc(100vw - 40px));" +
    "height:min(620px,calc(100vh - 120px));border-radius:16px;overflow:hidden;background:#fff;" +
    "box-shadow:0 16px 48px rgba(0,0,0,.25);display:flex;flex-direction:column";

  var close = document.createElement("button");
  close.type = "button";
  close.textContent = "×";
  close.setAttribute("aria-label", closeLabel);
  close.style.cssText =
    "position:absolute;top:6px;right:8px;z-index:1;width:40px;height:40px;border:0;" +
    "background:transparent;font-size:24px;cursor:pointer;color:#12252c";

  var frame = null;

  function open() {
    if (!frame) {
      frame = document.createElement("iframe");
      frame.title = label;
      frame.src = origin + "/embed?lang=" + encodeURIComponent(lang);
      frame.style.cssText = "border:0;width:100%;height:100%";
      frame.setAttribute("allow", "microphone");
      panel.appendChild(frame);
    }
    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    frame.focus();
  }

  function hide() {
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
    button.focus();
  }

  button.addEventListener("click", function () {
    panel.hidden ? open() : hide();
  });
  close.addEventListener("click", hide);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !panel.hidden) hide();
  });

  panel.appendChild(close);
  document.body.appendChild(panel);
  document.body.appendChild(button);
})();
