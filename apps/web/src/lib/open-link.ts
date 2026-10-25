/**
 * Opens a link that is only known after a network call, in a new tab.
 *
 * Browsers (Safari and phone browsers especially) block `window.open` when it runs after a wait, so
 * the tab is opened straight away, inside the click, and sent to the link once it arrives. If even
 * that is blocked, the link opens in the current tab instead. Returns the link, or null if there was none.
 */
export async function openInNewTab(getUrl: () => Promise<string | null | undefined>): Promise<string | null> {
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;
  try {
    const url = await getUrl();
    if (!url) {
      tab?.close();
      return null;
    }
    if (tab) tab.location.href = url;
    else window.location.assign(url);
    return url;
  } catch (err) {
    tab?.close();
    throw err;
  }
}
