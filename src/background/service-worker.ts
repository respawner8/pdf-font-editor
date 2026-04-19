chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || !/^file:\/\/.*\.pdf($|\?)/i.test(tab.url)) {
    await chrome.tabs.create({
      url: 'data:text/html,' + encodeURIComponent(
        '<h3 style="font-family:system-ui;padding:24px">Not a local PDF</h3>' +
        '<p style="font-family:system-ui;padding:0 24px">Open a <code>file://…</code> PDF in Chrome first, then click the extension icon.</p>'
      )
    });
    return;
  }
  const editorUrl = chrome.runtime.getURL('src/editor/editor.html') +
    `?src=${encodeURIComponent(tab.url)}`;
  await chrome.tabs.create({ url: editorUrl });
});
