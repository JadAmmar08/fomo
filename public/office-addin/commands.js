// Runs in the background whenever Word/Excel opens ANY document, not just ones the
// user has manually opened the FOMO pane for before — this is what makes the alert
// pane show up automatically per Jad's requirement ("works for all future files"),
// instead of needing a manual ribbon click on every single document. Uses Office's
// documented event-activation pattern (DocumentOpened bound in manifest.xml's Events
// extension point) rather than anything running inside taskpane.js, since that file
// only loads once the pane is already open.
function onDocumentOpened(event) {
  Office.addin.showAsTaskpane().catch(() => undefined).finally(() => {
    if (event && event.completed) event.completed();
  });
}

Office.onReady(() => {
  if (Office.actions && Office.actions.associate) {
    Office.actions.associate("onDocumentOpened", onDocumentOpened);
  }
});
