// Clicking the toolbar icon opens Chess Analyzer. Keep in sync with REVIEW_BASE in content.js.
const SITE = 'https://nicolaepostica.github.io/chess-analyzer/'

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: SITE })
})
