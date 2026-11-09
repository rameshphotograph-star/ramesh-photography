document.getElementById("year").textContent = new Date().getFullYear();
const form = document.getElementById("eventForm");
if (form) {
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const code = document.getElementById("eventCode").value.trim();
    const message = document.getElementById("message");
    if (!code) return;
    // Event gallery routing will be connected to the cloud database in the next build step.
    message.textContent = "Event gallery connection is not configured yet. Please ask the photographer to finish the website setup.";
  });
}
