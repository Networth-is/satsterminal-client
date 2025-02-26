(function () {
  const detectedProviders = new Set();
  const acknowledgedProviders = new Set();
  const eventListeners = {};

  // Detect providers dynamically and relay metadata
  const providerNames = [
    "unisat",
    "XverseProviders",
    "magicEden",
    "okxwallet",
    "LeatherProvider",
    "phantom",
    "OrangeWalletProviders",
  ];

  const iframeOrigin = 'https://beta.satsterminal.com'; 

  // Helper function to get method names from any provider object
  function getProviderMethods(provider) {
    return Object.keys(provider).filter(key => typeof provider[key] === "function");
  }

  // Function to relay provider metadata (method names) to the iframe
  function relayProviderMetadata(providerName) {
    try {
      const provider = window[providerName];

      if (provider && !acknowledgedProviders.has(providerName)) {
        // Handle special case for XverseProviders
        if (providerName === "XverseProviders" && provider.BitcoinProvider) {
          try {
            const xverseMethods = getProviderMethods(provider);
            postMessageToIframes(
              { type: "PROVIDER_METADATA", providerName: "XverseProviders", methods: xverseMethods }
            );

            const bitcoinProviderMethods = getProviderMethods(provider.BitcoinProvider);
            postMessageToIframes(
              { type: "PROVIDER_METADATA", providerName: "XverseProviders.BitcoinProvider", methods: bitcoinProviderMethods }
            );
          } catch (xverseError) {
            // console.warn(`Failed to process XverseProviders methods:`, xverseError);
          }
        } else {
          try {
            const methodNames = getProviderMethods(provider);
            postMessageToIframes(
              { type: "PROVIDER_METADATA", providerName, methods: methodNames }
            );
          } catch (methodError) {
            // console.warn(`Failed to process ${providerName} methods:`, methodError);
          }
        }
        detectedProviders.add(providerName);
      }
    } catch (error) {
      // console.warn(`Failed to relay metadata for provider ${providerName}:`, error);
    }
  }

  // Function to post messages to all iframes
  function postMessageToIframes(message) {
    document.querySelectorAll("iframe").forEach((iframe) => {
      try {
        iframe.contentWindow.postMessage(message, iframeOrigin);
      } catch (iframeError) {
        // console.warn(`Failed to send message to iframe:`, iframeError);
      }
    });
  }

  // Listen for acknowledgments and method calls from iframe
  window.addEventListener("message", (event) => {
    try {
      if (!event.source || !event.data) return;


      if (event.data.type === "PROVIDER_ACKNOWLEDGMENT") {
        const { providerName } = event.data;
        acknowledgedProviders.add(providerName);
      }

      if (event.data.type === "CALL_METHOD" || event.data.type === "SUBSCRIBE_EVENT" || event.data.type === "UNSUBSCRIBE_EVENT") {
        const { providerName, methodName, args = [], requestId, eventName } = event.data;
        try {
          let provider = window[providerName.split('.')[0]];

          if (providerName === "XverseProviders.BitcoinProvider") {
            provider = provider.BitcoinProvider;
          }

          if (event.data.type === "CALL_METHOD" && provider && typeof provider[methodName] === "function") {
            try {
              const result = provider[methodName](...args);
              if (result instanceof Promise) {
                result
                  .then((resolvedResult) => {
                    event.source.postMessage({ type: "METHOD_RESPONSE", requestId, result: resolvedResult }, event.origin);
                  })
                  .catch((error) => {
                    event.source.postMessage({ type: "METHOD_RESPONSE", requestId, error: error.message }, event.origin);
                  });
              } else {
                // Handle synchronous returns
                event.source.postMessage({ type: "METHOD_RESPONSE", requestId, result }, event.origin);
              }
            } catch (methodError) {
              // console.warn(`Error calling method ${methodName} on ${providerName}:`, methodError);
              event.source.postMessage({ type: "METHOD_RESPONSE", requestId, error: methodError.message }, event.origin);
            }
          }

          // Handle event subscription
          if (event.data.type === "SUBSCRIBE_EVENT" && provider && typeof provider.on === "function") {
            try {
              if (!eventListeners[providerName]) {
                eventListeners[providerName] = {};
              }

              if (!eventListeners[providerName][eventName]) {
                eventListeners[providerName][eventName] = new Set();

                // Subscribe to the event
                provider.on(eventName, (data) => {
                  eventListeners[providerName][eventName].forEach((targetWindow) => {
                    try {
                      targetWindow.postMessage(
                        { type: "EVENT_TRIGGER", providerName, eventName, data },
                        iframeOrigin
                      );
                    } catch (postError) {
                      // console.warn(`Failed to post event to iframe:`, postError);
                    }
                  });
                });
              }

              eventListeners[providerName][eventName].add(event.source);
            } catch (subscribeError) {
              // console.warn(`Failed to subscribe to ${eventName} on ${providerName}:`, subscribeError);
            }
          }

          // Handle event unsubscription
          if (event.data.type === "UNSUBSCRIBE_EVENT" && eventListeners[providerName] && eventListeners[providerName][eventName]) {
            eventListeners[providerName][eventName].delete(event.source);

            if (eventListeners[providerName][eventName].size === 0) {
              delete eventListeners[providerName][eventName];
            }
          }
        } catch (providerError) {
          // console.warn(`Error processing provider ${providerName}:`, providerError);
          if (event.data.type === "CALL_METHOD") {
            event.source.postMessage({ type: "METHOD_RESPONSE", requestId, error: providerError.message }, event.origin);
          }
        }
      }
    } catch (error) {
      // console.warn("Error processing message event:", error);
    }
  });

  // Function to check for new providers
  function checkForNewProviders() {
    providerNames.forEach(providerName => {
      try {
        if (window[providerName] && !acknowledgedProviders.has(providerName)) {
          relayProviderMetadata(providerName);
        }
      } catch (error) {
        // console.warn(`Failed to check provider ${providerName}:`, error);
      }
    });
  }

  // Initial check for providers
  checkForNewProviders();

  // Periodically check for new providers
  const providerCheckInterval = setInterval(checkForNewProviders, 1000);

  // Timeout to stop checking for providers after 30 seconds
  setTimeout(() => {
    if (providerCheckInterval) {
      clearInterval(providerCheckInterval);
    }
  }, 30000);

  // Clean up interval on page unload to prevent memory leaks
  window.addEventListener("beforeunload", () => clearInterval(providerCheckInterval));
})();
