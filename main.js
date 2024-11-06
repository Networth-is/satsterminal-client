(function () {
  console.log("YAYYYY ITS LOADING");
  // Set of detected providers to avoid redundant relays
  const detectedProviders = new Set();

  // Function to relay a provider to the iframe
  function relayProvider(providerName) {
    const provider = window[providerName];
    if (provider && !detectedProviders.has(providerName)) {
      // Post message to all iframes on the page
      document.querySelectorAll("iframe").forEach((iframe) => {
        iframe.contentWindow.postMessage(
          { type: "PROVIDER_RELAY", providerName, provider },
          "*"
        );
      });
      detectedProviders.add(providerName);
    }
  }

  // Exact provider names based on your code
  const providerNames = [
    "XverseProvider",
    "LeatherProvider",
    "PhantomProvider",
    "OkxProvider",
    "UnisatProvider",
    "WizzProvider",
  ];

  // Initial check for any existing providers on window
  providerNames.forEach(relayProvider);

  // Monitor new providers added to the window object
  const observer = new MutationObserver(() => {
    providerNames.forEach(relayProvider);
  });

  // Observe changes to the window object
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Clean up observer on page unload to prevent memory leaks
  window.addEventListener("beforeunload", () => observer.disconnect());
})();
