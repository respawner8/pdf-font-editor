chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || !/^file:\/\/.*\.pdf($|\?)/i.test(tab.url)) {
    console.warn('[pdf-font-editor] Not a local PDF tab:', tab.url);
    return;
  }
  const editorUrl = chrome.runtime.getURL('src/editor/editor.html') +
    `?src=${encodeURIComponent(tab.url)}`;
  await chrome.tabs.create({ url: editorUrl });
});
